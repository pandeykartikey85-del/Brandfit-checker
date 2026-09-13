// ============================================
// Gemini API Integration
// Routes AI evaluation and analysis requests
// through the secure serverless /api/gemini endpoint.
// Gemini API key is stored strictly on the server.
// ============================================

async function callServerGemini(prompt, generationConfig = {}, inlineData = null) {
  const config = typeof getConfig === 'function' ? getConfig() : {};
  const sessionId = typeof getSessionId === 'function' ? getSessionId() : '';
  const userApiKey = typeof getUserGeminiKey === 'function' ? getUserGeminiKey() : '';

  const payload = {
    prompt,
    generationConfig: {
      temperature: generationConfig.temperature ?? 0.2,
      maxOutputTokens: generationConfig.maxOutputTokens ?? 2048,
      responseMimeType: generationConfig.responseMimeType ?? 'application/json'
    },
    sessionId: sessionId || undefined,
    userApiKey: userApiKey || undefined,
    supabaseUrl: (config && config.supabaseUrl) ? config.supabaseUrl : undefined,
    supabaseKey: (config && config.supabaseKey) ? config.supabaseKey : undefined
  };

  if (inlineData && inlineData.data && inlineData.mimeType) {
    payload.inlineData = inlineData;
  }

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (response.status === 429 || errData.rateLimited) {
      const rateLimitMsg = errData.message || "You've used your free checks for today. Come back tomorrow, or use your own Gemini API key for unlimited use.";
      const err = new Error(rateLimitMsg);
      err.isRateLimit = true;
      err.limit = errData.limit || 5;
      err.used = errData.used || 5;
      throw err;
    }
    const errorMsg = errData.error || `AI service error (${response.status}): ${response.statusText}`;
    throw new Error(errorMsg);
  }

  const data = await response.json();

  if (data.dailyUsage && typeof setLocalDailyUsage === 'function') {
    setLocalDailyUsage(data.dailyUsage.used);
  }

  const rawText = data.text || data.rawText || data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('No response received from AI service. Please try again.');
  }

  return rawText;
}

function getRateLimitNoticeHtml(customMessage) {
  const message = customMessage || "You've used your free checks for today. Come back tomorrow, or use your own Gemini API key for unlimited use.";
  const safeText = (typeof escapeHtml === 'function') ? escapeHtml(message) : message;
  return `
    <div class="result-card rate-limit-notice-card">
      <div class="rate-limit-badge">Daily Limit Reached</div>
      <div class="rate-limit-header">
        <span class="rate-limit-icon">⏳</span>
        <div class="rate-limit-heading">
          <h3>Daily Free Limit Reached (5/5)</h3>
          <p class="rate-limit-subheading">Free checks reset daily at midnight UTC.</p>
        </div>
      </div>
      <p class="rate-limit-message">${safeText}</p>
      <div class="rate-limit-actions">
        <button type="button" class="btn btn-primary btn-rate-limit-key" onclick="if(typeof showSettingsModal==='function')showSettingsModal();">
          🔑 Use Your Own Gemini Key (Unlimited)
        </button>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-rate-limit-get">
          Get Free Key at Google AI Studio ↗
        </a>
      </div>
    </div>
  `;
}

function renderRateLimitNoticeCard(containerEl, customMessage) {
  if (!containerEl) return;
  containerEl.innerHTML = getRateLimitNoticeHtml(customMessage);
  containerEl.classList.add('visible');
  containerEl.style.display = 'block';
}

// ============================================
// Multimodal OCR: Extract Text from Screenshot
// ============================================
async function extractTextFromImage(inlineData, mode = (typeof getUserMode === 'function' ? getUserMode() : 'creator')) {
  let prompt;
  if (mode === 'brand') {
    prompt = `You are an expert document OCR text extractor for influencer marketing.
Extract all readable text from this screenshot or image verbatim.
The image is from a content creator and may be an Instagram DM, creator email, sponsorship pitch, media kit, analytics screenshot, profile screenshot, rate card, or WhatsApp conversation.
Extract as much information as possible so the brand doesn't have to retype anything visible in the image.
Capture all visible creator metrics, names, handles, follower counts, engagement rates, impressions/reach, audience demographics, niches, platforms, deliverables, pricing/rates, and contact info.
Return ONLY the extracted text as clean, organized plain text. Do not add conversational intro, outro, or Markdown headers.`;
  } else {
    prompt = `You are a document OCR text extractor. 
Extract all readable text from this screenshot or image verbatim.
The image may be an Instagram DM, WhatsApp message, brand collaboration email, sponsorship proposal, pitch brief, rate inquiry, or contract screenshot.
Preserve exact wording, brand names, product names, deliverables, dates, pricing/rates, deliverables, and conditions.
Return ONLY the extracted text as clean plain text. Do not add conversational intro, outro, or Markdown headers.`;
  }

  const raw = await callServerGemini(prompt, {
    temperature: 0.1,
    maxOutputTokens: 2048,
    responseMimeType: 'text/plain'
  }, inlineData);

  return raw ? raw.trim() : '';
}

// ============================================
// URL Content Retrieval
// ============================================
async function fetchPageContentFromUrl(url, mode = (typeof getUserMode === 'function' ? getUserMode() : 'creator')) {
  const INSUFFICIENT_MSG = mode === 'brand'
    ? "We couldn't retrieve sufficient public profile information. Upload a screenshot, media kit, or analytics report."
    : "We couldn't retrieve enough information from this page. Upload a screenshot or paste the relevant text for a deeper analysis.";

  try {
    const response = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode })
    });

    if (!response.ok) {
      return {
        success: false,
        message: INSUFFICIENT_MSG
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('[URL Fetch Error]:', err);
    return {
      success: false,
      message: INSUFFICIENT_MSG
    };
  }
}

