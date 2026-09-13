// ============================================
// Supabase Client & CRUD Operations
// Handles all database interactions:
// evaluations and personal rules.
// ============================================

let sbClient = null;

const LOCAL_EVALS_KEY = 'bfc_local_evaluations';
const LOCAL_RULES_KEY = 'bfc_local_rules';

function initSupabase() {
  const config = getConfig();
  if (typeof supabase !== 'undefined' && isSupabaseConfigured()) {
    try {
      sbClient = supabase.createClient(config.supabaseUrl, config.supabaseKey);
      console.log('[Supabase] Initialized client for:', config.supabaseUrl);
    } catch (e) {
      console.warn('[Supabase] Client initialization failed, using local storage fallback:', e);
      sbClient = null;
    }
  } else {
    sbClient = null;
  }
  return sbClient;
}

function getSupabaseClient() {
  if (!sbClient && isSupabaseConfigured()) {
    initSupabase();
  }
  return sbClient;
}

// --- Evaluations Local Helpers ---

function getLocalEvaluations() {
  try {
    const raw = localStorage.getItem(LOCAL_EVALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalEvaluations(evals) {
  try {
    localStorage.setItem(LOCAL_EVALS_KEY, JSON.stringify(evals));
  } catch (e) {
    console.warn('Could not save local evaluations:', e);
  }
}

// --- Evaluations ---

async function saveEvaluation(pitchText, profileText, verdict, reasoning) {
  const newEval = {
    id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    session_id: getSessionId(),
    pitch_text: pitchText,
    profile_text: profileText,
    verdict: verdict,
    reasoning: reasoning,
    created_at: new Date().toISOString()
  };

  // Always save locally first
  const localList = getLocalEvaluations();
  localList.unshift(newEval);
  saveLocalEvaluations(localList);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('evaluations')
        .insert([{
          session_id: getSessionId(),
          pitch_text: pitchText,
          profile_text: profileText,
          verdict: verdict,
          reasoning: reasoning
        }])
        .select();

      if (error) {
        console.warn('[Supabase] Save evaluation error, stored locally:', error.message);
      } else if (data && data.length > 0) {
        return data;
      }
    } catch (sbErr) {
      console.warn('[Supabase] Save evaluation exception, stored locally:', sbErr);
    }
  }

  return [newEval];
}

async function getEvaluations(limit = 50) {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('evaluations')
        .select('*')
        .eq('session_id', getSessionId())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        saveLocalEvaluations(data);
        return data;
      }
    } catch (e) {
      console.warn('[Supabase] Get evaluations exception, using local fallback:', e);
    }
  }

  const localList = getLocalEvaluations();
  return localList.slice(0, limit);
}

// --- Personal Rules ---

async function saveUserRules(rulesText) {
  const sessionId = getSessionId();
  try {
    localStorage.setItem(LOCAL_RULES_KEY, rulesText);
  } catch (e) {}

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('rules')
        .upsert(
          {
            session_id: sessionId,
            rules_text: rulesText,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'session_id' }
        )
        .select();

      if (!error && data) return data;
    } catch (e) {
      console.warn('[Supabase] Save rules error, stored locally:', e);
    }
  }

  return [{ session_id: sessionId, rules_text: rulesText }];
}

async function getUserRules() {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('rules')
        .select('rules_text')
        .eq('session_id', getSessionId())
        .single();

      if (!error && data?.rules_text !== undefined) {
        try { localStorage.setItem(LOCAL_RULES_KEY, data.rules_text); } catch (e) {}
        return data.rules_text;
      }
    } catch (e) {
      console.warn('[Supabase] Get rules error, using local fallback:', e);
    }
  }

  return localStorage.getItem(LOCAL_RULES_KEY) || '';
}

// --- Payment Tracker ---

const LOCAL_PAYMENTS_KEY = 'bfc_local_payments';

function getLocalPayments() {
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Could not read local payments:', e);
    return [];
  }
}

