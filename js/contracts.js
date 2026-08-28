// ============================================
// Contracts Tab — Contract Fine-Print Translator
// Analyzes contract clauses and explains them
// in plain English for content creators.
// ============================================

let contractTipRotationInterval = null;

function initContracts() {
  const explainBtn = document.getElementById('explain-contract-btn');
  const contractInput = document.getElementById('contract-input');

  if (explainBtn) {
    explainBtn.addEventListener('click', handleExplainContract);
  }

  if (contractInput) {
    contractInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleExplainContract();
      }
    });
  }
}

async function handleExplainContract() {
  const contractInput = document.getElementById('contract-input');
  const errorEl = document.getElementById('contract-error');
  const resultEl = document.getElementById('contract-result');
  const explainBtn = document.getElementById('explain-contract-btn');

  // Clear previous state
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
  resultEl.innerHTML = '';
  resultEl.classList.remove('visible');

  const contractText = contractInput.value.trim();

  if (!contractText) {
    errorEl.textContent = 'Please paste some contract or agreement text to translate.';
    errorEl.classList.add('visible');
    return;
  }

  const wordCount = contractText.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 5) {
    errorEl.textContent = 'Please paste a complete contract clause or sentence (at least 5 words).';
    errorEl.classList.add('visible');
    return;
  }

  // Play click audio & start loading state
  if (typeof playClickSound === 'function') playClickSound();
  startContractLoading(resultEl, explainBtn);

  try {
    const result = await explainContract(contractText);
    stopContractLoading(explainBtn);
    displayContractResult(result, resultEl);

    // Update mascot based on clause severity
    if (typeof setMascotState === 'function') {
      const clauseCount = (result.clauses || []).length;
      if (clauseCount === 0) setMascotState('Good Fit');
      else if (clauseCount <= 2) setMascotState('Risky');
      else setMascotState('Bad Fit');
    }
  } catch (error) {
    stopContractLoading(explainBtn);
    if (typeof setMascotState === 'function') setMascotState('idle');
    errorEl.textContent = `Error: ${error.message}`;
    errorEl.classList.add('visible');
    resultEl.classList.remove('visible');
  }
}

function startContractLoading(resultEl, explainBtn) {
  explainBtn.disabled = true;
  explainBtn.innerHTML = '<span class="spinner"></span> Translating Clauses…';

  let currentTipIdx = Math.floor(Math.random() * CREATOR_TIPS.length);

  resultEl.innerHTML = `
    <div class="result-card loading-state-card">
      <div class="loading-state-header">
        <div class="loading-indicator-badge">
          <span class="spinner"></span>
          <span class="loading-label">Translating contract clauses with AI…</span>
        </div>
      </div>
      <div class="loading-tip-wrapper">
        <p id="contract-rotating-tip-text" class="loading-rotating-tip">${escapeHtml(CREATOR_TIPS[currentTipIdx])}</p>
      </div>
    </div>
  `;
  resultEl.classList.add('visible');

  if (contractTipRotationInterval) clearInterval(contractTipRotationInterval);
  contractTipRotationInterval = setInterval(() => {
    const tipEl = document.getElementById('contract-rotating-tip-text');
    if (!tipEl) return;
    currentTipIdx = (currentTipIdx + 1) % CREATOR_TIPS.length;
    tipEl.classList.add('tip-fade-out');
    setTimeout(() => {
      if (!tipEl) return;
      tipEl.textContent = CREATOR_TIPS[currentTipIdx];
      tipEl.classList.remove('tip-fade-out');
    }, 250);
  }, 2000);
}

function stopContractLoading(explainBtn) {
  if (contractTipRotationInterval) {
    clearInterval(contractTipRotationInterval);
    contractTipRotationInterval = null;
  }
  explainBtn.disabled = false;
  explainBtn.innerHTML = 'Explain Clauses';
}

function displayContractResult(result, container) {
  const clauses = result.clauses || [];

  const summaryHtml = result.summary ? `
    <div class="contract-summary-card">
      <div class="contract-summary-header">
        <span class="summary-badge">Summary Overview</span>
      </div>
      <p class="contract-summary-text">${escapeHtml(result.summary)}</p>
    </div>
  ` : '';

  const clausesHtml = clauses.map(clause => `
    <div class="clause-card">
      <div class="clause-card-header">
        <h4 class="clause-title">${escapeHtml(clause.title || 'Clause Analysis')}</h4>
      </div>
      
      ${clause.quote ? `
        <div class="clause-quote-box">
          <span class="clause-box-label">Clause Quoted:</span>
          <p class="clause-quote-text">“${escapeHtml(clause.quote)}”</p>
        </div>
      ` : ''}

      <div class="clause-detail-row">
        <span class="clause-field-label">→ Plain-English Meaning:</span>
        <p class="clause-field-text">${escapeHtml(clause.meaning)}</p>
      </div>

      <div class="clause-detail-row">
        <span class="clause-field-label">→ Why It Matters:</span>
        <p class="clause-field-text highlight-risk">${escapeHtml(clause.why_it_matters)}</p>
      </div>
    </div>
  `).join('');

  const rawSection = result.rawResponse ? `
    <details class="debug-raw-response">
      <summary>View Raw AI Response</summary>
      <pre><code>${escapeHtml(result.rawResponse)}</code></pre>
    </details>
  ` : '';

  container.innerHTML = `
    <div class="result-card contract-result-card">
      <div class="contract-results-header">
        <h3 class="contract-results-title">Contract Breakdown</h3>
        <span class="contract-results-count">${clauses.length} clause${clauses.length === 1 ? '' : 's'} analyzed</span>
      </div>

      ${summaryHtml}

      <div class="clauses-list">
        ${clausesHtml}
      </div>

      ${rawSection}
    </div>
  `;
  container.classList.add('visible');
}
