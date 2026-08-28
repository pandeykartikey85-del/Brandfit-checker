// ============================================
// Configuration & Settings Modal
// Manages API keys in localStorage and
// the setup modal for first-time configuration.
// ============================================

const CONFIG_KEYS = {
  GEMINI_KEY: 'bfc_gemini_key',
  SUPABASE_URL: 'bfc_supabase_url',
  SUPABASE_KEY: 'bfc_supabase_key',
  SESSION_ID: 'bfc_session_id'
};

function getConfig() {
  return {
    geminiKey: localStorage.getItem(CONFIG_KEYS.GEMINI_KEY) || '',
    supabaseUrl: localStorage.getItem(CONFIG_KEYS.SUPABASE_URL) || '',
    supabaseKey: localStorage.getItem(CONFIG_KEYS.SUPABASE_KEY) || ''
  };
}

function saveConfigValues(geminiKey, supabaseUrl, supabaseKey) {
  localStorage.setItem(CONFIG_KEYS.GEMINI_KEY, geminiKey.trim());
  localStorage.setItem(CONFIG_KEYS.SUPABASE_URL, supabaseUrl.trim());
  localStorage.setItem(CONFIG_KEYS.SUPABASE_KEY, supabaseKey.trim());
}

function isConfigured() {
  const config = getConfig();
  return !!(config.geminiKey && config.supabaseUrl && config.supabaseKey);
}

function getSessionId() {
  let id = localStorage.getItem(CONFIG_KEYS.SESSION_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CONFIG_KEYS.SESSION_ID, id);
  }
  return id;
}

function showSettingsModal(forceShow = false) {
  const modal = document.getElementById('settings-modal');
  const overlay = document.getElementById('settings-overlay');

  // Pre-fill with existing values
  const config = getConfig();
  document.getElementById('input-gemini-key').value = config.geminiKey;
  document.getElementById('input-supabase-url').value = config.supabaseUrl;
  document.getElementById('input-supabase-key').value = config.supabaseKey;

  modal.classList.add('visible');
  overlay.classList.add('visible');

  // If forced (first-time), hide close button
  const closeBtn = document.getElementById('settings-close-btn');
  if (forceShow && !isConfigured()) {
    closeBtn.style.display = 'none';
  } else {
    closeBtn.style.display = '';
  }
}

function hideSettingsModal() {
  document.getElementById('settings-modal').classList.remove('visible');
  document.getElementById('settings-overlay').classList.remove('visible');
}

function initSettings() {
  // Settings form submission
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const geminiKey = document.getElementById('input-gemini-key').value;
    const supabaseUrl = document.getElementById('input-supabase-url').value;
    const supabaseKey = document.getElementById('input-supabase-key').value;

    if (!geminiKey || !supabaseUrl || !supabaseKey) {
      document.getElementById('settings-error').textContent = 'All fields are required.';
      return;
    }

    document.getElementById('settings-error').textContent = '';
    saveConfigValues(geminiKey, supabaseUrl, supabaseKey);
    hideSettingsModal();

    // Re-initialize Supabase client with new keys
    initSupabase();
  });

  // Close button
  document.getElementById('settings-close-btn').addEventListener('click', hideSettingsModal);

  // Overlay click to close (only if already configured)
  document.getElementById('settings-overlay').addEventListener('click', () => {
    if (isConfigured()) hideSettingsModal();
  });

  // Settings gear icon
  document.getElementById('settings-gear').addEventListener('click', () => showSettingsModal());
}
