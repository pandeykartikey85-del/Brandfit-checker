// ============================================
// App — Main Orchestrator
// Initializes all modules, manages navigation,
// handles tab switching, splash screen, and
// verdict micro-animations.
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Display random quote per visit
  document.getElementById('daily-quote').textContent = `\u201C${getDailyQuote()}\u201D`;

  // 2. Initialize settings modal
  initSettings();

  // 3. Check if API keys are configured
  if (!isConfigured()) {
    showSettingsModal(true);
  } else {
    initSupabase();
  }

  // 4. Initialize navigation
  initNavigation();

  // 5. Initialize audio and mascot
  if (typeof initAudio === 'function') initAudio();
  if (typeof initMascot === 'function') initMascot();

  // 6. Initialize tab modules
  initChecker();
  initContracts();
  initHistory();
  initCompareButton();
  initRules();
  if (typeof initPayments === 'function') initPayments();
  if (typeof updatePaymentNavBadge === 'function') updatePaymentNavBadge();

  // 7. Initialize randomized side margin decorations
  if (typeof initSideDecorations === 'function') {
    initSideDecorations();
  }

  // 8. Show splash screen on fresh page load then reveal app
  showSplash(() => {
    showTab('checker');
  });

  // 9. Render Creator Playbook tips
  renderCreatorPlaybook();

  // 10. Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
});

// ============================================
// Splash Screen
// ============================================

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Welcome, night owl';
}

function showSplash(onComplete) {
  const splashEl = document.getElementById('splash-screen');
  const greetingEl = document.getElementById('splash-greeting');
  const appContainer = document.querySelector('.app-container');

  if (!splashEl || !greetingEl || !appContainer) {
    if (onComplete) onComplete();
    return;
  }

  // Set greeting text
  greetingEl.textContent = getTimeGreeting();

  // Reset display state and activate splash
  splashEl.style.display = 'flex';
  splashEl.classList.remove('splash-exit');
  splashEl.classList.add('splash-active');
  greetingEl.classList.remove('splash-greeting-visible');

  // Staggered greeting entrance (400ms after logo)
  setTimeout(() => {
    greetingEl.classList.add('splash-greeting-visible');
  }, 400);

  // Fade out splash after 1.6s total and reveal app
  setTimeout(() => {
    splashEl.classList.add('splash-exit');
    appContainer.classList.add('app-visible');
    if (onComplete) onComplete();

    // Hide splash overlay completely after transition
    setTimeout(() => {
      splashEl.style.display = 'none';
      splashEl.classList.remove('splash-active');
    }, 500);
  }, 1600);
}

// ============================================
// Navigation
// ============================================

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      if (tab) showTab(tab);
    });
  });
}

function showTab(tabName) {
  // Reset mascot to idle when switching tabs
  if (typeof setMascotState === 'function') setMascotState('idle');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });

  // Show/hide tab content panels
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });

  // Trigger data loading for specific tabs
  if (tabName === 'history') {
    loadHistory();
  } else if (tabName === 'rules') {
    loadRules();
  } else if (tabName === 'payments') {
    if (typeof loadPayments === 'function') loadPayments();
  }
}

// ============================================
// Verdict Micro-Animations
// Called from checker.js after rendering result
// ============================================

function triggerVerdictAnimation(verdictText, container) {
  const badge = container.querySelector('.verdict-badge');
  if (!badge) return;

  if (verdictText === 'Good Fit') {
    badge.classList.add('animate-good-fit');
    spawnSparkles(container);
    setTimeout(() => badge.classList.remove('animate-good-fit'), 1500);
  } else if (verdictText === 'Bad Fit') {
    badge.classList.add('animate-bad-fit');
    setTimeout(() => badge.classList.remove('animate-bad-fit'), 600);
  } else if (verdictText === 'Risky') {
    badge.classList.add('animate-risky');
    setTimeout(() => badge.classList.remove('animate-risky'), 800);
  }
}

function spawnSparkles(container) {
  const resultTop = container.querySelector('.result-top');
  if (!resultTop) return;

  // Position reference for sparkles
  resultTop.style.position = 'relative';
  resultTop.style.overflow = 'visible';

  for (let i = 0; i < 12; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = `${20 + Math.random() * 60}%`;
    sparkle.style.top = `${Math.random() * 60}%`;
    sparkle.style.animationDelay = `${Math.random() * 0.5}s`;
    sparkle.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`);
    sparkle.style.setProperty('--dy', `${-20 - Math.random() * 50}px`);
    resultTop.appendChild(sparkle);

    setTimeout(() => sparkle.remove(), 1800);
  }
}

// ============================================
// Creator Playbook Tips Card
// ============================================

function renderCreatorPlaybook() {
  const container = document.getElementById('creator-playbook');
  if (!container || typeof getRandomPlaybookTips !== 'function') return;

  const tips = getRandomPlaybookTips(3);

  const categoryIcons = {
    'Negotiation': '💬',
    'Red Flags': '🚩',
    'Contracts': '📄',
    'Growth': '📈'
  };

  const tipsHtml = tips.map(t => {
    const icon = categoryIcons[t.category] || '💡';
    return `
      <div class="playbook-tip-item">
        <div class="playbook-tip-header">
          <span class="playbook-tip-icon">${icon}</span>
          <span class="playbook-tip-category">${t.category}</span>
        </div>
        <p class="playbook-tip-text">${t.tip}</p>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="playbook-card">
      <div class="playbook-card-header">
        <h3 class="playbook-title">Creator Playbook</h3>
        <span class="playbook-subtitle">Tips for smarter deals</span>
      </div>
      <div class="playbook-tips-list">
        ${tipsHtml}
      </div>
    </div>
  `;
}