function saveLocalPayments(payments) {
  try {
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(payments));
  } catch (e) {
    console.warn('Could not save local payments:', e);
  }
}

async function savePaymentDeal(dealData) {
  const sessionId = getSessionId();
  const newRecord = {
    id: dealData.id || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    session_id: sessionId,
    evaluation_id: dealData.evaluationId || null,
    pitch_snippet: dealData.pitchSnippet || '',
    full_pitch: dealData.fullPitch || '',
    verdict: dealData.verdict || 'Good Fit',
    expected_payment_date: dealData.expectedPaymentDate, // YYYY-MM-DD
    status: dealData.status || 'pending', // 'pending' | 'paid'
    created_at: dealData.createdAt || new Date().toISOString(),
    paid_at: dealData.paidAt || null,
    updated_at: new Date().toISOString()
  };

  // Always persist locally first
  const localList = getLocalPayments();
  const existingIdx = localList.findIndex(p => p.id === newRecord.id || (newRecord.evaluation_id && p.evaluation_id === newRecord.evaluation_id));
  if (existingIdx !== -1) {
    localList[existingIdx] = { ...localList[existingIdx], ...newRecord };
  } else {
    localList.unshift(newRecord);
  }
  saveLocalPayments(localList);

  // Sync with Supabase if configured
  const client = getSupabaseClient();
  if (client) {
    console.log('[PaymentTracker:Supabase Write Attempt]', newRecord);
    try {
      const { data, error } = await client
        .from('payments')
        .upsert(newRecord, { onConflict: 'id' })
        .select();

      console.log('[PaymentTracker:Supabase Write Result]', { data, error });

      if (error) {
        console.warn('[PaymentTracker] Supabase save returned error (using local storage fallback):', error.message || error);
      } else if (data && data.length > 0) {
        return data[0];
      }
    } catch (sbErr) {
      console.warn('[PaymentTracker] Supabase payments write exception (using local storage fallback):', sbErr);
    }
  } else {
    console.log('[PaymentTracker] Supabase not configured, saved to local storage:', newRecord.id);
  }

  return newRecord;
}

async function getPaymentDeals() {
  const client = getSupabaseClient();
  if (client) {
    console.log('[PaymentTracker:Supabase Read Attempt] Querying table "payments" for session:', getSessionId());
    try {
      const { data, error } = await client
        .from('payments')
        .select('*')
        .eq('session_id', getSessionId())
        .order('expected_payment_date', { ascending: true });

      console.log('[PaymentTracker:Supabase Read Result]', { data, error });

      if (!error && data) {
        if (data.length > 0) {
          saveLocalPayments(data);
          return data;
        } else {
          // If Supabase returned empty array, check if we have local records
          const localList = getLocalPayments();
          if (localList.length > 0) {
            console.log('[PaymentTracker] Supabase has 0 records, using local storage cache with', localList.length, 'records.');
            return localList.sort((a, b) => (a.expected_payment_date || '').localeCompare(b.expected_payment_date || ''));
          }
          return [];
        }
      } else if (error) {
        console.warn('[PaymentTracker] Supabase read returned error (using local storage fallback):', error.message || error);
      }
    } catch (e) {
      console.warn('[PaymentTracker] Supabase getPaymentDeals error, falling back to local:', e);
    }
  }

  // Fallback to local
  const localList = getLocalPayments();
  return localList.sort((a, b) => (a.expected_payment_date || '').localeCompare(b.expected_payment_date || ''));
}

async function markPaymentAsPaid(paymentId) {
  const now = new Date().toISOString();

  // Update locally
  const localList = getLocalPayments();
  const target = localList.find(p => p.id === paymentId);
  if (target) {
    target.status = 'paid';
    target.paid_at = now;
    target.updated_at = now;
    saveLocalPayments(localList);
  }

  // Update in Supabase
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('payments')
        .update({ status: 'paid', paid_at: now, updated_at: now })
        .eq('id', paymentId);
      console.log('[PaymentTracker:Supabase Mark Paid Result]', { data, error });
    } catch (e) {
      console.warn('[PaymentTracker] Supabase markPaymentAsPaid update failed:', e);
    }
  }

  return target;
}

