// ============================================
// Supabase Client & CRUD Operations
// Handles all database interactions:
// evaluations and personal rules.
// ============================================

let sbClient = null;

function initSupabase() {
  const config = getConfig();
  if (config.supabaseUrl && config.supabaseKey) {
    sbClient = supabase.createClient(config.supabaseUrl, config.supabaseKey);
  }
  return sbClient;
}

function getSupabaseClient() {
  if (!sbClient) initSupabase();
  return sbClient;
}

// --- Evaluations ---

async function saveEvaluation(pitchText, profileText, verdict, reasoning) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

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

  if (error) throw error;
  return data;
}

async function getEvaluations(limit = 50) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('evaluations')
    .select('*')
    .eq('session_id', getSessionId())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// --- Personal Rules ---

async function saveUserRules(rulesText) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const sessionId = getSessionId();

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

  if (error) throw error;
  return data;
}

async function getUserRules() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('rules')
    .select('rules_text')
    .eq('session_id', getSessionId())
    .single();

  // PGRST116 = "no rows returned" — that's fine, means no rules saved yet
  if (error && error.code !== 'PGRST116') throw error;
  return data?.rules_text || '';
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