// ============================================
// Structured Pitch Extraction for Brand Mode
// Extracts creator claims from DM/pitch/email
// ============================================
async function extractCreatorPitchDetails(pitchText) {
  const prompt = `You are an expert talent scout and influencer marketing manager.
Analyze this creator's DM, email, sponsorship pitch, proposal, or media kit text and extract all relevant creator claims and terms into structured information.
Extract: creator name, handle, followers, claimed engagement, claimed reach, niche, platforms, proposed collaboration, deliverables, rate, contact details, and other relevant claims.
STRICT RULES:
1. Do NOT fabricate or assume any metrics that are not explicitly stated or clearly implied in the text.
2. If any detail is missing, set its value to null.
3. Keep extracted values concise and factual.

CREATOR PITCH TEXT:
${pitchText}

Respond in valid JSON matching this exact structure:
{
  "creatorName": "Creator or channel name, or null",
  "handle": "Social media handle e.g. @alexcreates, or null",
  "followers": "Claimed follower/subscriber count e.g. 50K, or null",
  "claimedEngagement": "Claimed engagement rate e.g. 4.8%, or null",
  "claimedReach": "Claimed monthly reach, average views, or impressions, or null",
  "niche": "Primary content niche e.g. Fitness, Tech, or null",
  "platforms": "Platforms e.g. Instagram Reels, YouTube, TikTok, or null",
  "proposedCollaboration": "Proposed collab format e.g. Sponsored Reel, dedicated video, or null",
  "deliverables": "Exact deliverables offered e.g. 1 Reel + 2 Stories, or null",
  "rate": "Quoted rate or compensation asked e.g. $800, ₹40,000, or null",
  "contactDetails": "Email, WhatsApp, or phone mentioned, or null",
  "otherClaims": "Any other relevant claims (awards, past brand partnerships, demographics, exclusivity terms), or null"
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.1,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json'
  });

  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Failed to parse extracted creator details:', inner);
      }
    }
  }

  return {
    creatorName: null,
    handle: null,
    followers: null,
    claimedEngagement: null,
    claimedReach: null,
    niche: null,
    platforms: null,
    proposedCollaboration: null,
    deliverables: null,
    rate: null,
    contactDetails: null,
    otherClaims: null
  };
}

async function evaluatePitch(pitchText, profileText, personalRules) {
  // Build the personal rules section (if any)
  let rulesSection = '';
  if (personalRules && personalRules.trim()) {
    rulesSection = `

IMPORTANT — PERSONAL DEALBREAKER RULES:
The creator has set these personal rules. Check the pitch against EACH rule FIRST, before applying the general criteria. If any rule is violated, mention it explicitly in your reasoning with the specific rule text and the part of the pitch that violates it (or the absence of information that makes it impossible to confirm compliance).

Creator's personal rules:
${personalRules.trim()}

---
`;
  }

  const prompt = `You are an expert creator business manager and brand deal strategist evaluating a brand collaboration pitch for a content creator. Base your evaluation on the pitch text provided, tested against the creator's profile and rates.

${rulesSection}
CREATOR'S PROFILE & COMMERCIAL TERMS:
${profileText}

BRAND'S PITCH:
${pitchText}

LANGUAGE & CURRENCY INSTRUCTIONS:
- Respond in the SAME language that the pitch was written in (e.g. if the pitch is in Spanish, French, German, Hindi, Portuguese, Japanese, etc., write the reasons, trade-offs, toolkit advice, written reply, questions, and explanations in that language). The JSON keys and the "verdict" string value ("Good Fit", "Risky", "Bad Fit") must remain in English.
- Correctly interpret ANY currency symbol or code mentioned (e.g. $, €, £, ₹, ¥, ₩, CAD, AUD, AED, etc.) without assuming INR or any single currency by default.

COMPREHENSIVE 17-FACTOR EVALUATION:
Analyze the pitch across all 17 strategic factors:
1. Compensation (rates, monetary fee vs unpaid/gifted, minimum rate floor alignment)
2. Deliverables (formats, quantities, dedicated vs integrated scope)
3. Timeline (turnaround, deadlines, rush pressure)
4. Exclusivity (duration, competitor restrictions, category breadth)
5. Usage Rights (organic vs paid ads, duration, perpetuity risk)
6. Whitelisting (Spark Ads, Meta ad account access, dark posting)
7. Paid Advertising (creator likeness in paid ads, TV, print)
8. Revision Requirements (revision rounds, reshoot fees)
9. Product-Only Compensation (gifted/product-only vs monetary pay)
10. Contract Conditions (payment terms Net 30/60, indemnification, cancellation clauses)
11. Niche Alignment (primary/secondary niche match, content topic fit)
12. Audience Alignment (demographics, age, location, authenticity match)
13. Brand Relevance (brand credibility, product reputation, industry fit)
14. Opportunity Cost (production effort and calendar lock vs earnings)
15. Potential Creator Upside (portfolio prestige, long-term ambassador potential, audience growth)
16. Risk (reputation damage, audience backlash, payment default risk, predatory clauses)
17. Negotiation Leverage (creator strengths, pricing leverage, missing details to exploit)

CRITICAL ANTI-HALLUCINATION & EVIDENCE RULES (STRICT ENFORCEMENT):
- NEVER invent, fabricate, or hallucinate follower counts, engagement rates, impressions/reach, audience demographics, brand reputation, creator history, or sales/ROI projections.
- If audience, reach, engagement, or demographic data is not explicitly provided or verifiable in the pitch or profile, state "Unknown / Requires Verification".
- If brand reputation, past campaign history, or financial performance is not explicitly verified in the text, do NOT invent claims or assumptions.
- NEVER guarantee sales, conversions, revenue, or return on investment (ROI). All upside projections must be clearly identified as non-guaranteed AI estimates.

CRITICAL TRADE-OFF REASONING INSTRUCTIONS:
- Do NOT automatically reject a deal just because the niche isn't a 100% exact match.
- Balance financial value, audience risk, authenticity, portfolio value, brand credibility, future opportunities, and opportunity cost. For example: An off-niche consumer lifestyle or tech accessory deal offering strong pay (e.g., ₹40,000 / $1,000+) with clear deliverables and standard rights should be evaluated holistically as a strategic opportunity ("Worth Negotiating" or "Consider"), not a hard decline.
- Action Recommendation MUST be one of: "Strong Fit", "Worth Negotiating", "Consider", "Decline".
- Provide a clear, nuanced plain-English "recommendation_explanation" explaining the strategic balancing act.
- "verdict" MUST remain exactly one of: "Good Fit", "Risky", "Bad Fit".

MANDATORY SECTIONS IN JSON RESPONSE:
1. "verdict": "Good Fit" | "Risky" | "Bad Fit"
2. "recommendation": "Strong Fit" | "Worth Negotiating" | "Consider" | "Decline"
3. "recommendation_explanation": "Detailed plain-English trade-off explanation explaining why this recommendation was given based on compensation vs niche fit, rights vs effort, etc."
4. "creator_upside_estimates": {
     "follower_growth": "AI estimate of potential follower discovery / growth (e.g. +300 to +800 followers via brand reposts & campaign tags)",
     "potential_reach": "AI estimate of potential reach and impression volume across formats",
     "engagement_potential": "AI estimate of expected community engagement, comment activity, and shareability",
     "portfolio_value": "AI assessment of portfolio, media kit, and case study prestige",
     "brand_credibility": "AI assessment of authority and credibility boost in creator's niche",
     "future_collaboration": "AI projection of recurring retainer, ambassadorship, or expanded deal potential",
     "networking_value": "AI assessment of agency, brand marketing team, and industry connections",
     "revenue_value": "AI assessment of total direct and indirect monetization value (base fee, royalties, affiliate)",
     "audience_expansion": "AI assessment of cross-pollination into adjacent demographics or new platforms"
   }
5. "tradeoff_analysis": {
     "financial_value": "Assessment of compensation vs deliverable effort & creator's rate floor",
     "niche_and_audience_fit": "Analysis of niche synergy, authenticity, and audience relevance",
     "rights_and_terms": "Review of usage rights, exclusivity, whitelisting, revisions, and contract terms",
     "risk_vs_upside": "Analysis of brand credibility, portfolio value, opportunity cost, and reputation risk",
     "negotiation_leverage": "Key leverage points the creator can use in counter-negotiations"
   }
6. "key_factors": Array of 5 to 10 relevant factors from the 17 factors:
   [
     { "factor": "Factor Name", "status": "Positive" | "Warning" | "Negative" | "Unspecified", "detail": "Short 1-line assessment" }
   ]
7. "reasons": Array of 2-3 concise summary bullet points referencing specific pitch text/numbers.
8. "highlight_phrases": Array of exact, verbatim substrings from the pitch that triggered reasons or flags.
9. "manipulation_tactics": Array of pressure tactics found: [{ "tactic": "Name", "quote": "phrase", "explanation": "why" }].
10. "missing_info_questions": 2-3 specific follow-up questions to ask the brand.
11. "toolkit": {
      "what_to_negotiate": "Specific clauses, deliverables, rates, or rights to counter",
      "why": "Clear commercial reasoning explaining why this pushback is justified and beneficial",
      "target_number_or_condition": "Concrete target price, rate floor, timeline, or contract condition to propose",
      "advice": "Strategic overall negotiation guidance",
      "written_reply": "Polished, ready-to-send email or DM response template",
      "talking_points": [
        "Spoken talking point 1 for phone/video calls",
        "Spoken talking point 2 for phone/video calls",
        "Spoken talking point 3 for phone/video calls"
      ]
    }

Respond in valid JSON matching this exact structure.`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2800,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Raw Response:\n', rawText);
  return parseGeminiResponse(rawText);
}

function parseGeminiResponse(rawText) {
  let cleaned = (rawText || '').trim();

  // Strip XML/HTML style thought blocks (e.g. <thought>...</thought>)
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Attempt 1: Direct or substring JSON parse
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // If direct parse fails, try extracting between first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonSubstring);
      } catch (innerErr) {
        console.warn('Substring JSON parse failed:', innerErr);
      }
    }
  }

  // If JSON parse succeeded, extract and normalize verdict & fields
  if (parsed && typeof parsed === 'object') {
    const verdict = extractVerdict(parsed.verdict || parsed.Verdict || parsed.decision || parsed.fit || '');
    const reasons = extractReasons(parsed.reasons || parsed.Reasons || parsed.reasoning || parsed.points || parsed.details);
    const recommendation = extractRecommendation(parsed.recommendation || parsed.action_recommendation || parsed.action || '');
    const recommendationExplanation = parsed.recommendation_explanation || parsed.tradeoff_explanation || parsed.explanation || '';
    const creatorUpside = extractCreatorUpside(parsed.creator_upside_estimates || parsed.creator_upside || parsed.upside_estimates || parsed.upside || {});
    const tradeoffAnalysis = extractTradeoffAnalysis(parsed.tradeoff_analysis || parsed.tradeoffs || {});
    const keyFactors = extractKeyFactors(parsed.key_factors || parsed.factors || []);
    const highlightPhrases = extractStringArray(parsed.highlight_phrases || parsed.highlights || parsed.red_flags || parsed.phrases);
    const missingInfoQuestions = extractStringArray(parsed.missing_info_questions || parsed.follow_up_questions || parsed.questions);
    const manipulationTactics = extractManipulationTactics(parsed.manipulation_tactics || parsed.pressure_tactics || parsed.tactics);
    const toolkit = extractToolkit(
      parsed.toolkit ||
      parsed.response_toolkit ||
      parsed.responseToolkit ||
      parsed.negotiation_toolkit ||
      parsed.negotiationToolkit ||
      parsed
    );

    if (reasons.length > 0) {
      return {
        verdict,
        recommendation,
        recommendationExplanation,
        creatorUpside,
        tradeoffAnalysis,
        keyFactors,
        reasons: reasons.slice(0, 4),
        highlightPhrases,
        missingInfoQuestions,
        manipulationTactics,
        toolkit,
        rawResponse: rawText
      };
    }
  }

  // Fallback if parsing failed
  return extractFallbackResult(rawText);
}

function extractCreatorUpside(val) {
  if (!val || typeof val !== 'object') return null;
  return {
    followerGrowth: cleanModelText(val.follower_growth || val.followerGrowth || val.followers || ''),
    potentialReach: cleanModelText(val.potential_reach || val.potentialReach || val.reach || ''),
    engagementPotential: cleanModelText(val.engagement_potential || val.engagementPotential || val.engagement || ''),
    portfolioValue: cleanModelText(val.portfolio_value || val.portfolioValue || val.portfolio || ''),
    brandCredibility: cleanModelText(val.brand_credibility || val.brandCredibility || val.credibility || ''),
    futureCollaboration: cleanModelText(val.future_collaboration || val.futureCollaboration || val.future_potential || ''),
    networkingValue: cleanModelText(val.networking_value || val.networkingValue || val.networking || ''),
    revenueValue: cleanModelText(val.revenue_value || val.revenueValue || val.revenue || ''),
    audienceExpansion: cleanModelText(val.audience_expansion || val.audienceExpansion || val.expansion || '')
  };
}

function extractRecommendation(val) {
  if (!val || typeof val !== 'string') return 'Consider';
  const clean = val.trim().toLowerCase();
  if (clean.includes('strong') || clean.includes('good fit') || clean.includes('accept')) return 'Strong Fit';
  if (clean.includes('negotiat') || clean.includes('counter')) return 'Worth Negotiating';
  if (clean.includes('decline') || clean.includes('reject') || clean.includes('pass')) return 'Decline';
  return 'Consider';
}

function extractTradeoffAnalysis(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    financialValue: obj.financial_value || obj.financialValue || obj.financial || '',
    nicheAndAudienceFit: obj.niche_and_audience_fit || obj.nicheAndAudienceFit || obj.audience_fit || '',
    rightsAndTerms: obj.rights_and_terms || obj.rightsAndTerms || obj.terms || '',
    riskVsUpside: obj.risk_vs_upside || obj.riskVsUpside || obj.risk_upside || '',
    negotiationLeverage: obj.negotiation_leverage || obj.negotiationLeverage || obj.leverage || ''
  };
}

function extractKeyFactors(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') {
      return { factor: item, status: 'Warning', detail: '' };
    }
    return {
      factor: item.factor || item.name || 'Factor',
      status: normalizeFactorStatus(item.status || item.level),
      detail: item.detail || item.explanation || item.note || ''
    };
  }).filter(f => f.factor);
}

function normalizeFactorStatus(status) {
  if (!status || typeof status !== 'string') return 'Warning';
  const s = status.toLowerCase();
  if (s.includes('pos') || s.includes('good') || s.includes('pass') || s.includes('clear')) return 'Positive';
  if (s.includes('neg') || s.includes('bad') || s.includes('fail') || s.includes('risk')) return 'Negative';
  if (s.includes('warn') || s.includes('caution') || s.includes('medium')) return 'Warning';
  return 'Unspecified';
}

function extractFallbackResult(rawText) {
  console.warn('Falling back to regex text extraction for response:', rawText);
  return fallbackParse(rawText);
}

function extractVerdict(verdictStr) {
  if (typeof verdictStr !== 'string') verdictStr = String(verdictStr || '');
  const lower = verdictStr.toLowerCase().trim();

  if (lower.includes('good')) return 'Good Fit';
  if (lower.includes('bad')) return 'Bad Fit';
  if (lower.includes('risk')) return 'Risky';
  return 'Risky';
}

function cleanModelText(text) {
  if (typeof text !== 'string') return String(text || '');
  let cleaned = text.trim();
  // Strip leaked internal prompt/instruction markers and headers
  cleaned = cleaned.replace(/^\*{0,2}(?:final\s+polish|structure\s+strictly\s+matching\s+input|internal\s+instruction|system\s+note|formatting\s+note|translation\s+note|note)\*{0,2}\s*[:\-–—]\s*/i, '');
  cleaned = cleaned.replace(/\n+\*{0,2}(?:final\s+polish|structure\s+strictly\s+matching\s+input|internal\s+instruction|system\s+note|formatting\s+note)\*{0,2}.*$/i, '');
  cleaned = cleaned.replace(/\*{0,2}final\s+polish\*{0,2}/gi, '');
  cleaned = cleaned.replace(/structure\s+strictly\s+matching\s+input/gi, '');
  return cleaned.trim();
}

function extractReasons(reasonsVal) {
  if (Array.isArray(reasonsVal)) {
    return reasonsVal.map(item => {
      let str = '';
      if (typeof item === 'string') str = item.trim();
      else if (item && typeof item === 'object') {
        str = item.text || item.reason || item.point || item.description || Object.values(item).join(' - ');
      } else {
        str = String(item);
      }
      return cleanModelText(str);
    }).filter(Boolean);
  }

  if (typeof reasonsVal === 'string' && reasonsVal.trim()) {
    return reasonsVal.split('\n')
      .map(l => cleanModelText(l.replace(/^[\s\-•*\d.)]+/, '')))
      .filter(Boolean);
  }

  return [];
}

function extractStringArray(val) {
  if (Array.isArray(val)) {
    return val.map(item => {
      let str = '';
      if (typeof item === 'string') str = item.trim();
      else if (item && typeof item === 'object') {
        str = item.question || item.phrase || item.text || Object.values(item).join(' ');
      } else {
        str = String(item).trim();
      }
      return cleanModelText(str);
    }).filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return val.split('\n')
      .map(l => cleanModelText(l.replace(/^[\s\-•*\d.)]+/, '')))
      .filter(Boolean);
  }
  return [];
}

function extractManipulationTactics(val) {
  if (!Array.isArray(val)) return [];

  return val.map(item => {
    if (!item) return null;
    if (typeof item === 'string') {
      return {
        tactic: 'Pressure Tactic',
        quote: cleanModelText(item),
        explanation: 'Uses psychological pressure to influence decision-making.'
      };
    }
    if (typeof item === 'object') {
      const tactic = item.tactic || item.name || item.type || 'Pressure Tactic';
      const quote = item.quote || item.phrase || item.text || '';
      const explanation = item.explanation || item.reason || item.description || '';
      if (!quote && !explanation) return null;
      return {
        tactic: cleanModelText(String(tactic)),
        quote: cleanModelText(String(quote)),
        explanation: cleanModelText(String(explanation))
      };
    }
    return null;
  }).filter(Boolean);
}

function extractToolkit(val) {
  if (!val || typeof val !== 'object') return null;

  const rawWhat = typeof (val.what_to_negotiate || val.whatToNegotiate || val.terms_to_negotiate || val.what) === 'string'
    ? (val.what_to_negotiate || val.whatToNegotiate || val.terms_to_negotiate || val.what).trim()
    : '';
  const whatToNegotiate = cleanModelText(rawWhat);

  const rawWhy = typeof (val.why || val.rationale || val.reason || val.why_it_matters) === 'string'
    ? (val.why || val.rationale || val.reason || val.why_it_matters).trim()
    : '';
  const why = cleanModelText(rawWhy);

  const rawTarget = typeof (val.target_number_or_condition || val.targetNumberOrCondition || val.target || val.target_rate || val.counter_target) === 'string'
    ? (val.target_number_or_condition || val.targetNumberOrCondition || val.target || val.target_rate || val.counter_target).trim()
    : '';
  const targetNumberOrCondition = cleanModelText(rawTarget);

  const rawAdvice = typeof val.advice === 'string'
    ? val.advice.trim()
    : (typeof val.Advice === 'string' ? val.Advice.trim() : '');
  const advice = cleanModelText(rawAdvice);

  const rawReply = typeof (val.written_reply || val.writtenReply || val.reply || val.WrittenReply || val.message || val.reply_message) === 'string'
    ? (val.written_reply || val.writtenReply || val.reply || val.WrittenReply || val.message || val.reply_message).trim()
    : '';
  const writtenReply = cleanModelText(rawReply);

  const talkingPoints = extractStringArray(val.talking_points || val.talkingPoints || val.points || val.TalkingPoints || val.talking_points_list);

  if (!advice && !writtenReply && talkingPoints.length === 0 && !whatToNegotiate) {
    return null;
  }

  return {
    whatToNegotiate,
    why,
    targetNumberOrCondition,
    advice,
    writtenReply,
    talkingPoints
  };
}

function fallbackParse(text) {
  let verdict = 'Risky';
  const lower = text.toLowerCase();

  // Search for verdict in text
  const verdictMatch = text.match(/(?:verdict|fit|evaluation)["':\s]*["']?(Good Fit|Risky|Bad Fit|Good|Bad)/i);
  if (verdictMatch) {
    verdict = extractVerdict(verdictMatch[1]);
  } else if (lower.includes('good fit')) {
    verdict = 'Good Fit';
  } else if (lower.includes('bad fit')) {
    verdict = 'Bad Fit';
  }

  // Extract bullet points or numbered lines
  const lines = text.split('\n');
  let reasons = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line looks like a bullet point or numbered item
    if (/^[\-•*]\s+/.test(trimmed) || /^\d+[\.\)]\s+/.test(trimmed)) {
      const cleanReason = trimmed.replace(/^[\-•*\d.)]+\s*/, '').trim();
      // Skip if this line is just the verdict declaration
      if (!cleanReason.toLowerCase().startsWith('verdict:')) {
        reasons.push(cleanReason);
      }
    }
  }

  // If no bullet points found, extract quoted parts or substantive sentences
  if (reasons.length === 0) {
    const cleanLines = lines
      .map(l => l.trim())
      .filter(l => l.length > 20 && !l.startsWith('{') && !l.startsWith('}') && !l.startsWith('```'));
    reasons = cleanLines.slice(0, 3);
  }

  if (reasons.length === 0) {
    reasons.push('Evaluation completed. Review the full response details below.');
  }

  return {
    verdict,
    reasons: reasons.slice(0, 3),
    highlightPhrases: [],
    missingInfoQuestions: [],
    manipulationTactics: [],
    toolkit: null,
    rawResponse: text
  };
}

