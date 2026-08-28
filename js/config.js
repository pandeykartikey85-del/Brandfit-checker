// ============================================
// Configuration & Settings Module
// Manages session ID, optional Supabase config,
// and settings modal.
// Gemini API is managed securely server-side.
// ============================================

// Central Supabase configuration
// NOTE: The Supabase Anon key is a public key intended for browser clients.
// Row Level Security (RLS) protects data access on the Supabase database.
// NEVER put a Supabase service_role key here or in client code.
const CENTRAL_SUPABASE_CONFIG = {
  url: 'https://xxxxx.supabase.co', // Replace with your Supabase Project URL or keep empty for local fallback
  anonKey: 'eyJhbG...'              // Replace with your Supabase Anon (public) Key
};

const CONFIG_KEYS = {
  SUPABASE_URL: 'bfc_supabase_url',
  SUPABASE_KEY: 'bfc_supabase_key',
  SESSION_ID: 'bfc_session_id'
};

function getConfig() {
  const localUrl = localStorage.getItem(CONFIG_KEYS.SUPABASE_URL);
  const localKey = localStorage.getItem(CONFIG_KEYS.SUPABASE_KEY);

  return {
    supabaseUrl: (localUrl && localUrl.trim()) || CENTRAL_SUPABASE_CONFIG.url || '',
    supabaseKey: (localKey && localKey.trim()) || CENTRAL_SUPABASE_CONFIG.anonKey || ''
  };
}

function saveConfigValues(supabaseUrl, supabaseKey) {
  if (supabaseUrl) localStorage.setItem(CONFIG_KEYS.SUPABASE_URL, supabaseUrl.trim());
  if (supabaseKey) localStorage.setItem(CONFIG_KEYS.SUPABASE_KEY, supabaseKey.trim());
}

function isConfigured() {
  // App is always ready to use because Gemini is server-side and storage has local fallback
  return true;
}

function isSupabaseConfigured() {
  const config = getConfig();
  return !!(
    config.supabaseUrl &&
    config.supabaseKey &&
    !config.supabaseUrl.includes('xxxxx') &&
    !config.supabaseKey.includes('eyJhbG...')
  );
}

function getSessionId() {
  let id = localStorage.getItem(CONFIG_KEYS.SESSION_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CONFIG_KEYS.SESSION_ID, id);
  }
  return id;
}

function showSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const overlay = document.getElementById('settings-overlay');
  if (!modal || !overlay) return;

  const config = getConfig();
  const urlInput = document.getElementById('input-supabase-url');
  const keyInput = document.getElementById('input-supabase-key');

  if (urlInput) {
    urlInput.value = config.supabaseUrl.includes('xxxxx') ? '' : config.supabaseUrl;
  }
  if (keyInput) {
    keyInput.value = config.supabaseKey.includes('eyJhbG...') ? '' : config.supabaseKey;
  }

  modal.classList.add('visible');
  overlay.classList.add('visible');
}

function hideSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const overlay = document.getElementById('settings-overlay');
  if (modal) modal.classList.remove('visible');
  if (overlay) overlay.classList.remove('visible');
}

function initSettings() {
  const form = document.getElementById('settings-form');
  const closeBtn = document.getElementById('settings-close-btn');
  const overlay = document.getElementById('settings-overlay');
  const gearBtn = document.getElementById('settings-gear');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const urlInput = document.getElementById('input-supabase-url');
      const keyInput = document.getElementById('input-supabase-key');
      const supabaseUrl = urlInput ? urlInput.value : '';
      const supabaseKey = keyInput ? keyInput.value : '';

      saveConfigValues(supabaseUrl, supabaseKey);
      hideSettingsModal();

      if (typeof initSupabase === 'function') {
        initSupabase();
      }
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', hideSettingsModal);
  if (overlay) overlay.addEventListener('click', hideSettingsModal);
  if (gearBtn) gearBtn.addEventListener('click', () => showSettingsModal());
}
