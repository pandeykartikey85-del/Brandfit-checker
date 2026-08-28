// ============================================
// Owl Mascot Advisor Character
// Friendly wise owl with reading glasses, idle bob &
// blink animations, and contextual reaction states
// (Good Fit, Risky, Bad Fit).
// ============================================

const MASCOT_MESSAGES = {
  idle: [
    "Ready to inspect deals! 🦉",
    "Paste a pitch to begin.",
    "Checking terms with care.",
    "Wise creators read twice."
  ],
  analyzing: [
    "Reading the fine print…",
    "Spotting red flags…",
    "Checking compensation…",
    "Evaluating deliverables…"
  ],
  good: [
    "Looks like a solid fit! ✨",
    "Fair terms & clear pay! 🎯",
    "Great collaboration ahead!"
  ],
  risky: [
    "Proceed with caution! ⚠️",
    "Negotiate these terms.",
    "Missing some key details."
  ],
  bad: [
    "Major red flags detected! 🛑",
    "Decline or demand pay.",
    "Unfair terms ahead."
  ]
};

function initMascot() {
  const container = document.getElementById('mascot-container');
  if (!container) return;

  setMascotState('idle');
}

function setMascotState(state) {
  const container = document.getElementById('mascot-container');
  const bubble = document.getElementById('mascot-speech-bubble');
  if (!container) return;

  // Clear previous state classes
  container.classList.remove('owl-state-idle', 'owl-state-analyzing', 'owl-state-good', 'owl-state-risky', 'owl-state-bad');

  if (state === 'good' || state === 'Good Fit') {
    container.classList.add('owl-state-good');
    updateMascotBubble(bubble, getRandomMsg(MASCOT_MESSAGES.good));
  } else if (state === 'risky' || state === 'Risky') {
    container.classList.add('owl-state-risky');
    updateMascotBubble(bubble, getRandomMsg(MASCOT_MESSAGES.risky));
  } else if (state === 'bad' || state === 'Bad Fit') {
    container.classList.add('owl-state-bad');
    updateMascotBubble(bubble, getRandomMsg(MASCOT_MESSAGES.bad));
  } else if (state === 'analyzing') {
    container.classList.add('owl-state-analyzing');
    updateMascotBubble(bubble, getRandomMsg(MASCOT_MESSAGES.analyzing));
  } else {
    container.classList.add('owl-state-idle');
    updateMascotBubble(bubble, getRandomMsg(MASCOT_MESSAGES.idle));
  }
}

function updateMascotBubble(bubble, text) {
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.remove('bubble-pop');
  void bubble.offsetWidth; // Trigger reflow for animation
  bubble.classList.add('bubble-pop');
}

function getRandomMsg(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