// ============================================
// Contract Fine-Print Translator
// Analyzes contract clauses and explains them
// in plain English for content creators.
// ============================================

async function explainContract(contractText) {
  const prompt = `You are an expert contract legal advisor and creator rights advocate translating contract fine-print for content creators, influencers, and UGC artists.
Systematically analyze the following contract or agreement text. Identify and flag all clauses that impact the creator, specifically evaluating all of the following 9 key risk areas:

1. PERPETUAL USAGE: In-perpetuity licenses, worldwide rights without expiration, irrevocable rights.
2. EXCLUSIVITY: Category restrictions, competitor bans, overly long pre/post-campaign blackout windows.
3. WHITELISTING: Spark Ads, Meta Partnership Ads, dark posting permissions, ad account access without duration cap.
4. PAID ADVERTISING: Creator likeness, voice, or image used in paid ads, TV, print, or out-of-home media without extra license fees.
5. UNLIMITED REVISIONS: Uncapped edits, reshoot obligations, or subjective approval clauses without extra compensation.
6. NON-COMPETE: Restrictions on working with other brands, competing industries, or future sponsors.
7. TERMINATION WITHOUT PAYMENT: Unilateral cancellation by brand without paying for completed work or kill fees.
8. INDEMNIFICATION: One-sided liability, creator paying brand legal defense fees, uncapped indemnities.
9. BROAD CONTENT RIGHTS & UNUSUAL TERMS: Moral rights waivers, AI training rights, sublicensing to third parties, Net 60/90+ payment delays, audit penalties.

CONTRACT TEXT:
${contractText}

For each notable or flagged clause identified, provide:
1. "quote": The exact clause or sentence quoted verbatim from the contract text.
2. "title": A clear title for the clause (e.g., "Perpetual Usage Rights", "Broad Non-Compete", "Unilateral Termination Without Pay", "Uncapped Indemnification", "Unlimited Revisions", "Ad Whitelisting Rights").
3. "category": The specific category (e.g. "Usage Rights", "Exclusivity", "Paid Ads / Whitelisting", "Revisions", "Termination", "Indemnification", "Non-Compete", "Content Rights", "Payment Terms").
4. "severity": "High Risk" | "Moderate Risk" | "Watch Out"
5. "meaning": A clear, plain-English explanation of what this clause means in practice for the creator (no legal jargon).
6. "why_it_matters": Why this clause matters to the creator, hidden commercial/legal risks, and specific counter-proposals or contract edits to negotiate.

Also provide:
- "summary": A 1-2 sentence overall assessment of contract fairness.
- "fairness_score": A score from 1 (Predatory) to 10 (Creator-Friendly).
- "key_recommendation": Primary action recommendation (e.g., "Sign with standard edits", "Require major revision before signing", "Do not sign as written").

Respond in valid JSON matching this exact structure:
{
  "summary": "1-2 sentence overall assessment of the contract.",
  "fairness_score": 6,
  "key_recommendation": "Require revision of usage rights and termination clauses before signing.",
  "clauses": [
    {
      "quote": "Exact contract clause quoted",
      "title": "Clause Title",
      "category": "Usage Rights",
      "severity": "High Risk",
      "meaning": "Plain-English meaning in practice",
      "why_it_matters": "Why this matters and what to negotiate"
    }
  ]
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2500,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Contract Raw Response:\n', rawText);
  return parseContractResponse(rawText);
}

function parseContractResponse(rawText) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for contract:', inner);
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const fairnessScore = typeof parsed.fairness_score === 'number' ? parsed.fairness_score : (typeof parsed.fairnessScore === 'number' ? parsed.fairnessScore : null);
    const keyRecommendation = typeof (parsed.key_recommendation || parsed.keyRecommendation || parsed.recommendation) === 'string'
      ? (parsed.key_recommendation || parsed.keyRecommendation || parsed.recommendation).trim()
      : '';
    const clausesRaw = Array.isArray(parsed.clauses) ? parsed.clauses : [];

    const clauses = clausesRaw.map(c => {
      if (!c || typeof c !== 'object') return null;
      const quote = typeof c.quote === 'string' ? c.quote.trim() : '';
      const title = typeof c.title === 'string' ? c.title.trim() : 'Contract Clause';
      const category = typeof c.category === 'string' ? c.category.trim() : 'General Terms';
      let severity = typeof c.severity === 'string' ? c.severity.trim() : 'Watch Out';
      if (!['High Risk', 'Moderate Risk', 'Watch Out'].includes(severity)) {
        if (severity.toLowerCase().includes('high')) severity = 'High Risk';
        else if (severity.toLowerCase().includes('mod')) severity = 'Moderate Risk';
        else severity = 'Watch Out';
      }
      const meaning = typeof c.meaning === 'string' ? c.meaning.trim() : '';
      const whyItMatters = typeof (c.why_it_matters || c.whyItMatters || c.importance) === 'string'
        ? (c.why_it_matters || c.whyItMatters || c.importance).trim()
        : '';

      return {
        quote,
        title,
        category,
        severity,
        meaning,
        why_it_matters: whyItMatters
      };
    }).filter(c => c && (c.meaning || c.quote));

    return {
      summary,
      fairnessScore,
      keyRecommendation,
      clauses,
      rawResponse: rawText
    };
  }

  // Fallback if parsing was not a structured JSON
  return {
    summary: 'Here is the plain-English breakdown of the contract clauses.',
    fairnessScore: null,
    keyRecommendation: '',
    clauses: [
      {
        quote: 'Contract text provided',
        title: 'Overview',
        category: 'General',
        severity: 'Watch Out',
        meaning: cleaned.substring(0, 300) + (cleaned.length > 300 ? '…' : ''),
        why_it_matters: 'Review these terms carefully before signing.'
      }
    ],
    rawResponse: rawText
  };
}

// ============================================
// Multi-Pitch Comparison
// Compares 2-3 saved pitches side-by-side,
// recommends which to prioritize, and details
// trade-offs (pay vs niche fit vs risk).
// ============================================

async function comparePitches(pitches, creatorProfile = null) {
  let profileSection = '';
  if (creatorProfile) {
    const p = creatorProfile;
    const parts = [];
    if (p.name) parts.push(`Creator Name: ${p.name}`);
    if (p.main_niche) parts.push(`Primary Niche: ${p.main_niche}`);
    if (p.min_acceptable_payment) parts.push(`Min Payment Floor: ${p.min_acceptable_payment}`);
    if (p.typical_rates) parts.push(`Standard Rate Card: ${p.typical_rates}`);
    if (p.dealbreakers) parts.push(`Personal Dealbreakers: ${p.dealbreakers}`);
    if (parts.length) profileSection = `CREATOR PROFILE BENCHMARKS:\n${parts.join('\n')}\n`;
  }

  const formattedList = pitches.map((p, idx) => `
--- PITCH #${idx + 1} ---
Original Pitch Text:
${p.pitch_text}

Creator Profile Used:
${p.profile_text || 'Standard profile'}

Previous Verdict: ${p.verdict}
Evaluation Reasons:
${p.reasoning}
`).join('\n');

  const prompt = `You are a creator business advisor comparing ${pitches.length} brand collaboration pitches for a content creator.
${profileSection}
Compare these pitches directly, recommend which to prioritize, and explain the key trade-offs between them (compensation/pay vs. niche alignment vs. risk/exclusivity). Reference the creator's payment floor and niche preferences when evaluating which pitch offers the highest value.

${formattedList}

Respond in valid JSON matching this exact structure:
{
  "recommendation": {
    "top_choice_index": 1,
    "top_choice_title": "Pitch #1",
    "rationale": "Clear 2-sentence explanation of why this pitch is the best option to prioritize over the others."
  },
  "tradeoffs": [
    {
      "pitch_index": 1,
      "preview": "Short 1-line preview of the pitch",
      "verdict": "Good Fit",
      "compensation": "Analysis of pay/compensation terms",
      "niche_fit": "Analysis of niche and audience alignment",
      "risk_level": "Analysis of exclusivity, deliverables, or hidden risks",
      "priority_rank": 1
    }
  ],
  "action_plan": "Specific advice on next steps (e.g. which to accept, what to negotiate on the second choice, which to decline)."
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Compare Raw Response:\n', rawText);
  return parseCompareResponse(rawText, pitches);
}

function parseCompareResponse(rawText, originalPitches) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for compare:', inner);
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    return {
      recommendation: parsed.recommendation || {
        top_choice_index: 1,
        top_choice_title: 'Pitch #1',
        rationale: 'Review the side-by-side trade-offs below to decide on your priority.'
      },
      tradeoffs: Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : [],
      actionPlan: parsed.action_plan || parsed.actionPlan || '',
      rawResponse: rawText
    };
  }

  // Fallback
  return {
    recommendation: {
      top_choice_index: 1,
      top_choice_title: 'Pitch #1',
      rationale: 'Comparison completed. Review the details below.'
    },
    tradeoffs: originalPitches.map((p, i) => ({
      pitch_index: i + 1,
      preview: p.pitch_text.substring(0, 60) + '…',
      verdict: p.verdict,
      compensation: 'Review compensation in evaluation reasoning.',
      niche_fit: 'Review niche alignment in evaluation reasoning.',
      risk_level: 'Review clauses in evaluation reasoning.',
      priority_rank: i + 1
    })),
    actionPlan: 'Prioritize pitches with clear compensation and well-defined deliverables.',
    rawResponse: rawText
  };
}

