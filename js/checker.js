// ============================================
// Checker Tab
// Handles the main evaluation flow:
// input validation → rules fetch → Gemini call →
// result display → auto-save to Supabase.
// ============================================

function initChecker() {
  document.getElementById('check-btn').addEventListener('click', handleCheckFit);

  // Allow Ctrl+Enter to submit from either textarea
  document.getElementById('pitch-input').addEventListener('keydown', handleCtrlEnter);
  document.getElementById('profile-input').addEventListener('keydown', handleCtrlEnter);
}

function handleCtrlEnter(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleCheckFit();
  }
}

let tipRotationInterval = null;

async function handleCheckFit() {
  const pitchInput = document.getElementById('pitch-input');
  const profileInput = document.getElementById('profile-input');
  const errorEl = document.getElementById('checker-error');
  const resultEl = document.getElementById('checker-result');
  const checkBtn = document.getElementById('check-btn');

  // Clear previous state
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
  resultEl.innerHTML = '';
  resultEl.classList.remove('visible');

  const pitch = pitchInput.value.trim();
  const profile = profileInput.value.trim();

  // Validation: empty fields
  if (!pitch || !profile) {
    errorEl.textContent = 'Please fill in both fields before checking.';
    errorEl.classList.add('visible');
    return;
  }

  // Validation: pitch too short (under 15 words)
  const wordCount = pitch.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 15) {
    errorEl.textContent =
      'This pitch is too short to evaluate properly. Please paste the full pitch message (at least 15 words).';
    errorEl.classList.add('visible');
    return;
  }

  // Play click audio & update mascot to analyzing
  if (typeof playClickSound === 'function') playClickSound();
  if (typeof setMascotState === 'function') setMascotState('analyzing');

  // Show loading card with rotating creator deal tips
  startLoadingState(resultEl, checkBtn);

  try {
    // 1. Fetch personal rules (if any exist)
    let personalRules = '';
    try {
      personalRules = await getUserRules();
    } catch (e) {
      console.warn('Could not fetch personal rules:', e);
    }

    // 2. Call Gemini for evaluation
    const result = await evaluatePitch(pitch, profile, personalRules);

    // Stop rotation before rendering result
    stopLoadingState(checkBtn);

    // 3. Display the result
    displayResult(result, resultEl, pitch);

    // 4. Auto-save to Supabase
    try {
      const reasoningText = result.reasons.join('\n');
      await saveEvaluation(pitch, profile, result.verdict, reasoningText);
      showSaveConfirmation(resultEl);
    } catch (e) {
      console.error('Failed to save evaluation:', e);
      // Don't block the user — result is still shown
    }
  } catch (error) {
    stopLoadingState(checkBtn);
    if (typeof setMascotState === 'function') setMascotState('idle');
    errorEl.textContent = `Error: ${error.message}`;
    errorEl.classList.add('visible');
    resultEl.classList.remove('visible');
  }
}