async function deletePaymentDeal(paymentId) {
  const localList = getLocalPayments().filter(p => p.id !== paymentId);
  saveLocalPayments(localList);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('payments').delete().eq('id', paymentId);
    } catch (e) {
      console.warn('Supabase deletePaymentDeal failed:', e);
    }
  }
}

// ============================================
// Creator Profile Module (Persistent Profile)
// ============================================

const LOCAL_CREATOR_PROFILE_KEY = 'bfc_creator_profile';

function getLocalCreatorProfile() {
  try {
    const raw = localStorage.getItem(LOCAL_CREATOR_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Could not read local creator profile:', e);
    return null;
  }
}

function saveLocalCreatorProfile(profileData) {
  try {
    localStorage.setItem(LOCAL_CREATOR_PROFILE_KEY, JSON.stringify(profileData));
    if (profileData && profileData.name && typeof setUserName === 'function') {
      setUserName(profileData.name);
    }
  } catch (e) {
    console.warn('Could not save local creator profile:', e);
  }
}

async function getCreatorProfile() {
  const sessionId = getSessionId();
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('creator_profiles')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (!error && data) {
        saveLocalCreatorProfile(data);
        return data;
      }
    } catch (e) {
      console.warn('[CreatorProfile] Supabase getCreatorProfile error, using local fallback:', e);
    }
  }

  return getLocalCreatorProfile();
}

async function saveCreatorProfile(profileData) {
  const sessionId = getSessionId();
  const now = new Date().toISOString();

  const record = {
    session_id: sessionId,
    name: profileData.name || '',
    instagram_url: profileData.instagram_url || '',
    youtube_url: profileData.youtube_url || '',
    other_social_links: profileData.other_social_links || '',
    followers_count: profileData.followers_count || '',
    average_views: profileData.average_views || '',
    average_reach: profileData.average_reach || '',
    engagement_rate: profileData.engagement_rate || '',
    audience_location: profileData.audience_location || '',
    audience_age: profileData.audience_age || '',
    audience_demographics: profileData.audience_demographics || '',
    audience_interests: profileData.audience_interests || '',
    main_niche: profileData.main_niche || '',
    secondary_niches: profileData.secondary_niches || '',
    content_formats: profileData.content_formats || '',
    platforms: profileData.platforms || '',
    content_style: profileData.content_style || '',
    typical_rates: profileData.typical_rates || '',
    min_acceptable_payment: profileData.min_acceptable_payment || '',
    preferred_collab_types: profileData.preferred_collab_types || '',
    preferred_industries: profileData.preferred_industries || '',
    unwanted_industries: profileData.unwanted_industries || '',
    dealbreakers: profileData.dealbreakers || '',
    exclusivity_preferences: profileData.exclusivity_preferences || '',
    usage_rights_preferences: profileData.usage_rights_preferences || '',
    max_revisions: profileData.max_revisions || '',
    unpaid_collab_rules: profileData.unpaid_collab_rules || '',
    raw_profile_json: profileData,
    updated_at: now
  };

  // Always save locally first
  saveLocalCreatorProfile(record);

  // Sync to Supabase
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('creator_profiles')
        .upsert(record, { onConflict: 'session_id' })
        .select();

      if (error) {
        console.warn('[CreatorProfile] Supabase upsert error:', error);
      } else {
        console.log('[CreatorProfile] Saved to Supabase successfully:', data);
      }
    } catch (e) {
      console.warn('[CreatorProfile] Supabase save error:', e);
    }
  }

  return record;
}

// ============================================
// Brand Profile Module (Persistent Profile)
// ============================================

const LOCAL_BRAND_PROFILE_KEY = 'bfc_brand_profile';