// ============================================
// Pattern Summary from History ("Your Patterns")
// Connects evaluation history to creator's
// saved profile benchmarks & rate floor.
// ============================================

async function generatePatternSummary(evaluations, creatorProfile = null) {
  const goodFitCount = evaluations.filter(e => e.verdict === 'Good Fit').length;
  const riskyCount = evaluations.filter(e => e.verdict === 'Risky').length;
  const badFitCount = evaluations.filter(e => e.verdict === 'Bad Fit').length;

  const sampleSummaries = evaluations.slice(0, 15).map((e, idx) => {
    const preview = e.pitch_text.length > 100 ? e.pitch_text.substring(0, 100) + '…' : e.pitch_text;
    const reasoningSnippet = e.reasoning.split('\n').filter(r => r.trim()).slice(0, 2).join('; ');
    return `[#${idx + 1}] Verdict: ${e.verdict} | Pitch snippet: "${preview}" | Key reasoning: ${reasoningSnippet}`;
  }).join('\n');

  let profileSection = 'No specific profile benchmarks saved. Analyze patterns generally.';
  if (creatorProfile) {
    const p = creatorProfile;
    const parts = [];
    if (p.name) parts.push(`Creator Name: ${p.name}`);
    if (p.main_niche) parts.push(`Primary Niche: ${p.main_niche}`);
    if (p.secondary_niches) parts.push(`Secondary Niches: ${p.secondary_niches}`);
    if (p.typical_rates) parts.push(`Standard Rate Card: ${p.typical_rates}`);
    if (p.min_acceptable_payment) parts.push(`MINIMUM Acceptable Payment Floor: ${p.min_acceptable_payment}`);
    if (p.preferred_industries) parts.push(`Preferred Industries: ${p.preferred_industries}`);
    if (p.unwanted_industries) parts.push(`Excluded / Unwanted Categories: ${p.unwanted_industries}`);
    if (p.dealbreakers) parts.push(`Personal Dealbreakers: ${p.dealbreakers}`);
    if (p.exclusivity_preferences) parts.push(`Exclusivity Limits: ${p.exclusivity_preferences}`);
    if (p.unpaid_collab_rules) parts.push(`Unpaid/Gifted Rules: ${p.unpaid_collab_rules}`);
    if (parts.length > 0) profileSection = parts.join('\n');
  }

  const prompt = `You are an elite talent manager and creator business strategist analyzing a content creator's past brand pitch evaluations and connecting them to their personal profile benchmarks and rate preferences.

SAVED CREATOR PROFILE BENCHMARKS:
${profileSection}

EVALUATION HISTORY DATA:
Total saved evaluations: ${evaluations.length}
Good Fit count: ${goodFitCount}
Risky count: ${riskyCount}
Bad Fit count: ${badFitCount}

Evaluations detail:
${sampleSummaries}

ANALYSIS INSTRUCTIONS:
Connect the history patterns directly to the creator's saved profile preferences, rate floor, and niche rules:
1. Rate & Payment Floor Alignment: Note whether incoming pitches meet or fall below their minimum acceptable payment floor or typical rates (e.g. "X% of incoming pitches offer uncompensated product or fall below your minimum payment floor of ₹...").
2. Niche & Category Fit: Compare the categories reaching out against their primary niche and unwanted categories.
3. Common Red Flags vs Personal Dealbreakers: Highlight recurring clashes with their dealbreakers (such as perpetual rights, unpaid whitelisting, or long exclusivity).
4. High-Leverage Strategic Takeaway: Provide 1 concrete, actionable business takeaway to help the creator negotiate higher rates or screen inbound deals faster.

Provide 3 to 4 concise, factual, profile-aware pattern observations.

Respond in valid JSON matching this exact structure:
{
  "patterns": [
    "Profile-aware observation 1 with specific rate or niche context",
    "Profile-aware observation 2 with specific terms or dealbreaker context",
    "Profile-aware observation 3 with specific inbound pitch trend",
    "Actionable strategic takeaway for the creator"
  ]
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 1200,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Patterns Raw Response:\n', rawText);
  return parsePatternResponse(rawText, goodFitCount, riskyCount, badFitCount, evaluations.length);
}

function parsePatternResponse(rawText, goodFitCount, riskyCount, badFitCount, totalCount) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for patterns:', inner);
      }
    }
  }

  if (parsed && Array.isArray(parsed.patterns) && parsed.patterns.length > 0) {
    return parsed.patterns.slice(0, 4);
  }

  // Factual deterministic fallback based strictly on counts
  const fallback = [];
  fallback.push(`You have evaluated ${totalCount} pitches so far (${goodFitCount} Good Fit, ${riskyCount} Risky, ${badFitCount} Bad Fit).`);
  if (badFitCount + riskyCount > 0) {
    fallback.push(`${badFitCount + riskyCount} out of ${totalCount} pitches had issues such as missing compensation, rates below floor, vague deliverables, or exclusivity terms.`);
  }
  if (goodFitCount > 0) {
    fallback.push(`${goodFitCount} pitch${goodFitCount === 1 ? '' : 'es'} met all criteria with clear pay and well-defined terms.`);
  }

  return fallback;
}

// ============================================
// Brand Mode Evaluation: Evaluate Creator for Brand
// Evaluates a creator against a specific saved brand profile
// across Audience Fit, Creator Quality, Claims vs Evidence,
// and Missing Information with questions to ask.
// ============================================

async function evaluateCreatorForBrand(creatorText, brandProfileText, brandRules = '') {
  let rulesSection = '';
  if (brandRules && brandRules.trim()) {
    rulesSection = `
IMPORTANT — BRAND DEALBREAKER RULES & MANDATES:
The brand has set these dealbreakers. Test the creator against EACH rule FIRST:
${brandRules.trim()}

---
`;
  }

  const prompt = `You are an elite influencer marketing director and creator talent scout evaluating a content creator for a specific brand collaboration.
Evaluate this creator against the SPECIFIC saved Brand Profile + campaign requirements provided below — not generic assumptions. The same creator can be excellent for one brand and poor for another.

${rulesSection}
BRAND PROFILE & CAMPAIGN REQUIREMENTS:
${brandProfileText}

CREATOR SUBMISSION / PITCH / PROFILE / MEDIA KIT TEXT:
${creatorText}

EVALUATION CRITERIA & STRICT RULES:
1. Practical Recommendation Categories:
   - Instead of a simple good/bad label, choose EXACTLY one practical category:
     * "Strongly Consider" — Exceptional audience alignment, verified metrics, reasonable pricing, strong brand synergy.
     * "Consider" — Solid fit with good potential; acceptable alignment with brand goals, minor items to align.
     * "Request More Information" — Potential match, but critical data is missing (e.g. reach, analytics, demographics) before committing.
     * "Negotiate" — High potential creator, but current quote or terms (usage rights, deliverables, exclusivity) need counter-offer.
     * "Low Priority" — Marginal audience fit or poor value compared to campaign goals; keep on bench or pursue only if budget remains.
     * "Reject" — Direct mismatch with brand positioning, prohibited categories, excessive price, or conflicting audience demographics.
   - Provide a nuanced plain-English "recommendationExplanation" explaining WHY this specific recommendation was chosen for this brand.

2. Cost vs Value (Pricing Assessment):
   - Analyze any price stated by the creator (in ANY currency, e.g. ₹40,000, $800, £500, etc., or dynamic amounts) against:
     followers, reach, engagement, audience relevance, content quality, deliverables, platform, usage rights, exclusivity, and campaign objective.
   - Output "pricingAssessment": exactly one of "Potentially Fair" | "Expensive" | "Strong Value" | "Unspecified / Rate on Request".
   - Include clear "reasoning" explaining whether the fee is justified by their reach, deliverables, and commercial value.
   - STRICT RULE: Do NOT state an exact speculative market rate unless there's reliable data behind it.
   - NOTE: The pricing logic must work dynamically for ANY amount a creator quotes, not just any single example figure. If no price is stated, note that pricing is on request.

3. Potential Brand Benefit (AI Estimates):
   - Provide realistic AI estimates for:
     * "potentialReach": Estimated reach and view impressions across primary platforms.
     * "audienceRelevance": Estimated percentage and demographic overlap with brand's target customer profile.
     * "awarenessPotential": Estimated brand lift and discovery in target niche.
     * "engagementPotential": Estimated interaction, comment quality, and community buzz.
     * "purchaseIntentPotential": Estimated conversion signals, click-through tendency, and buyer trust.
     * "contentValue": Estimated creative and production utility (e.g. ad whitelisting, UGC creative asset reuse, organic authority).
     * "longTermCreatorValue": Estimated lifetime brand partnership upside (e.g. recurring ambassadorship, product co-creation, affiliate scaling).
   - STRICT RULE: Label these clearly as AI estimates and projections, never as guaranteed commercial outcomes.

4. Audience Fit & Metrics Verification (STRICT ANTI-HALLUCINATION RULES):
   - Score niche relevance, audience relevance, geography, demographics, interests, and potential customer relevance (how well their audience maps to the brand's Ideal Customer Profile).
   - STRICT RULE: ONLY score what available evidence supports (e.g. "9/10", "8/10").
   - If followers, engagement, reach, geography, age, or demographics are unknown or missing from the creator's pitch or profile, state "Unknown / Requires Verification" for that specific dimension.
   - NEVER invent, fabricate, or hallucinate followers, engagement, reach, audience demographics, brand reputation, creator history, or sales/ROI projections.
   - NEVER promise or guarantee sales or ROI projections. Label all benefits as AI estimates.

5. Creator Quality:
   - Evaluate content consistency, quality & style, engagement, average views, reach, audience authenticity, professionalism, previous collaborations, and brand suitability/safety.
   - STRICT RULE: NEVER assume fake followers or poor quality without evidence. If evidence is lacking or unverified, use "Potential verification required" instead. Status must be one of: "Strong", "Moderate", "Potential verification required".

6. Claims vs Evidence:
   - Explicitly separate what the creator SAYS (self-reported claims like "my engagement is very good", "loyal audience", "100K reach") from what evidence they actually PROVIDED (specific numbers, proof, analytics screenshots, portfolio links).
   - Explicitly list what's still MISSING for verification.
   - Assign an overall "evidenceQuality": "Verified" | "Partial" | "Unverified / Self-Claimed" with a one-line explanation.

7. Missing Information & Questions to Ask:
   - Explicitly list what the brand still needs (e.g. average Reel views, last 10-post performance, audience demographics breakdown, audience top cities/locations, verified engagement rate, official media kit, rate card, proposed deliverables, past campaign case studies, usage rights terms, calendar availability).
   - Generate 3 to 5 direct, ready-to-send "Questions to Ask This Creator" to close data gaps.

Respond in valid JSON matching this exact structure:
{
  "verdict": "Good Fit",
  "recommendation": "Strongly Consider",
  "recommendationExplanation": "Plain-English strategic explanation tailored to this brand's campaign objective and product.",
  "executiveSummary": "2-sentence executive summary for the brand's marketing team.",
  "costVsValue": {
    "statedPrice": "Quoted price (e.g. ₹40,000, $800, etc.) or 'None stated / Rate on request'",
    "pricingAssessment": "Potentially Fair",
    "reasoning": "Detailed plain-English analysis testing the price against followers, reach, engagement, audience relevance, content quality, deliverables, usage rights, and campaign goals without stating speculative exact market rates."
  },
  "potentialBrandBenefit": {
    "disclaimer": "AI estimates and projections based on submitted creator signals — not guaranteed outcomes",
    "potentialReach": "Estimated reach volume",
    "audienceRelevance": "Estimated audience match %",
    "awarenessPotential": "Estimated discovery lift",
    "engagementPotential": "Estimated interactions & buzz",
    "purchaseIntentPotential": "Estimated buyer intent & conversion signals",
    "contentValue": "Estimated creative and ad reuse value",
    "longTermCreatorValue": "Estimated ambassadorship upside"
  },
  "audienceFit": {
    "overallScore": "8/10",
    "nicheRelevance": { "score": "8/10", "assessment": "Evidence-backed explanation of niche alignment" },
    "audienceRelevance": { "score": "8/10", "assessment": "Evidence-backed explanation of audience match" },
    "geographyFit": { "score": "7/10 or Unverified", "assessment": "Evidence-backed explanation of location fit" },
    "demographicsFit": { "score": "8/10 or Unverified", "assessment": "Evidence-backed explanation of age/gender fit" },
    "interestsAlignment": { "score": "9/10", "assessment": "Evidence-backed explanation of topic/interest overlap" },
    "customerRelevance": { "score": "8/10", "assessment": "How well creator audience maps to Ideal Customer Profile" }
  },
  "creatorQuality": {
    "overallAssessment": "Summary of creator quality based on available signals",
    "factors": [
      { "factor": "Content Consistency", "status": "Strong", "detail": "Specific observation" },
      { "factor": "Content Quality & Style", "status": "Strong", "detail": "Specific observation" },
      { "factor": "Engagement Rate", "status": "Moderate", "detail": "Specific observation" },
      { "factor": "Average Views & Reach", "status": "Potential verification required", "detail": "Specific observation" },
      { "factor": "Audience Authenticity", "status": "Potential verification required", "detail": "Specific observation" },
      { "factor": "Professionalism & Communication", "status": "Strong", "detail": "Specific observation" },
      { "factor": "Previous Brand Collaborations", "status": "Moderate", "detail": "Specific observation" },
      { "factor": "Brand Suitability & Safety", "status": "Strong", "detail": "Specific observation" }
    ]
  },
  "claimsVsEvidence": {
    "evidenceQuality": "Partial",
    "evidenceExplanation": "One-line clear explanation of evidence sufficiency e.g. Creator provided follower counts and rate, but engagement and audience demographics remain unverified.",
    "creatorClaims": [
      "Creator claims..."
    ],
    "verifiedEvidence": [
      "Evidence actually provided..."
    ],
    "missingForVerification": [
      "What is still missing..."
    ]
  },
  "commercialAlignment": {
    "budgetStatus": "Within Budget",
    "deliverablesFit": "Assessment of deliverables vs campaign goals",
    "timelineFit": "Assessment of turnaround and campaign schedule",
    "rightsAndExclusivity": "Assessment of usage rights and exclusivity"
  },
  "missingInformation": [
    "Item 1 needed by brand",
    "Item 2 needed by brand",
    "Item 3 needed by brand"
  ],
  "questionsToAskCreator": [
    "Question 1 for creator",
    "Question 2 for creator",
    "Question 3 for creator",
    "Question 4 for creator"
  ],
  "reasons": [
    "Key strategic reason 1",
    "Key strategic reason 2",
    "Key strategic reason 3"
  ]
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2600,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Brand Evaluation Raw Response:\n', rawText);
  return parseBrandEvaluationResponse(rawText);
}

function parseBrandEvaluationResponse(rawText) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for brand eval:', inner);
      }
    }
  }

  const validRecs = [
    'Strongly Consider',
    'Consider',
    'Request More Information',
    'Negotiate',
    'Low Priority',
    'Reject'
  ];

  if (parsed && typeof parsed === 'object') {
    let rec = parsed.recommendation || '';
    if (!validRecs.includes(rec)) {
      const rLower = rec.toLowerCase();
      if (rLower.includes('strongly') || rLower.includes('strong match')) rec = 'Strongly Consider';
      else if (rLower.includes('negotiat')) rec = 'Negotiate';
      else if (rLower.includes('request') || rLower.includes('more info') || rLower.includes('need more')) rec = 'Request More Information';
      else if (rLower.includes('low') || rLower.includes('priority')) rec = 'Low Priority';
      else if (rLower.includes('reject') || rLower.includes('pass') || rLower.includes('decline') || rLower.includes('mismatch')) rec = 'Reject';
      else if (rLower.includes('consider')) rec = 'Consider';
      else rec = 'Request More Information';
    }

    let verdict = parsed.verdict;
    if (!['Good Fit', 'Risky', 'Bad Fit'].includes(verdict)) {
      if (['Strongly Consider', 'Consider'].includes(rec)) verdict = 'Good Fit';
      else if (['Request More Information', 'Negotiate', 'Low Priority'].includes(rec)) verdict = 'Risky';
      else verdict = 'Bad Fit';
    }

    return {
      verdict,
      recommendation: rec,
      recommendationExplanation: parsed.recommendationExplanation || parsed.recommendation_explanation || '',
      executiveSummary: parsed.executiveSummary || parsed.executive_summary || '',
      costVsValue: parsed.costVsValue || parsed.cost_vs_value || {
        statedPrice: 'None stated / Rate on request',
        pricingAssessment: 'Unspecified / Rate on Request',
        reasoning: 'No quoted pricing provided in creator submission.'
      },
      potentialBrandBenefit: parsed.potentialBrandBenefit || parsed.potential_brand_benefit || {},
      audienceFit: parsed.audienceFit || parsed.audience_fit || {},
      creatorQuality: parsed.creatorQuality || parsed.creator_quality || {},
      claimsVsEvidence: parsed.claimsVsEvidence || parsed.claims_vs_evidence || {},
      commercialAlignment: parsed.commercialAlignment || parsed.commercial_alignment || {},
      missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : (parsed.missing_information || []),
      questionsToAskCreator: Array.isArray(parsed.questionsToAskCreator) ? parsed.questionsToAskCreator : (parsed.questions_to_ask_creator || []),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      rawResponse: rawText
    };
  }

  // Deterministic fallback if model JSON was malformed
  return {
    verdict: 'Risky',
    recommendation: 'Request More Information',
    recommendationExplanation: 'Review the creator pitch details against your brand profile to confirm pricing and audience overlap.',
    executiveSummary: 'Creator submission received. Additional verification required before making a commercial offer.',
    costVsValue: {
      statedPrice: 'Unspecified in pitch text',
      pricingAssessment: 'Unspecified / Rate on Request',
      reasoning: 'Request an official rate card or specific quote for your required deliverables.'
    },
    potentialBrandBenefit: {
      disclaimer: 'AI estimates and projections based on submitted creator signals — not guaranteed outcomes',
      potentialReach: 'Estimated based on stated follower count',
      audienceRelevance: 'Audience alignment requires verification',
      awarenessPotential: 'Moderate brand discovery potential',
      engagementPotential: 'Community interaction pending recent analytics review',
      purchaseIntentPotential: 'Buyer trust signals require audience demographics',
      contentValue: 'Creative production utility subject to portfolio review',
      longTermCreatorValue: 'Potential for recurring campaigns if trial succeeds'
    },
    audienceFit: {
      overallScore: '6/10',
      nicheRelevance: { score: '6/10', assessment: 'General alignment with brand category' },
      audienceRelevance: { score: 'Unverified', assessment: 'Audience data not provided in submission' },
      geographyFit: { score: 'Unverified', assessment: 'Location breakdown missing' },
      demographicsFit: { score: 'Unverified', assessment: 'Demographics missing' },
      interestsAlignment: { score: '6/10', assessment: 'Topic overlap apparent' },
      customerRelevance: { score: 'Unverified', assessment: 'Need demographic data to map to Ideal Customer Profile' }
    },
    creatorQuality: {
      overallAssessment: 'Limited performance data provided in pitch',
      factors: [
        { factor: 'Content Consistency', status: 'Potential verification required', detail: 'Check recent posting cadence' },
        { factor: 'Content Quality & Style', status: 'Potential verification required', detail: 'Review portfolio links' },
        { factor: 'Engagement Rate', status: 'Potential verification required', detail: 'No verified engagement metrics attached' },
        { factor: 'Average Views & Reach', status: 'Potential verification required', detail: 'Need screenshot of 30-day analytics' },
        { factor: 'Audience Authenticity', status: 'Potential verification required', detail: 'Audit comments for genuine interactions' },
        { factor: 'Professionalism & Communication', status: 'Moderate', detail: 'Submission reviewed' },
        { factor: 'Previous Brand Collaborations', status: 'Potential verification required', detail: 'Ask for case studies' },
        { factor: 'Brand Suitability & Safety', status: 'Moderate', detail: 'No immediate brand safety concerns flagged' }
      ]
    },
    claimsVsEvidence: {
      evidenceQuality: 'Partial',
      evidenceExplanation: 'Creator submitted text claims but supporting analytics or media kit proof was not attached.',
      creatorClaims: ['Self-reported claims from pitch text'],
      verifiedEvidence: ['Initial text inquiry received'],
      missingForVerification: ['Analytics dashboard screenshots', 'Audience demographics', 'Recent view counts']
    },
    commercialAlignment: {
      budgetStatus: 'Unspecified',
      deliverablesFit: 'Review deliverables in creator response',
      timelineFit: 'Confirm delivery deadline',
      rightsAndExclusivity: 'Negotiate required usage rights'
    },
    missingInformation: [
      'Average Reel / video views over last 30 days',
      'Audience geographic distribution (top countries & cities)',
      'Audience age and gender breakdown',
      'Official media kit with verified engagement rate'
    ],
    questionsToAskCreator: [
      'Could you share your analytics screenshot for your last 30 days of reach and impressions?',
      'What percentage of your audience is based in our target geographic market?',
      'Can you provide a link or case study from a recent brand collaboration?',
      'What usage rights and ad whitelisting permissions are included in your standard rate?'
    ],
    reasons: [
      'Creator claims require verification through analytics screenshots or media kit',
      'Audience alignment with brand ideal customer profile needs confirmation',
      'Commercial terms and deliverables require formal agreement'
    ],
    rawResponse: rawText
  };
}

