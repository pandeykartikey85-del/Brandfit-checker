// ============================================
// My Rules Tab
// Lets the creator save personal dealbreaker
// rules as free text, stored in Supabase.
// These rules are checked against every new
// pitch before applying general criteria.
// ============================================

function initRules() {
  document.getElementById('save-rules-btn').addEventListener('click', handleSaveRules);
}

async function loadRules() {
  const rulesInput = document.getElementById('rules-input');
  const statusEl = document.getElementById('rules-status');

  try {
    const rules = await getUserRules();
    rulesInput.value = rules;
  } catch (error) {
    statusEl.textContent = `Failed to load rules: ${error.message}`;
    statusEl.className = 'rules-status error visible';
  }
}

async function handleSaveRules() {
  const rulesInput = document.getElementById('rules-input');
  const saveBtn = document.getElementById('save-rules-btn');
  const statusEl = document.getElementById('rules-status');

  const rulesText = rulesInput.value.trim();

  // Show saving state
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  statusEl.classList.remove('visible');

  try {
    await saveUserRules(rulesText);

    statusEl.textContent = 'Rules saved ✓';
    statusEl.className = 'rules-status success visible';

    // Fade out success message after 3s
    setTimeout(() => statusEl.classList.remove('visible'), 3000);
  } catch (error) {
    statusEl.textContent = `Failed to save: ${error.message}`;
    statusEl.className = 'rules-status error visible';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Rules';
  }
}
