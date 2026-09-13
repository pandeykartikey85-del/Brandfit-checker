// ============================================
// Owl Mascot Advisor Character
// Friendly wise owl with reading glasses, idle bob &
// blink animations, and contextual reaction states
// (Good Fit, Risky, Bad Fit).
// ============================================

const MASCOT_MESSAGES = {
  creator: {
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
  },
  brand: {
    idle: [
      "Ready to evaluate creators! 🦉",
      "Paste a pitch or profile to begin.",
      "Evaluating creator fit with care.",
      "Wise brands partner smart."
    ],
    analyzing: [
      "Analyzing creator alignment…",
      "Checking audience & niche match…",
      "Reviewing collaboration terms…",
      "Evaluating campaign scope…"
    ],
    good: [
      "High-alignment creator! ✨",
      "Solid audience & pitch fit! 🎯",
      "Great partnership opportunity!"
    ],
    risky: [
      "Review scope & deliverables! ⚠️",
      "Clarify missing details.",
      "Some risks to negotiate."
    ],
    bad: [
      "Misaligned creator pitch! 🛑",
      "Unrealistic terms or scope.",
      "Unfavorable campaign fit."
    ]
  }
};

let currentMascotState = 'idle';

function getActiveMascotMessages(state = currentMascotState) {
  const mode = (typeof getUserMode === 'function' ? getUserMode() : null) || 'creator';
  const modeSet = MASCOT_MESSAGES[mode] || MASCOT_MESSAGES.creator;
  return modeSet[state] || modeSet.idle;
}

function initMascot() {
  const container = document.getElementById('mascot-container');
  if (!container) return;

  function triggerMascotInteraction() {
    const bubble = document.getElementById('mascot-speech-bubble');
    const messages = getActiveMascotMessages(currentMascotState);
    updateMascotBubble(bubble, getRandomMsg(messages));
    if (typeof playClickSound === 'function') {
      playClickSound();
    }
  }

  // Cross-device touch & mouse interaction with debounce to prevent double-tap firing
  let lastTapTime = 0;
  function handleTap(e) {
    const now = Date.now();
    if (now - lastTapTime < 350) return;
    lastTapTime = now;
    triggerMascotInteraction();
  }

  container.addEventListener('touchend', (e) => {
    handleTap(e);
  }, { passive: true });

  container.addEventListener('click', (e) => {
    handleTap(e);
  });

  // Keyboard accessibility for screen readers and keyboard navigation
  container.setAttribute('tabindex', '0');
  container.setAttribute('role', 'button');
  container.setAttribute('aria-label', 'Brand Fit Advisor Owl. Press Enter or Space to hear advice.');
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerMascotInteraction();
    }
  });

  // Non-obstructive typing: Dim and shrink mascot whenever an input/textarea has focus on mobile/tablet
  document.addEventListener('focusin', (e) => {
    if (window.innerWidth < 1024 && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      container.classList.add('mascot-dimmed');
    }
  });

  document.addEventListener('focusout', () => {
    container.classList.remove('mascot-dimmed');
  });

  setMascotState('idle');
}

function setMascotState(state) {
  const container = document.getElementById('mascot-container');
  const bubble = document.getElementById('mascot-speech-bubble');
  if (!container) return;

  // Clear previous state classes
  container.classList.remove('owl-state-idle', 'owl-state-analyzing', 'owl-state-good', 'owl-state-risky', 'owl-state-bad');

  if (state === 'good' || state === 'Good Fit') {
    currentMascotState = 'good';
    container.classList.add('owl-state-good');
    updateMascotBubble(bubble, getRandomMsg(getActiveMascotMessages('good')));
  } else if (state === 'risky' || state === 'Risky') {
    currentMascotState = 'risky';
    container.classList.add('owl-state-risky');
    updateMascotBubble(bubble, getRandomMsg(getActiveMascotMessages('risky')));
  } else if (state === 'bad' || state === 'Bad Fit') {
    currentMascotState = 'bad';
    container.classList.add('owl-state-bad');
    updateMascotBubble(bubble, getRandomMsg(getActiveMascotMessages('bad')));
  } else if (state === 'analyzing') {
    currentMascotState = 'analyzing';
    container.classList.add('owl-state-analyzing');
    updateMascotBubble(bubble, getRandomMsg(getActiveMascotMessages('analyzing')));
  } else {
    currentMascotState = 'idle';
    container.classList.add('owl-state-idle');
    updateMascotBubble(bubble, getRandomMsg(getActiveMascotMessages('idle')));
  }
}

function updateMascotMode(mode) {
  const bubble = document.getElementById('mascot-speech-bubble');
  if (!bubble) return;
  const msg = mode === 'brand' ? 'Switched to Brand view! 🦉' : 'Switched to Creator view! 🦉';
  updateMascotBubble(bubble, msg);
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