// ============================================
// Brand Mode: Dynamically Generate Recommended Creator Profile
// Deduces ideal creator archetype from Brand Profile data
// ============================================

async function generateRecommendedCreatorProfile(brandProfile) {
  let profileDetails = '';
  if (typeof formatBrandProfileForPrompt === 'function') {
    profileDetails = formatBrandProfileForPrompt(brandProfile);
  } else if (brandProfile) {
    profileDetails = JSON.stringify(brandProfile, null, 2);
  }

  const prompt = `You are a premier influencer marketing strategist and creator partnerships director.
Based on the following Brand Profile and Campaign Objective, dynamically deduce and design the optimal "Recommended Creator Profile" (ideal creator archetype).

CRITICAL REQUIREMENTS:
1. DYNAMIC GENERATION: Generate this dynamically from the brand's unique industry, product/service, positioning, target audience demographics/ICP, campaign objective, and budget. DO NOT hardcode or recycle a generic creator archetype.
   - For example, if the campaign objective is "Direct Sales / Conversions" with a high-ticket product, the recommended creator should possess strong buyer trust, high conversion intent, detailed review or demo formats, and mature purchasing audience demographics.
   - If the campaign objective is "Brand Awareness / Product Launch" with a mass consumer product, the recommended creator should have high viral reach, short-form visual appeal, trend momentum, and broad top-of-funnel discovery.
   - If the budget is small/nano, recommend high-engagement nano/micro creators; if the budget is substantial, recommend mid-tier or macro with paid whitelisting.
2. The profile must include these exact dimensions:
   - "niche": Primary and secondary content niche tailored to this product and audience.
   - "platform": Primary platform recommended (e.g., Instagram, YouTube, TikTok, LinkedIn) with rationale.
   - "follower_range": Recommended follower/subscriber range with rationale based on campaign budget and goals.
   - "audience_age_geo": Target audience age bracket and geographic distribution required to match brand's ICP.
   - "content_type": Recommended content formats (e.g. 60-90s Reel review, YouTube integration, TikTok unboxing, carousel guide).
   - "engagement_level": Target authentic engagement rate percentage and interaction depth benchmarks.
3. Include:
   - "archetype_title": A catchy, professional 3-5 word title for this ideal creator persona (e.g. "Practical Millennial Wellness Educator", "High-Energy B2B SaaS Reviewer").
   - "strategic_rationale": Plain-English 2-3 paragraph explanation of why this specific creator archetype is the most effective choice for the brand's campaign objective, ICP, and budget.
   - "vetting_tips": 3 concrete, actionable verification tips for evaluating creators against this archetype (e.g. what metric to check in their media kit, what to inspect in comments).

BRAND PROFILE CONTEXT:
${profileDetails || 'No specific brand profile provided. Provide a strategic creator archetype framework.'}

Respond in valid JSON matching this exact structure:
{
  "archetype_title": "string",
  "niche": "string",
  "platform": "string",
  "follower_range": "string",
  "audience_age_geo": "string",
  "content_type": "string",
  "engagement_level": "string",
  "strategic_rationale": "string",
  "vetting_tips": [
    "string",
    "string",
    "string"
  ]
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  });

  return parseRecommendedCreatorProfile(rawText, brandProfile);
}

function parseRecommendedCreatorProfile(rawText, brandProfile) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for recommended profile:', inner);
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    return {
      archetypeTitle: cleanModelText(parsed.archetype_title || 'Ideal Campaign Creator Archetype'),
      niche: cleanModelText(parsed.niche || (brandProfile ? brandProfile.preferred_niche || brandProfile.industry : 'Target Category Creator')),
      platform: cleanModelText(parsed.platform || (brandProfile ? brandProfile.preferred_platform : 'Instagram & YouTube')),
      followerRange: cleanModelText(parsed.follower_range || (brandProfile ? brandProfile.follower_range : '25K – 100K')),
      audienceAgeGeo: cleanModelText(parsed.audience_age_geo || (brandProfile ? `${brandProfile.target_age || '22–35'} · ${brandProfile.target_geography || 'Target Metros'}` : 'Core Target Demographic')),
      contentType: cleanModelText(parsed.content_type || (brandProfile ? brandProfile.content_format : 'Reels, Shorts & Carousels')),
      engagementLevel: cleanModelText(parsed.engagement_level || (brandProfile ? brandProfile.engagement_expectations : '3.5%+ with high comment depth')),
      strategicRationale: cleanModelText(parsed.strategic_rationale || 'This profile is strategically tailored to your campaign objectives and ideal customer profile.'),
      vettingTips: Array.isArray(parsed.vetting_tips) && parsed.vetting_tips.length > 0
        ? parsed.vetting_tips.map(t => cleanModelText(String(t)))
        : [
            'Verify recent 30-day view counts rather than total follower count.',
            'Inspect comment quality to ensure genuine dialogue rather than automated pods.',
            'Request demographic screenshots to confirm audience location matches your target market.'
          ],
      rawResponse: rawText
    };
  }

  // Fallback
  return {
    archetypeTitle: 'Campaign-Aligned Creator Archetype',
    niche: brandProfile ? (brandProfile.preferred_niche || brandProfile.industry || 'Category Specialist') : 'Category Specialist',
    platform: brandProfile ? (brandProfile.preferred_platform || 'Instagram / YouTube') : 'Instagram / YouTube',
    followerRange: brandProfile ? (brandProfile.follower_range || '15K – 75K') : '15K – 75K',
    audienceAgeGeo: brandProfile ? `${brandProfile.target_age || '20–35'} · ${brandProfile.target_geography || 'Target Markets'}` : '20–35 Core Demographic',
    contentType: brandProfile ? (brandProfile.content_format || 'Short-form video & carousels') : 'Short-form video & carousels',
    engagementLevel: brandProfile ? (brandProfile.engagement_expectations || '3%+ verified engagement') : '3%+ verified engagement',
    strategicRationale: 'Creator profile generated to maximize audience trust, delivery quality, and campaign objective efficiency.',
    vettingTips: [
      'Check recent 30-day analytics screenshots before signing.',
      'Examine audience comments for genuine engagement.',
      'Ensure usage rights fit your campaign timeline.'
    ],
    rawResponse: rawText
  };
}

// ============================================
// Brand Mode: Compare Multiple Creators Side-by-Side
// Analyzes Audience Fit, Engagement, Cost, Campaign Fit & Recommendation
// Explains Trade-offs without Single-Metric Bias & without ROI Guarantees
// ============================================

async function compareCreatorsForBrand(creators, brandProfile = null) {
  let profileContext = '';
  if (brandProfile) {
    if (typeof formatBrandProfileForPrompt === 'function') {
      profileContext = formatBrandProfileForPrompt(brandProfile);
    } else {
      profileContext = JSON.stringify(brandProfile);
    }
  }

  const formattedCreators = creators.map((c, idx) => `
=== CREATOR #${idx + 1}: ${c.name || 'Creator ' + (idx + 1)} ===
Stated / Quoted Price: ${c.stated_price || c.price || 'Not specified'}
Pitch / Submission / Claims / Stats:
${c.pitch_text || c.pitch || c.text || 'No pitch text provided.'}
${c.verdict ? `Previous Evaluation Verdict: ${c.verdict}` : ''}
${c.reasoning ? `Previous Key Findings: ${c.reasoning}` : ''}
`).join('\n\n');

  const prompt = `You are a strategic brand CMO and creator partnership advisor comparing ${creators.length} creators side-by-side for a brand collaboration campaign.

BRAND & CAMPAIGN CONTEXT:
${profileContext || 'General brand collaboration campaign.'}

CREATORS TO EVALUATE SIDE-BY-SIDE:
${formattedCreators}

TASK & CRITICAL RULES:
1. EVALUATE SIDE-BY-SIDE IN A STRUCTURED TABLE:
   For every creator, evaluate:
   - "creator_name": Creator name or identifier (e.g. Creator #1, @handle)
   - "audience_fit": Score (e.g. "8.5/10") and demographic/niche synergy with brand's target ICP
   - "engagement": Claimed vs verified engagement rate (e.g. "4.2% · Active comment discussion")
   - "cost": Stated price analyzed against deliverables and budget, with assessment: "Strong Value" | "Potentially Fair" | "Expensive" | "Unspecified"
   - "campaign_fit": Qualitative alignment with the brand's specific campaign objective (Awareness, Engagement, Conversions, UGC, etc.)
   - "recommendation": ONE of the 6 exact practical categories:
     "Strongly Consider" | "Consider" | "Request More Information" | "Negotiate" | "Low Priority" | "Reject"
   - "key_strength": Top strategic advantage of this creator
   - "key_risk": Main trade-off, risk, or missing verification

2. WRITTEN EXPLANATION OF TRADE-OFFS:
   Write a comprehensive 2-3 paragraph strategic analysis explaining the trade-offs between these creators (e.g., "Creator A costs more (₹45,000 vs ₹25,000), but their 85% audience overlap in your target geography and high verified engagement may justify the premium for your Product Launch objective, whereas Creator B offers a lower cost entry point but skews younger with unverified Reel views.").
   
   MANDATORY CONSTRAINTS & ANTI-HALLUCINATION RULES:
   - DO NOT JUST PICK A WINNER BY ONE METRIC: Do not select solely based on follower count, lowest price, or highest engagement in isolation. Evaluate the multi-variable trade-offs holistically.
   - DO NOT GUARANTEE ROI: Explicitly acknowledge that creator marketing returns depend on creative quality, product-market fit, and algorithmic distribution. Never promise or guarantee financial return or conversion numbers.
   - STRICT EVIDENCE RULE: If audience demographics, reach, followers, or engagement are missing for any creator, state "Unknown / Requires Verification". NEVER invent or fabricate followers, reach, demographics, brand reputation, creator history, or conversion numbers for any creator.

3. ACTIONABLE NEXT STEPS:
   Provide 2-4 tactical next steps for the brand team (e.g. specific counter-offers to make, specific verification questions to ask each creator).

Respond in valid JSON matching this exact structure:
{
  "comparison_table": [
    {
      "creator_index": 1,
      "creator_name": "string",
      "audience_fit": "string",
      "engagement": "string",
      "cost": "string",
      "cost_assessment": "Potentially Fair",
      "campaign_fit": "string",
      "recommendation": "Consider",
      "key_strength": "string",
      "key_risk": "string"
    }
  ],
  "tradeoff_analysis": "Detailed plain-English comparative trade-off explanation without single-metric bias and without ROI guarantees.",
  "next_steps": [
    "string",
    "string"
  ],
  "disclaimer": "AI estimates and trade-off comparisons are strategic decision-support analyses only and do not guarantee return on investment (ROI), conversions, or specific performance metrics."
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2500,
    responseMimeType: 'application/json'
  });

  return parseBrandCompareResponse(rawText, creators);
}