function startLoadingState(resultEl, checkBtn) {
  checkBtn.disabled = true;
  checkBtn.innerHTML = '<span class="spinner"></span> Analyzing…';

  let currentTipIdx = Math.floor(Math.random() * CREATOR_TIPS.length);

  const placeholder = document.getElementById('checker-empty-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  resultEl.innerHTML = `
    <div class="result-card loading-state-card">
      <div class="loading-state-header">
        <div class="loading-indicator-badge">
          <span class="spinner"></span>
          <span class="loading-label">Evaluating pitch with AI…</span>
        </div>
      </div>
      <div class="loading-tip-wrapper">
        <p id="rotating-tip-text" class="loading-rotating-tip">${escapeHtml(CREATOR_TIPS[currentTipIdx])}</p>
      </div>
    </div>
  `;
  resultEl.classList.add('visible');

  // Cycle through creator tips every 2 seconds
  if (tipRotationInterval) clearInterval(tipRotationInterval);
  tipRotationInterval = setInterval(() => {
    const tipEl = document.getElementById('rotating-tip-text');
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

function stopLoadingState(checkBtn) {
  if (tipRotationInterval) {
    clearInterval(tipRotationInterval);
    tipRotationInterval = null;
  }
  checkBtn.disabled = false;
  checkBtn.innerHTML = 'Check Fit';
}

function displayResult(result, container, originalPitch) {
  const verdictClass = {
    'Good Fit': 'verdict-good',
    'Risky':    'verdict-risky',
    'Bad Fit':  'verdict-bad'
  }[result.verdict] || 'verdict-risky';

  // 1. Reasons HTML
  const reasonsHtml = (result.reasons || [])
    .map(r => `<li>${escapeHtml(cleanModelText(r))}</li>`)
    .join('');

  // 2. Pressure Tactics Detected (Combine AI detection with local regex scanner)
  const localTactics = detectLocalPressureTactics(originalPitch);
  const allTactics = [...(result.manipulationTactics || [])];
  for (const lt of localTactics) {
    const alreadyExists = allTactics.some(t =>
      (t.tactic && t.tactic.toLowerCase() === lt.tactic.toLowerCase()) ||
      (t.quote && lt.quote && (
        t.quote.toLowerCase().includes(lt.quote.toLowerCase()) ||
        lt.quote.toLowerCase().includes(t.quote.toLowerCase())
      ))
    );
    if (!alreadyExists) {
      allTactics.push(lt);
    }
  }

  let pressureTacticsHtml = '';
  if (allTactics.length > 0) {
    const tacticsListHtml = allTactics.map(item => `
      <li class="tactic-item">
        <div class="tactic-top-row">
          <span class="tactic-name-badge">${escapeHtml(cleanModelText(item.tactic))}</span>
          <span class="tactic-quote-snippet">“${escapeHtml(cleanModelText(item.quote))}”</span>
        </div>
        <p class="tactic-desc">${escapeHtml(cleanModelText(item.explanation))}</p>
      </li>
    `).join('');

    pressureTacticsHtml = `
      <div class="result-section pressure-tactics-box">
        <div class="section-header">
          <div class="header-with-badge">
            <h3 class="section-title pressure-tactics-title">Pressure Tactics Detected</h3>
            <span class="badge-tag badge-tag-purple">Psychological Pressure</span>
          </div>
          <span class="section-subtitle">Phrases attempting to rush or pressure decisions</span>
        </div>
        <ul class="tactics-list">
          ${tacticsListHtml}
        </ul>
      </div>
    `;
  }

  // 3. Inline Highlighted Pitch HTML (Collect all trigger phrases, tactics quotes, and reason citations)
  const phrasesToHighlight = new Set();
  (result.highlightPhrases || []).forEach(p => p && phrasesToHighlight.add(p));
  allTactics.forEach(t => t.quote && phrasesToHighlight.add(t.quote));

  (result.reasons || []).forEach(r => {
    const quoteMatches = r.match(/["'“‘]([^"'“”‘’]{2,80})["'”’]/g);
    if (quoteMatches) {
      quoteMatches.forEach(q => {
        const clean = q.replace(/^["'“‘]|["'”’]$/g, '').trim();
        if (clean.length >= 2) phrasesToHighlight.add(clean);
      });
    }
  });

  const highlightedPitchHtml = renderHighlightedPitch(
    originalPitch,
    Array.from(phrasesToHighlight),
    verdictClass
  );

  const pitchCardHtml = `
    <div class="result-section analyzed-pitch-card">
      <div class="section-header">
        <h3 class="section-title">Analyzed Pitch</h3>
        <span class="section-subtitle">Phrases triggering evaluation highlighted</span>
      </div>
      <div class="analyzed-pitch-content">${highlightedPitchHtml}</div>
    </div>
  `;

  // 4. Missing-Info Questions ("Ask the brand this")
  let missingInfoHtml = '';
  if (result.missingInfoQuestions && result.missingInfoQuestions.length > 0) {
    const questionsListHtml = result.missingInfoQuestions
      .map(q => `<li>${escapeHtml(cleanModelText(q))}</li>`)
      .join('');
    
    const allQuestionsText = result.missingInfoQuestions.map(cleanModelText).join('\n');

    missingInfoHtml = `
      <div class="result-section missing-info-box">
        <div class="section-header">
          <div class="header-with-badge">
            <h3 class="section-title">Ask the brand this</h3>
            <span class="badge-tag">Missing Information</span>
          </div>
          <button class="btn-copy-small btn-copy-questions" data-copy="${escapeHtml(allQuestionsText)}">
            Copy Questions
          </button>
        </div>
        <p class="section-intro">This pitch is missing important information to judge all criteria. Send these follow-ups:</p>
        <ul class="questions-list">
          ${questionsListHtml}
        </ul>
      </div>
    `;
  }

  // 5. Response Toolkit ("What should I do?") — for any non-Good-Fit verdict
  let toolkitHtml = '';
  const normalizedVerdict = (result.verdict || '').trim();
  console.log('[BFC Debug] Toolkit check — verdict:', JSON.stringify(normalizedVerdict), '| type:', typeof normalizedVerdict, '| toolkit:', result.toolkit);
  if (normalizedVerdict !== 'Good Fit') {
    const tk = ensureToolkit(result.toolkit, normalizedVerdict, result.reasons);
    const adviceText = cleanModelText(tk.advice);
    const replyText = cleanModelText(tk.writtenReply);
    const talkingPointsHtml = (tk.talkingPoints && tk.talkingPoints.length > 0)
      ? tk.talkingPoints.map(tp => `<li>${escapeHtml(cleanModelText(tp))}</li>`).join('')
      : `<li>${escapeHtml(cleanModelText('Ask for payment details and scope clarification before committing to a call.'))}</li>`;

    toolkitHtml = `
      <div class="result-section toolkit-panel">
        <div class="section-header">
          <h3 class="section-title toolkit-title">What should I do?</h3>
          <span class="section-subtitle">Actionable response toolkit</span>
        </div>

        <div class="toolkit-nav">
          <button class="toolkit-tab-btn active" data-toolkit-tab="advice">Advice</button>
          <button class="toolkit-tab-btn" data-toolkit-tab="reply">Written Reply</button>
          <button class="toolkit-tab-btn" data-toolkit-tab="talking-points">Talking Points</button>
        </div>

        <div class="toolkit-panes">
          <!-- Advice Pane -->
          <div id="toolkit-pane-advice" class="toolkit-pane active">
            <div class="toolkit-advice-content">
              <p>${escapeHtml(adviceText)}</p>
            </div>
          </div>

          <!-- Written Reply Pane -->
          <div id="toolkit-pane-reply" class="toolkit-pane">
            <div class="written-reply-wrapper">
              <div class="reply-header">
                <span class="reply-hint">Ready-to-send reply template</span>
                <button class="btn-copy-small btn-copy-reply" data-copy="${escapeHtml(replyText)}">
                  Copy Reply
                </button>
              </div>
              <div class="written-reply-box">${escapeHtml(replyText)}</div>
            </div>
          </div>

          <!-- Talking Points Pane -->
          <div id="toolkit-pane-talking-points" class="toolkit-pane">
            <p class="talking-points-intro">Confident spoken points if the brand requests a phone or video call:</p>
            <ul class="talking-points-list">
              ${talkingPointsHtml}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // 6. Share / Copy Summary & Accept Deal Actions
  const cleanPitch = (originalPitch || '').trim().replace(/\s+/g, ' ');
  let pitchPreview = '';
  const sentences = cleanPitch.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length > 0) {
    pitchPreview = sentences.slice(0, 2).join('').trim();
    if (pitchPreview.length > 220) {
      pitchPreview = cleanPitch.substring(0, 217).trim() + '...';
    }
  } else {
    pitchPreview = cleanPitch.length > 200 ? cleanPitch.substring(0, 197).trim() + '...' : cleanPitch;
  }

  const reasonsListText = (result.reasons || [])
    .slice(0, 3)
    .map(r => `• ${cleanModelText(r)}`)
    .join('\n');

  const summaryText = `🎯 Brand Fit Evaluation: ${result.verdict}\n\n📩 Pitch:\n"${pitchPreview}"\n\n💡 Key Reasons:\n${reasonsListText}\n\nChecked with Brand Fit Checker`;

  const shareSummaryHtml = `
    <div class="result-section share-summary-section">
      <div class="share-summary-inner">
        <span class="share-summary-hint">Take action on this deal</span>
        <div class="action-buttons-group">
          <button class="btn-action-deal btn-accept-deal" id="btn-accept-deal">
            🤝 Mark as Accepted
          </button>
          <button class="btn-copy-small btn-copy-summary" data-copy="${escapeAttr(summaryText)}">
            📋 Copy Summary
          </button>
        </div>
      </div>
    </div>
  `;

  // 7. Raw Debug Section
  const rawSection = result.rawResponse ? `
    <details class="debug-raw-response">
      <summary>View Raw AI Response</summary>
      <pre><code>${escapeHtml(result.rawResponse)}</code></pre>
    </details>
  ` : '';

  // Render combined card
  container.innerHTML = `
    <div class="result-card">
      <div class="result-top">
        <div class="verdict-badge ${verdictClass}">
          ${escapeHtml(result.verdict)}
        </div>
        <ul class="reasons-list">
          ${reasonsHtml}
        </ul>
      </div>

      ${pressureTacticsHtml}
      ${pitchCardHtml}
      ${missingInfoHtml}
      ${toolkitHtml}
      ${shareSummaryHtml}
      ${rawSection}
    </div>
  `;
  container.classList.add('visible');

  // Bind interactive handlers (Toolkit tabs, Copy buttons, and Accept Deal)
  bindToolkitTabs(container);
  bindCopyButtons(container);

  const acceptBtn = container.querySelector('#btn-accept-deal');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      console.log('[AcceptDeal] Button clicked, calling openAcceptDealModal');
      if (typeof openAcceptDealModal === 'function') {
        openAcceptDealModal({
          pitchSnippet: pitchPreview,
          fullPitch: originalPitch,
          verdict: result.verdict,
          triggerButton: acceptBtn
        });
      } else {
        console.error('[AcceptDeal] openAcceptDealModal function not found');
      }
    });
  } else {
    console.warn('[AcceptDeal] #btn-accept-deal not found in container');
  }

  // Play verdict sound and update mascot reaction
  if (typeof playVerdictSound === 'function') playVerdictSound(result.verdict);
  if (typeof setMascotState === 'function') setMascotState(result.verdict);

  // Trigger verdict micro-animation (Good Fit sparkle, Bad Fit shake, Risky pulse)
  requestAnimationFrame(() => {
    triggerVerdictAnimation(result.verdict, container);
  });
}

