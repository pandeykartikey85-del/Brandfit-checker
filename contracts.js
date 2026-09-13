// ============================================
// Contracts Tab — Contract Fine-Print Translator
// Analyzes contract clauses and explains them
// in plain English for content creators.
// Supports: Paste Text & Upload Screenshot / Image
// ============================================

let contractTipRotationInterval = null;
let activeContractInputMode = 'text'; // 'text' | 'image'
let uploadedContractImageData = null; // { mimeType, data, name }

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

  initContractInputModeTabs();
  initContractScreenshotDropzone();
}

function initContractInputModeTabs() {
  const modeButtons = document.querySelectorAll('.contract-input-mode-tabs .input-mode-btn');
  if (!modeButtons.length) return;

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.getAttribute('data-contract-input-mode');
      if (!targetMode) return;

      activeContractInputMode = targetMode;

      modeButtons.forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const panelText = document.getElementById('panel-contract-text');
      const panelImage = document.getElementById('panel-contract-image');

      if (panelText) panelText.classList.toggle('active', targetMode === 'text');
      if (panelImage) panelImage.classList.toggle('active', targetMode === 'image');
    });
  });
}

function initContractScreenshotDropzone() {
  const dropzone = document.getElementById('contract-dropzone');
  const fileInput = document.getElementById('contract-file-input');
  const removeBtn = document.getElementById('btn-remove-contract-img');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleContractImageFile(file);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleContractImageFile(file);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', resetContractScreenshotInput);
  }
}

function handleContractImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, WEBP, or GIF).');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const [header, base64Data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || file.type;

    uploadedContractImageData = {
      mimeType,
      data: base64Data,
      name: file.name
    };

    // Show preview UI
    const previewContainer = document.getElementById('contract-preview-container');
    const previewImg = document.getElementById('contract-preview-img');
    const filenameEl = document.getElementById('contract-filename');
    const dropzone = document.getElementById('contract-dropzone');
    const ocrIndicator = document.getElementById('contract-ocr-status');
    const extractedTextarea = document.getElementById('extracted-contract-text');

    if (previewImg) previewImg.src = dataUrl;
    if (filenameEl) filenameEl.textContent = file.name;
    if (dropzone) dropzone.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'block';

    // Run OCR extraction via Gemini
    if (ocrIndicator) {
      ocrIndicator.style.display = 'inline-flex';
      ocrIndicator.innerHTML = '<span class="ocr-spinner"></span> Extracting contract text with AI…';
      ocrIndicator.className = 'ocr-status-indicator';
    }

    try {
      if (typeof extractTextFromImage === 'function') {
        const extractedText = await extractTextFromImage({ mimeType, data: base64Data });
        if (extractedTextarea) {
          extractedTextarea.value = extractedText;
        }
        if (ocrIndicator) {
          ocrIndicator.innerHTML = '✓ Contract text extracted successfully';
          ocrIndicator.classList.add('ocr-complete');
        }
      }
    } catch (err) {
      console.warn('Contract OCR extraction failed:', err);
      if (ocrIndicator) {
        if (err && err.isRateLimit) {
          ocrIndicator.innerHTML = '⚠️ Daily free limit reached. <a href="#" onclick="if(typeof showSettingsModal===\'function\')showSettingsModal();return false;" style="text-decoration:underline;font-weight:600;color:inherit;">Enter your API key</a> or type text manually.';
        } else {
          ocrIndicator.innerHTML = '⚠️ Could not auto-extract text. You can type or paste contract text directly.';
        }
        ocrIndicator.classList.add('ocr-error');
      }
    } finally {
      // Memory Hygiene: Clean up base64 payload from in-memory object once OCR processing is completed
      if (uploadedContractImageData) {
        uploadedContractImageData.data = null;
      }
    }
  };

  reader.readAsDataURL(file);
}

function resetContractScreenshotInput() {
  uploadedContractImageData = null;
  const fileInput = document.getElementById('contract-file-input');
  const previewContainer = document.getElementById('contract-preview-container');
  const dropzone = document.getElementById('contract-dropzone');
  const extractedTextarea = document.getElementById('extracted-contract-text');
  const ocrIndicator = document.getElementById('contract-ocr-status');

  if (fileInput) fileInput.value = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (dropzone) dropzone.style.display = 'block';
  if (extractedTextarea) extractedTextarea.value = '';
  if (ocrIndicator) {
    ocrIndicator.className = 'ocr-status-indicator';
    ocrIndicator.style.display = 'none';
  }
}