function parseBrandCompareResponse(rawText, originalCreators) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for brand compare:', inner);
      }
    }
  }

  const validRecs = [
    'Strongly Consider',
    'Consider',
    'Request More Information',
    'Negotiate',
    'Low Priority',
    'Reject'
  ];

  if (parsed && typeof parsed === 'object') {
    const rawTable = Array.isArray(parsed.comparison_table) ? parsed.comparison_table : [];
    const comparisonTable = rawTable.map((row, idx) => {
      const orig = originalCreators[idx] || {};
      let rec = row.recommendation || 'Consider';
      if (!validRecs.includes(rec)) {
        if (rec.toLowerCase().includes('strongly')) rec = 'Strongly Consider';
        else if (rec.toLowerCase().includes('more') || rec.toLowerCase().includes('info')) rec = 'Request More Information';
        else if (rec.toLowerCase().includes('negotiat')) rec = 'Negotiate';
        else if (rec.toLowerCase().includes('low') || rec.toLowerCase().includes('prior')) rec = 'Low Priority';
        else if (rec.toLowerCase().includes('reject') || rec.toLowerCase().includes('decline')) rec = 'Reject';
        else rec = 'Consider';
      }

      return {
        creatorIndex: idx + 1,
        creatorName: cleanModelText(row.creator_name || orig.name || `Creator #${idx + 1}`),
        audienceFit: cleanModelText(row.audience_fit || 'Evaluated against brand ICP'),
        engagement: cleanModelText(row.engagement || 'Review verified stats'),
        cost: cleanModelText(row.cost || orig.stated_price || orig.price || 'Unspecified'),
        costAssessment: cleanModelText(row.cost_assessment || 'Potentially Fair'),
        campaignFit: cleanModelText(row.campaign_fit || 'Campaign suitability evaluated'),
        recommendation: rec,
        keyStrength: cleanModelText(row.key_strength || 'Community alignment'),
        keyRisk: cleanModelText(row.key_risk || 'Verification needed before signing')
      };
    });

    return {
      comparisonTable,
      tradeoffAnalysis: cleanModelText(parsed.tradeoff_analysis || 'Review the multi-factor comparison above to weigh audience fit against cost and campaign goals.'),
      nextSteps: Array.isArray(parsed.next_steps) ? parsed.next_steps.map(s => cleanModelText(String(s))) : [],
      disclaimer: cleanModelText(parsed.disclaimer || 'AI estimates and trade-off analyses are strategic decision-support projections only and do not guarantee return on investment (ROI), conversions, or specific performance metrics.'),
      rawResponse: rawText
    };
  }

  // Fallback
  return {
    comparisonTable: originalCreators.map((c, i) => ({
      creatorIndex: i + 1,
      creatorName: c.name || `Creator #${i + 1}`,
      audienceFit: '7.5/10 · Moderate ICP alignment',
      engagement: 'Estimated 3.0%+ engagement',
      cost: c.stated_price || c.price || 'Not specified',
      costAssessment: 'Potentially Fair',
      campaignFit: 'Moderate fit for campaign objective',
      recommendation: 'Request More Information',
      keyStrength: 'Active audience presence',
      keyRisk: 'Needs 30-day analytics verification'
    })),
    tradeoffAnalysis: 'Creators present differing trade-offs between pricing, follower reach, and audience synergy. Review individual metrics rather than choosing on price or follower size alone.',
    nextSteps: [
      'Request 30-day analytics screenshots from both creators.',
      'Clarify exact deliverables, usage rights, and timeline before committing.'
    ],
    disclaimer: 'AI estimates and trade-off analyses are strategic decision-support projections only and do not guarantee return on investment (ROI), conversions, or specific performance metrics.',
    rawResponse: rawText
  };
}