function detectLocalPressureTactics(pitchText) {
  if (!pitchText) return [];
  const tactics = [];

  const patterns = [
    {
      regex: /\b(limited\s+time(\s+offer)?|expires?\s+(today|tonight|soon|in\s+\d+)|deadline|act\s+fast|urgent|reply\s+(within|immediately|by\s+today)|asap|time[- ]sensitive)\b/i,
      tactic: 'Artificial Urgency',
      explanation: 'Creates manufactured time pressure to discourage reviewing terms or negotiating rates.'
    },
    {
      regex: /\b(dream\s+(creator|collaborator|partner)|perfect\s+(fit|match|creator)|huge\s+fan|literally\s+our\s+favorite|love\s+your\s+(vibe|content|work)|nobody\s+else\s+can)\b/i,
      tactic: 'Excessive Flattery',
      explanation: 'Uses heightened praise to build quick rapport and disarm negotiation instincts.'
    },
    {
      regex: /\b(thought\s+you('d|\s+would)\s+be\s+excited|don't\s+miss\s+out|rare\s+opportunity|other\s+creators\s+(jumped|already|loved))\b/i,
      tactic: 'Guilt-Tripping',
      explanation: 'Implies ungratefulness or missed opportunity if you ask for standard business terms.'
    },
    {
      regex: /\b(only\s+\d+\s+spot(s)?\s+left|last\s+spot|hand[- ]selected|exclusive\s+roster|selected\s+few)\b/i,
      tactic: 'Artificial Scarcity',
      explanation: 'Creates false exclusivity to rush creators into accepting unfavorable terms without questioning.'
    }
  ];

  for (const p of patterns) {
    const match = pitchText.match(p.regex);
    if (match) {
      tactics.push({
        tactic: p.tactic,
        quote: match[0],
        explanation: p.explanation
      });
    }
  }

  return tactics;
}

function ensureToolkit(toolkit, verdict, reasons) {
  const isBad = verdict === 'Bad Fit';

  if (!toolkit || (!toolkit.advice && !toolkit.writtenReply && (!toolkit.talkingPoints || toolkit.talkingPoints.length === 0))) {
    return {
      advice: isBad
        ? 'This pitch has major red flags (missing payment, vague deliverables, or excessive restrictions). Politely decline or demand clear upfront compensation and terms before doing any work.'
        : 'This pitch has elements worth clarifying. Push for explicit payment numbers, defined deliverables, and clear usage limits before agreeing.',
      writtenReply: isBad
        ? `Hi there,\n\nThank you for reaching out. At this time, I only accept collaboration opportunities that include guaranteed monetary compensation and clearly defined deliverable scopes. I will have to pass on this particular project, but feel free to reach out in the future with paid opportunities.\n\nBest regards,`
        : `Hi there,\n\nThank you for reaching out! I would be interested in discussing this collaboration further. Before we proceed, could you please provide details on the compensation budget, the exact deliverables expected, and the usage rights timeline?\n\nLooking forward to hearing from you,\n[Your Name]`,
      talkingPoints: [
        'Ask for written clarification on payment and compensation terms before committing to next steps.',
        'Clarify the exact scope of deliverables (number of posts, formats, and due dates).',
        'State your standard rate card or minimum baseline for brand collaborations.',
        'Ensure usage rights and ad whitelisting timelines are clearly defined and compensated.'
      ]
    };
  }

  return {
    advice: toolkit.advice || (isBad
      ? 'This pitch contains major issues. Demand written payment and clear deliverables, or decline.'
      : 'Clarify payment terms, timeline, and exact scope of deliverables before committing.'),
    writtenReply: toolkit.writtenReply || (isBad
      ? 'Hi,\n\nThank you for reaching out. I only accept paid collaboration opportunities with clear deliverables. I will have to pass on this project.\n\nBest,'
      : 'Hi,\n\nThank you for considering me for this campaign! Could you please share the compensation budget and the exact deliverables?\n\nBest,'),
    talkingPoints: (toolkit.talkingPoints && toolkit.talkingPoints.length > 0)
      ? toolkit.talkingPoints
      : [
        'Ask for written clarification on compensation terms before committing.',
        'Clarify deliverables and revision scope in writing.',
        'Establish clear usage rights boundaries.'
      ]
  };
}

function renderHighlightedPitch(pitchText, phrases, verdictClass) {
  if (!pitchText) return '';
  if (!phrases || phrases.length === 0) {
    return escapeHtml(pitchText);
  }

  const lowerPitch = pitchText.toLowerCase();
  const ranges = [];

  function addPhraseRanges(rawPhrase) {
    if (!rawPhrase || typeof rawPhrase !== 'string') return;
    // Strip leading/trailing quotes and punctuation
    const cleanPhrase = rawPhrase.replace(/^[\s"'“”‘’.,!?:;*—–-]+|[\s"'“”‘’.,!?:;*—–-]+$/g, '').trim();
    if (cleanPhrase.length < 2) return;

    const lowerPhrase = cleanPhrase.toLowerCase();
    let startIdx = 0;
    let found = false;

    while ((startIdx = lowerPitch.indexOf(lowerPhrase, startIdx)) !== -1) {
      ranges.push({
        start: startIdx,
        end: startIdx + cleanPhrase.length
      });
      startIdx += cleanPhrase.length;
      found = true;
    }

    // If full multi-word phrase was not found, check sub-phrases or segments
    if (!found && cleanPhrase.includes(' ')) {
      const parts = cleanPhrase.split(/[\,\;\:\–\—\.]|\s{2,}|\band\b|\bwith\b/i)
        .map(p => p.trim())
        .filter(p => p.length >= 4);

      for (const part of parts) {
        let pIdx = 0;
        const lowerPart = part.toLowerCase();
        while ((pIdx = lowerPitch.indexOf(lowerPart, pIdx)) !== -1) {
          ranges.push({
            start: pIdx,
            end: pIdx + part.length
          });
          pIdx += part.length;
        }
      }
    }
  }

  for (const p of phrases) {
    addPhraseRanges(p);
  }

  if (ranges.length === 0) {
    return escapeHtml(pitchText);
  }

  // Sort ranges by start position, then by length descending
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  // Merge overlapping or adjacent ranges
  const merged = [];
  let current = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  // Build highlighted HTML with proper escaping
  let resultHtml = '';
  let lastIndex = 0;

  for (const r of merged) {
    if (r.start > lastIndex) {
      resultHtml += escapeHtml(pitchText.substring(lastIndex, r.start));
    }
    const highlightedSlice = pitchText.substring(r.start, r.end);
    resultHtml += `<mark class="pitch-highlight ${verdictClass}">${escapeHtml(highlightedSlice)}</mark>`;
    lastIndex = r.end;
  }

  if (lastIndex < pitchText.length) {
    resultHtml += escapeHtml(pitchText.substring(lastIndex));
  }

  return resultHtml;
}

function bindToolkitTabs(container) {
  const tabButtons = container.querySelectorAll('.toolkit-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.toolkitTab;
      tabButtons.forEach(b => b.classList.toggle('active', b === btn));
      container.querySelectorAll('.toolkit-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `toolkit-pane-${targetTab}`);
      });
    });
  });
}

function bindCopyButtons(container) {
  container.querySelectorAll('.btn-copy-small').forEach(btn => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.dataset.copy;
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.textContent;
        btn.textContent = 'Copied! ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });
  });
}

function showSaveConfirmation(container) {
  const confirm = document.createElement('div');
  confirm.className = 'save-confirm';
  confirm.textContent = 'Saved to history ✓';
  container.appendChild(confirm);

  // Animate in
  requestAnimationFrame(() => confirm.classList.add('visible'));

  // Animate out after 2.5s
  setTimeout(() => {
    confirm.classList.remove('visible');
    setTimeout(() => confirm.remove(), 300);
  }, 2500);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function escapeAttr(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