async function handleExplainContract() {
  const contractInput = document.getElementById('contract-input');
  const extractedContractText = document.getElementById('extracted-contract-text');
  const errorEl = document.getElementById('contract-error');
  const resultEl = document.getElementById('contract-result');
  const explainBtn = document.getElementById('explain-contract-btn');

  // Clear previous state
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
  resultEl.innerHTML = '';
  resultEl.classList.remove('visible');

  let contractText = '';

  if (activeContractInputMode === 'text') {
    contractText = (contractInput ? contractInput.value : '').trim();
  } else if (activeContractInputMode === 'image') {
    contractText = (extractedContractText ? extractedContractText.value : '').trim();
    if (!contractText && uploadedContractImageData && typeof extractTextFromImage === 'function') {
      try {
        contractText = await extractTextFromImage(uploadedContractImageData);
        if (extractedContractText) extractedContractText.value = contractText;
      } catch (err) {
        console.warn('OCR on-demand failed:', err);
      }
    }
  }

  if (!contractText) {
    errorEl.textContent = activeContractInputMode === 'image'
      ? 'Please upload a contract screenshot/image, or switch to Paste Text.'
      : 'Please paste some contract or agreement text to translate.';
    errorEl.classList.add('visible');
    return;
  }

  const wordCount = contractText.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 4) {
    errorEl.textContent = 'Please provide a complete contract clause or sentence (at least 4 words).';
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
    if (error && error.isRateLimit) {
      if (typeof renderRateLimitNoticeCard === 'function') {
        renderRateLimitNoticeCard(resultEl, error.message);
      } else {
        resultEl.innerHTML = `<div class="result-card rate-limit-notice-card"><p>${escapeHtml(error.message)}</p></div>`;
        resultEl.classList.add('visible');
      }
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    } else {
      errorEl.textContent = `Error: ${error.message}`;
      errorEl.classList.add('visible');
      resultEl.classList.remove('visible');
    }
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

  const fairnessBadge = (result.fairnessScore !== null && result.fairnessScore !== undefined) ? `
    <span class="contract-fairness-badge ${getFairnessBadgeClass(result.fairnessScore)}">
      Fairness Score: ${result.fairnessScore}/10
    </span>
  ` : '';

  const recHtml = result.keyRecommendation ? `
    <div class="contract-rec-callout">
      <span class="rec-callout-icon">💡</span>
      <span class="rec-callout-text"><strong>Recommendation:</strong> ${escapeHtml(result.keyRecommendation)}</span>
    </div>
  ` : '';

  const summaryHtml = result.summary ? `
    <div class="contract-summary-card">
      <div class="contract-summary-header">
        <span class="summary-badge">Summary Overview</span>
        ${fairnessBadge}
      </div>
      <p class="contract-summary-text">${escapeHtml(result.summary)}</p>
      ${recHtml}
    </div>
  ` : '';

  const clausesHtml = clauses.map(clause => {
    const severityClass = getSeverityClass(clause.severity);
    const categoryBadge = clause.category ? `<span class="clause-cat-pill">${escapeHtml(clause.category)}</span>` : '';
    const severityBadge = clause.severity ? `<span class="clause-sev-pill ${severityClass}">${escapeHtml(clause.severity)}</span>` : '';

    return `
      <div class="clause-card ${severityClass}">
        <div class="clause-card-header">
          <div class="clause-title-group">
            <h4 class="clause-title">${escapeHtml(clause.title || 'Clause Analysis')}</h4>
            <div class="clause-badges-row">
              ${categoryBadge}
              ${severityBadge}
            </div>
          </div>
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
          <span class="clause-field-label">→ Why It Matters & What to Negotiate:</span>
          <p class="clause-field-text highlight-risk">${escapeHtml(clause.why_it_matters)}</p>
        </div>
      </div>
    `;
  }).join('');

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
        ${clausesHtml || '<p class="text-muted">No restrictive or unusual clauses detected in the provided text.</p>'}
      </div>

      ${rawSection}
    </div>
  `;
  container.classList.add('visible');
}

function getFairnessBadgeClass(score) {
  if (score >= 8) return 'fairness-high';
  if (score >= 5) return 'fairness-medium';
  return 'fairness-low';
}

function getSeverityClass(sev) {
  if (!sev) return 'sev-watch';
  const s = sev.toLowerCase();
  if (s.includes('high')) return 'sev-high';
  if (s.includes('mod')) return 'sev-medium';
  return 'sev-watch';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