function getLocalBrandProfile() {
  try {
    const raw = localStorage.getItem(LOCAL_BRAND_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Could not read local brand profile:', e);
    return null;
  }
}

function saveLocalBrandProfile(profileData) {
  try {
    localStorage.setItem(LOCAL_BRAND_PROFILE_KEY, JSON.stringify(profileData));
    if (profileData && profileData.brand_name && typeof setUserName === 'function') {
      setUserName(profileData.brand_name);
    }
  } catch (e) {
    console.warn('Could not save local brand profile:', e);
  }
}

async function getBrandProfile() {
  const sessionId = getSessionId();
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('brand_profiles')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (!error && data) {
        saveLocalBrandProfile(data);
        return data;
      }
    } catch (e) {
      console.warn('[BrandProfile] Supabase getBrandProfile error, using local fallback:', e);
    }
  }

  return getLocalBrandProfile();
}

async function saveBrandProfile(profileData) {
  const sessionId = getSessionId();
  const now = new Date().toISOString();

  const record = {
    session_id: sessionId,
    brand_name: profileData.brand_name || '',
    industry: profileData.industry || '',
    product_service: profileData.product_service || '',
    brand_positioning: profileData.brand_positioning || '',
    website: profileData.website || '',
    target_age: profileData.target_age || '',
    target_geography: profileData.target_geography || '',
    target_demographics: profileData.target_demographics || '',
    target_interests: profileData.target_interests || '',
    customer_profile: profileData.customer_profile || '',
    campaign_objective: profileData.campaign_objective || '',
    campaign_description: profileData.campaign_description || '',
    preferred_niche: profileData.preferred_niche || '',
    preferred_platform: profileData.preferred_platform || '',
    follower_range: profileData.follower_range || '',
    engagement_expectations: profileData.engagement_expectations || '',
    creator_geography: profileData.creator_geography || '',
    content_format: profileData.content_format || '',
    audience_profile: profileData.audience_profile || '',
    creator_style: profileData.creator_style || '',
    campaign_budget: profileData.campaign_budget || '',
    max_creator_budget: profileData.max_creator_budget || '',
    deliverables: profileData.deliverables || '',
    timeline: profileData.timeline || '',
    usage_rights: profileData.usage_rights || '',
    exclusivity: profileData.exclusivity || '',
    raw_profile_json: profileData,
    updated_at: now
  };

  // Always save locally first
  saveLocalBrandProfile(record);

  // Sync to Supabase
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('brand_profiles')
        .upsert(record, { onConflict: 'session_id' })
        .select();

      if (error) {
        console.warn('[BrandProfile] Supabase upsert error:', error);
      } else {
        console.log('[BrandProfile] Saved to Supabase successfully:', data);
      }
    } catch (e) {
      console.warn('[BrandProfile] Supabase save error:', e);
    }
  }

  return record;
}

// ============================================
// Daily Usage Tracking (Rate Limiting)
// Tracks number of AI calls made today per session_id.
// Mirrored to localStorage and synced with Supabase.
// ============================================

const LOCAL_USAGE_KEY = 'bfc_usage_limits';

function getLocalDailyUsage() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === today) {
        return Number(parsed.count) || 0;
      }
    }
  } catch (e) {}
  return 0;
}

function setLocalDailyUsage(count, dateStr) {
  const today = dateStr || new Date().toISOString().split('T')[0];
  try {
    localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify({
      date: today,
      count: Number(count) || 0,
      updated_at: new Date().toISOString()
    }));
  } catch (e) {}
}

async function getDailyUsage(sessionId = (typeof getSessionId === 'function' ? getSessionId() : 'anonymous')) {
  const today = new Date().toISOString().split('T')[0];
  let usage = getLocalDailyUsage();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('usage_limits')
        .select('count')
        .eq('session_id', sessionId)
        .eq('date', today)
        .maybeSingle();

      if (!error && data && typeof data.count === 'number') {
        usage = Math.max(usage, data.count);
        setLocalDailyUsage(usage, today);
      }
    } catch (e) {
      console.warn('[Supabase] getDailyUsage exception, using local count:', e);
    }
  }

  return usage;
}

