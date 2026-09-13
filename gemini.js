// ============================================
// Vercel Serverless Function: /api/gemini
// Handles Gemini AI requests server-side.
// Reads GEMINI_API_KEY from environment variables.
// Enforces a server-side daily limit of 5 AI calls
// per session_id per day on the shared API key.
// Allows users to provide their own Gemini key
// to bypass the limit entirely.
// ============================================

// In-memory rate limiting map for serverless instance lifetime
// Key: `${sessionId}:${date}` -> count
const serverDailyUsage = new Map();
const DAILY_LIMIT = 5;

export default async function handler(req, res) {
  // Set CORS headers for security and flexibility
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST requests are supported.' });
  }

  const { prompt, generationConfig, inlineData, sessionId, userApiKey, supabaseUrl, supabaseKey } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing or empty "prompt" parameter in request body.' });
  }

  // Check if caller supplied their own Gemini API key
  const hasUserKey = typeof userApiKey === 'string' && userApiKey.trim().length > 0;
  let effectiveApiKey = '';

  if (hasUserKey) {
    // User key bypasses shared daily rate limits entirely
    effectiveApiKey = userApiKey.trim();
  } else {
    // Shared server key: strictly read from environment
    effectiveApiKey = process.env.GEMINI_API_KEY;
    if (!effectiveApiKey || !effectiveApiKey.trim()) {
      console.error('[/api/gemini] GEMINI_API_KEY environment variable is not set in Vercel.');
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your Vercel Environment Variables.'
      });
    }
  }

  // --- SERVER-SIDE USAGE LIMIT ENFORCEMENT ---
  const today = new Date().toISOString().split('T')[0]; // UTC calendar date YYYY-MM-DD
  const effectiveSessionId = (typeof sessionId === 'string' && sessionId.trim()) ? sessionId.trim() : 'anonymous';
  const memKey = `${effectiveSessionId}:${today}`;

  // Supabase connection details for usage tracking
  const sbUrl = (process.env.SUPABASE_URL || supabaseUrl || '').replace(/\/$/, '');
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || supabaseKey || '';
  let currentUsage = 0;
  let existingRowId = null;

  if (!hasUserKey) {
    // 1. Check in-memory count first
    const memCount = serverDailyUsage.get(memKey) || 0;

    // 2. Query Supabase usage_limits table if configured
    if (sbUrl && sbKey && !sbUrl.includes('xxxxx') && !sbKey.includes('eyJhbG...')) {
      try {
        const checkUrl = `${sbUrl}/rest/v1/usage_limits?session_id=eq.${encodeURIComponent(effectiveSessionId)}&date=eq.${today}&select=id,count`;
        const checkRes = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`
          }
        });
        if (checkRes.ok) {
          const rows = await checkRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            currentUsage = rows[0].count || 0;
            existingRowId = rows[0].id;
          }
        }
      } catch (sbCheckErr) {
        console.warn('[/api/gemini] Supabase usage check warning:', sbCheckErr.message);
      }
    }

    const effectiveUsage = Math.max(currentUsage, memCount);

    // Enforce 5 checks per day limit
    if (effectiveUsage >= DAILY_LIMIT) {
      console.log(`[/api/gemini] Daily limit reached for session "${effectiveSessionId}" (${effectiveUsage}/${DAILY_LIMIT})`);
      return res.status(429).json({
        rateLimited: true,
        limit: DAILY_LIMIT,
        used: effectiveUsage,
        message: "You've used your free checks for today. Come back tomorrow, or use your own Gemini API key for unlimited use."
      });
    }
  }

  try {
    // Build multimodal parts array if image data is supplied
    const parts = [];
    if (inlineData && inlineData.data && inlineData.mimeType) {
      parts.push({
        inlineData: {
          mimeType: inlineData.mimeType,
          data: inlineData.data
        }
      });
    }
    parts.push({ text: prompt });

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: generationConfig?.temperature ?? 0.2,
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 2048,
        responseMimeType: generationConfig?.responseMimeType ?? 'application/json'
      }
    };

    // Multi-model resilience: primary gemini-3.6-flash with automatic fallback to gemini-3.7-flash and gemini-3.5-flash
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
    let lastErrorMessage = '';
    let rawText = '';
    let activeModel = modelsToTry[0];
    let usageMetadata = null;

    for (const modelId of modelsToTry) {
      activeModel = modelId;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${effectiveApiKey.trim()}`;
      console.log(`[/api/gemini] Calling model "${modelId}" (prompt length: ${prompt.length} chars, customKey: ${hasUserKey})`);

      try {
        const googleResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (googleResponse.ok) {
          const data = await googleResponse.json();
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          usageMetadata = data.usageMetadata || null;
          if (rawText) {
            break; // Succeeded!
          }
        } else {
          const errData = await googleResponse.json().catch(() => ({}));
          lastErrorMessage = errData.error?.message || `Google Gemini API returned status ${googleResponse.status}`;
          console.warn(`[/api/gemini] Model "${modelId}" returned status ${googleResponse.status}: ${lastErrorMessage}. Trying next model...`);
        }
      } catch (fetchErr) {
        lastErrorMessage = fetchErr.message;
        console.warn(`[/api/gemini] Network error calling "${modelId}": ${lastErrorMessage}. Trying next model...`);
      }
    }

    if (!rawText) {
      console.error('[/api/gemini] All model attempts failed. Last error:', lastErrorMessage);
      return res.status(502).json({
        error: lastErrorMessage ? `AI Service error: ${lastErrorMessage}` : 'No text was generated by the AI models. Please try again.'
      });
    }

    // --- INCREMENT USAGE COUNT FOR SHARED KEY ---
    let newUsageCount = 0;
    if (!hasUserKey) {
      const prior = Math.max(currentUsage, serverDailyUsage.get(memKey) || 0);
      newUsageCount = prior + 1;
      serverDailyUsage.set(memKey, newUsageCount);

      if (sbUrl && sbKey && !sbUrl.includes('xxxxx') && !sbKey.includes('eyJhbG...')) {
        try {
          // Re-query latest count to ensure accurate increment even under concurrent cold starts
          let latestCount = currentUsage;
          try {
            const recheckUrl = `${sbUrl}/rest/v1/usage_limits?session_id=eq.${encodeURIComponent(effectiveSessionId)}&date=eq.${today}&select=id,count`;
            const recheckRes = await fetch(recheckUrl, {
              method: 'GET',
              headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
            });
            if (recheckRes.ok) {
              const rows = await recheckRes.json();
              if (Array.isArray(rows) && rows.length > 0) {
                existingRowId = rows[0].id;
                latestCount = Math.max(latestCount, rows[0].count || 0);
              }
            }
          } catch (reErr) {}

          newUsageCount = Math.max(newUsageCount, latestCount + 1);
          serverDailyUsage.set(memKey, newUsageCount);

          if (existingRowId) {
            await fetch(`${sbUrl}/rest/v1/usage_limits?id=eq.${existingRowId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({ count: newUsageCount, updated_at: new Date().toISOString() })
            });
          } else {
            // Upsert on conflict (session_id, date) to prevent duplicate key errors during concurrent cold starts
            await fetch(`${sbUrl}/rest/v1/usage_limits?on_conflict=session_id,date`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Prefer': 'resolution=merge-duplicates,return=minimal'
              },
              body: JSON.stringify({
                session_id: effectiveSessionId,
                date: today,
                count: newUsageCount
              })
            });
          }
        } catch (sbIncErr) {
          console.warn('[/api/gemini] Supabase usage increment warning:', sbIncErr.message);
        }
      }
    }

    return res.status(200).json({
      text: rawText,
      model: activeModel,
      usage: usageMetadata,
      dailyUsage: hasUserKey ? null : {
        used: newUsageCount,
        limit: DAILY_LIMIT,
        remaining: Math.max(0, DAILY_LIMIT - newUsageCount)
      }
    });

  } catch (err) {
    console.error('[/api/gemini] Unexpected server error:', err);
    return res.status(500).json({
      error: `Server internal error: ${err.message || 'Unknown error occurred'}`
    });
  }
}

