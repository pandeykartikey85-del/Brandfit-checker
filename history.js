// ============================================
// History Tab
// Fetches past evaluations from Supabase and
// displays them as expandable cards with
// pitch preview, verdict badge, date, and
// selection checkboxes for multi-pitch compare.
// Also renders "Your Patterns" summary card
// when 5+ evaluations exist.
// ============================================

let historyEvaluations = []; // Cache for comparison & pattern use
let selectedForCompare = new Set();

function initHistory() {
  // History loads dynamically when the tab is activated.
  // Triggered by showTab('history') in app.js.
}

async function loadHistory() {
  const listEl = document.getElementById('history-list');
  const loadingEl = document.getElementById('history-loading');
  const emptyEl = document.getElementById('history-empty');
  const compareBar = document.getElementById('compare-bar');
  const patternsContainer = document.getElementById('patterns-container');
  const compareResultEl = document.getElementById('compare-result');

  // Reset state
  listEl.innerHTML = '';
  compareBar.classList.remove('visible');
  compareResultEl.innerHTML = '';
  compareResultEl.classList.remove('visible');
  patternsContainer.innerHTML = '';
  patternsContainer.classList.remove('visible');
  loadingEl.classList.add('visible');
  emptyEl.classList.remove('visible');
  selectedForCompare.clear();

  try {
    const evaluations = await getEvaluations(50);
    historyEvaluations = evaluations;
    loadingEl.classList.remove('visible');

    if (evaluations.length === 0) {
      emptyEl.classList.add('visible');
      return;
    }

    // Show compare toolbar
    compareBar.classList.add('visible');
    updateCompareBarState();

    evaluations.forEach((ev, idx) => {
      listEl.appendChild(createHistoryCard(ev, idx));
    });

    // "Your Patterns" card — only if 5+ evaluations
    if (evaluations.length >= 5) {
      loadPatternSummary(evaluations, patternsContainer);
    }
  } catch (error) {
    loadingEl.classList.remove('visible');
    listEl.innerHTML = `
      <div class="history-error">
        Failed to load history: ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function createHistoryCard(evaluation, index) {
  const card = document.createElement('div');
  card.className = 'history-card';
  card.dataset.evalIndex = index;

  const verdictClass = {
    'Good Fit': 'verdict-good',
    'Risky':    'verdict-risky',
    'Bad Fit':  'verdict-bad'
  }[evaluation.verdict] || 'verdict-risky';

  // Truncate pitch for preview
  const pitchPreview = evaluation.pitch_text.length > 80
    ? evaluation.pitch_text.substring(0, 80) + '…'
    : evaluation.pitch_text;

  // Format date nicely
  const date = new Date(evaluation.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Build reasons list from stored reasoning
  const reasonsHtml = evaluation.reasoning
    .split('\n')
    .filter(r => r.trim())
    .map(r => `<li>${escapeHtml(r)}</li>`)
    .join('');

  // Check if deal is already accepted/tracked
  const localPayments = typeof getLocalPayments === 'function' ? getLocalPayments() : [];
  const existingPayment = localPayments.find(p =>
    (evaluation.id && p.evaluation_id === evaluation.id) ||
    (p.full_pitch && p.full_pitch === evaluation.pitch_text)
  );

  let paymentActionHtml = '';
  if (existingPayment) {
    if (existingPayment.status === 'paid') {
      paymentActionHtml = `<span class="history-deal-status status-paid">✅ Paid (${escapeHtml(existingPayment.expected_payment_date)})</span>`;
    } else {
      const diff = typeof getDaysDiff === 'function' ? getDaysDiff(existingPayment.expected_payment_date) : 0;
      const isOverdue = diff < 0;
      paymentActionHtml = `
        <span class="history-deal-status ${isOverdue ? 'status-overdue' : 'status-pending'}">
          ${isOverdue ? `⚠️ Overdue (${Math.abs(diff)}d)` : `⏳ Due in ${diff}d`} · ${escapeHtml(existingPayment.expected_payment_date)}
        </span>
      `;
    }
  } else {
    paymentActionHtml = `
      <button class="btn-history-accept-deal" data-eval-id="${escapeHtml(evaluation.id || '')}">
        🤝 Mark as Accepted
      </button>
    `;
  }

  card.innerHTML = `
    <div class="history-card-header">
      <div class="history-card-left">
        <label class="compare-checkbox-label" title="Select for comparison">
          <input type="checkbox" class="compare-checkbox" data-eval-index="${index}">
          <span class="compare-checkbox-custom"></span>
        </label>
        <span class="verdict-badge-sm ${verdictClass}">${escapeHtml(evaluation.verdict)}</span>
        <span class="history-pitch-preview">${escapeHtml(pitchPreview)}</span>
      </div>
      <div class="history-card-right">
        <span class="history-date">${date}</span>
        <span class="expand-icon">▾</span>
      </div>
    </div>
    <div class="history-card-body">
      <div class="history-detail">
        <h4>Pitch</h4>
        <p>${escapeHtml(evaluation.pitch_text)}</p>
      </div>
      <div class="history-detail">
        <h4>Your Profile</h4>
        <p>${escapeHtml(evaluation.profile_text)}</p>
      </div>
      <div class="history-detail">
        <h4>Reasoning</h4>
        <ul class="reasons-list">
          ${reasonsHtml}
        </ul>
      </div>
      <div class="history-card-actions">
        ${paymentActionHtml}
      </div>
    </div>
  `;

  // Accept Deal button logic
  const acceptBtn = card.querySelector('.btn-history-accept-deal');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const snippet = (evaluation.pitch_text || '').substring(0, 120);
      if (typeof openAcceptDealModal === 'function') {
        openAcceptDealModal({
          evaluationId: evaluation.id || null,
          pitchSnippet: snippet,
          fullPitch: evaluation.pitch_text,
          verdict: evaluation.verdict,
          triggerButton: acceptBtn
        });
      }
    });
  }

  // Checkbox logic — stop propagation so it doesn't toggle expand
  const checkbox = card.querySelector('.compare-checkbox');
  checkbox.addEventListener('click', (e) => e.stopPropagation());
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    const idx = parseInt(e.target.dataset.evalIndex);
    if (e.target.checked) {
      if (selectedForCompare.size >= 3) {
        e.target.checked = false;
        return;
      }
      selectedForCompare.add(idx);
      card.classList.add('selected-for-compare');
    } else {
      selectedForCompare.delete(idx);
      card.classList.remove('selected-for-compare');
    }
    updateCompareBarState();
  });

  // Toggle expand/collapse on header click (but not on checkbox)
  const header = card.querySelector('.history-card-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.compare-checkbox-label') || e.target.closest('.history-card-actions')) return;
    const isExpanding = !card.classList.contains('expanded');
    card.classList.toggle('expanded');

    // Update mascot to match this card's verdict when expanding, idle when collapsing
    if (typeof setMascotState === 'function') {
      setMascotState(isExpanding ? evaluation.verdict : 'idle');
    }
  });

  return card;
}

function updateCompareBarState() {
  const countEl = document.getElementById('compare-count');
  const compareBtn = document.getElementById('compare-selected-btn');
  const count = selectedForCompare.size;

  countEl.textContent = count === 0
    ? 'Select 2–3 pitches to compare'
    : `${count} pitch${count === 1 ? '' : 'es'} selected`;

  compareBtn.disabled = count < 2;

  // Disable unchecked checkboxes if 3 are already selected
  document.querySelectorAll('.compare-checkbox').forEach(cb => {
    const idx = parseInt(cb.dataset.evalIndex);
    if (count >= 3 && !selectedForCompare.has(idx)) {
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
  });
}

// ============================================
// Multi-Pitch Comparison
// ============================================

function initCompareButton() {
  const compareBtn = document.getElementById('compare-selected-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', handleCompare);
  }
}

async function handleCompare() {
  const compareBtn = document.getElementById('compare-selected-btn');
  const resultEl = document.getElementById('compare-result');

  if (selectedForCompare.size < 2) return;

  const selectedPitches = Array.from(selectedForCompare)
    .sort((a, b) => a - b)
    .map(idx => historyEvaluations[idx]);

  if (typeof playClickSound === 'function') playClickSound();

  // Start loading
  compareBtn.disabled = true;
  compareBtn.innerHTML = '<span class="spinner"></span> Comparing…';

  let currentTipIdx = Math.floor(Math.random() * CREATOR_TIPS.length);
  resultEl.innerHTML = `
    <div class="result-card loading-state-card">
      <div class="loading-state-header">
        <div class="loading-indicator-badge">
          <span class="spinner"></span>
          <span class="loading-label">Comparing ${selectedPitches.length} pitches with AI…</span>
        </div>
      </div>
      <div class="loading-tip-wrapper">
        <p id="compare-rotating-tip-text" class="loading-rotating-tip">${escapeHtml(CREATOR_TIPS[currentTipIdx])}</p>
      </div>
    </div>
  `;
  resultEl.classList.add('visible');

  const tipInterval = setInterval(() => {
    const tipEl = document.getElementById('compare-rotating-tip-text');
    if (!tipEl) return;
    currentTipIdx = (currentTipIdx + 1) % CREATOR_TIPS.length;
    tipEl.classList.add('tip-fade-out');
    setTimeout(() => {
      if (!tipEl) return;
      tipEl.textContent = CREATOR_TIPS[currentTipIdx];
      tipEl.classList.remove('tip-fade-out');
    }, 250);
  }, 2000);

  try {
    const result = await comparePitches(selectedPitches);
    clearInterval(tipInterval);
    compareBtn.disabled = false;
    compareBtn.innerHTML = 'Compare Selected';
    displayCompareResult(result, resultEl);
  } catch (error) {
    clearInterval(tipInterval);
    compareBtn.disabled = false;
    compareBtn.innerHTML = 'Compare Selected';
    resultEl.innerHTML = `
      <div class="result-card compare-error-card">
        <p class="compare-error-msg">Comparison failed: ${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function displayCompareResult(result, container) {
  const rec = result.recommendation || {};
  const topIdx = (rec.top_choice_index || 1);

  // Build tradeoff cards sorted by priority_rank
  const tradeoffs = (result.tradeoffs || []).sort((a, b) => (a.priority_rank || 99) - (b.priority_rank || 99));

  const tradeoffCardsHtml = tradeoffs.map(t => {
    const isTop = t.pitch_index === topIdx;
    const verdictClass = {
      'Good Fit': 'verdict-good',
      'Risky':    'verdict-risky',
      'Bad Fit':  'verdict-bad'
    }[t.verdict] || 'verdict-risky';

    return `
      <div class="compare-tradeoff-card ${isTop ? 'compare-top-pick' : ''}">
        <div class="compare-tradeoff-header">
          <div class="compare-tradeoff-title-row">
            <span class="compare-pitch-label">Pitch #${t.pitch_index}</span>
            <span class="verdict-badge-sm ${verdictClass}">${escapeHtml(t.verdict || '')}</span>
            ${isTop ? '<span class="compare-top-badge">★ Top Pick</span>' : ''}
            <span class="compare-rank-badge">#${t.priority_rank || t.pitch_index} Priority</span>
          </div>
          <p class="compare-pitch-preview">${escapeHtml(t.preview || '')}</p>
        </div>
        <div class="compare-tradeoff-grid">
          <div class="compare-cell">
            <span class="compare-cell-label">💰 Compensation</span>
            <p class="compare-cell-text">${escapeHtml(t.compensation || 'N/A')}</p>
          </div>
          <div class="compare-cell">
            <span class="compare-cell-label">🎯 Niche Fit</span>
            <p class="compare-cell-text">${escapeHtml(t.niche_fit || t.nicheFit || 'N/A')}</p>
          </div>
          <div class="compare-cell">
            <span class="compare-cell-label">⚠ Risk Level</span>
            <p class="compare-cell-text">${escapeHtml(t.risk_level || t.riskLevel || 'N/A')}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const actionPlanHtml = result.actionPlan ? `
    <div class="compare-action-plan">
      <div class="compare-action-plan-header">
        <span class="compare-action-plan-label">📋 Recommended Next Steps</span>
      </div>
      <p class="compare-action-plan-text">${escapeHtml(result.actionPlan)}</p>
    </div>
  ` : '';

  const rawSection = result.rawResponse ? `
    <details class="debug-raw-response">
      <summary>View Raw AI Response</summary>
      <pre><code>${escapeHtml(result.rawResponse)}</code></pre>
    </details>
  ` : '';

  container.innerHTML = `
    <div class="result-card compare-result-card">
      <div class="compare-result-header">
        <h3 class="compare-result-title">Pitch Comparison</h3>
        <span class="compare-result-count">${tradeoffs.length} pitches compared</span>
      </div>

      <div class="compare-recommendation-box">
        <div class="compare-recommendation-header">
          <span class="compare-rec-star">★</span>
          <span class="compare-rec-title">${escapeHtml(rec.top_choice_title || 'Top Choice')}</span>
        </div>
        <p class="compare-rec-rationale">${escapeHtml(rec.rationale || '')}</p>
      </div>

      <div class="compare-tradeoffs-list">
        ${tradeoffCardsHtml}
      </div>

      ${actionPlanHtml}
      ${rawSection}
    </div>
  `;
  container.classList.add('visible');
}

// ============================================
// Pattern Summary ("Your Patterns")
// ============================================

async function loadPatternSummary(evaluations, container) {
  container.innerHTML = `
    <div class="patterns-card patterns-loading">
      <div class="patterns-card-header">
        <h3 class="patterns-title">Your Patterns</h3>
        <span class="patterns-subtitle">Analyzing your evaluation history…</span>
      </div>
      <div class="patterns-loading-spinner">
        <span class="spinner"></span>
      </div>
    </div>
  `;
  container.classList.add('visible');

  try {
    const patterns = await generatePatternSummary(evaluations);
    displayPatternSummary(patterns, evaluations, container);
  } catch (error) {
    console.warn('Pattern summary failed:', error);
    container.innerHTML = '';
    container.classList.remove('visible');
  }
}

function displayPatternSummary(patterns, evaluations, container) {
  const goodCount = evaluations.filter(e => e.verdict === 'Good Fit').length;
  const riskyCount = evaluations.filter(e => e.verdict === 'Risky').length;
  const badCount = evaluations.filter(e => e.verdict === 'Bad Fit').length;

  const patternsListHtml = patterns.map(p =>
    `<li class="pattern-item">${escapeHtml(p)}</li>`
  ).join('');

  container.innerHTML = `
    <div class="patterns-card">
      <div class="patterns-card-header">
        <div class="patterns-header-left">
          <h3 class="patterns-title">Your Patterns</h3>
          <span class="patterns-subtitle">Based on ${evaluations.length} saved evaluations</span>
        </div>
      </div>

      <div class="patterns-stats-row">
        <div class="patterns-stat">
          <span class="patterns-stat-number stat-good">${goodCount}</span>
          <span class="patterns-stat-label">Good Fit</span>
        </div>
        <div class="patterns-stat">
          <span class="patterns-stat-number stat-risky">${riskyCount}</span>
          <span class="patterns-stat-label">Risky</span>
        </div>
        <div class="patterns-stat">
          <span class="patterns-stat-number stat-bad">${badCount}</span>
          <span class="patterns-stat-label">Bad Fit</span>
        </div>
      </div>

      <ul class="patterns-list">
        ${patternsListHtml}
      </ul>
    </div>
  `;
  container.classList.add('visible');
}
