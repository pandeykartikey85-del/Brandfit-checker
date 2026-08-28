// ============================================
// Payment Tracker Module
// Tracks accepted brand deals and expected
// payment dates, flagging overdue payments.
// ============================================

let currentModalContext = null;

function initPayments() {
  const overlay = document.getElementById('payment-modal-overlay');
  const modal = document.getElementById('payment-modal');
  const closeBtn = document.getElementById('payment-modal-close');
  const form = document.getElementById('payment-modal-form');
  const cancelBtn = document.getElementById('payment-modal-cancel');
  const dateInput = document.getElementById('payment-due-date');

  if (!overlay || !modal) return;

  // Close handlers
  const closeModal = () => {
    overlay.classList.remove('visible', 'active');
    modal.classList.remove('visible', 'active');
    currentModalContext = null;
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  // Quick preset buttons (+15, +30, +45, +60 days)
  const presetBtns = modal.querySelectorAll('.btn-date-preset');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days, 10) || 30;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      
      presetBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Form submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const expectedDate = dateInput.value;
      console.log('[AcceptDeal:Submit] Form submitted, date:', expectedDate, 'context:', currentModalContext);
      if (!expectedDate || !currentModalContext) {
        console.warn('[AcceptDeal:Submit] Missing date or context, aborting');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
      }

      try {
        const dealData = {
          evaluationId: currentModalContext.evaluationId || null,
          pitchSnippet: currentModalContext.pitchSnippet || '',
          fullPitch: currentModalContext.fullPitch || '',
          verdict: currentModalContext.verdict || 'Good Fit',
          expectedPaymentDate: expectedDate
        };
        console.log('[AcceptDeal:Submit] Calling savePaymentDeal with:', dealData);
        const savedRecord = await savePaymentDeal(dealData);
        console.log('[AcceptDeal:Submit] savePaymentDeal returned:', savedRecord);

        if (typeof playClickSound === 'function') playClickSound();

        // Update button in place if triggered from Checker or History
        if (currentModalContext.triggerButton) {
          currentModalContext.triggerButton.textContent = '✓ Deal Accepted';
          currentModalContext.triggerButton.classList.add('deal-accepted');
          currentModalContext.triggerButton.disabled = true;
        }

        closeModal();
        updatePaymentNavBadge();

        // If currently on Payments tab, refresh it
        const paymentsTab = document.getElementById('tab-payments');
        if (paymentsTab && paymentsTab.classList.contains('active')) {
          loadPayments();
        }
      } catch (err) {
        console.error('Failed to save accepted deal:', err);
        alert('Could not save deal payment date. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Payment Date';
        }
      }
    });
  }
}

function openAcceptDealModal(context) {
  console.log('[AcceptDeal] openAcceptDealModal called with context:', context);
  currentModalContext = context;
  const overlay = document.getElementById('payment-modal-overlay');
  const modal = document.getElementById('payment-modal');
  const dateInput = document.getElementById('payment-due-date');
  const previewEl = document.getElementById('payment-modal-pitch-preview');

  console.log('[AcceptDeal] DOM elements found:', {
    overlay: !!overlay,
    modal: !!modal,
    dateInput: !!dateInput,
    previewEl: !!previewEl
  });

  if (!overlay || !modal || !dateInput) {
    console.error('[AcceptDeal] Missing required DOM elements, aborting modal open');
    return;
  }

  const presetBtns = modal.querySelectorAll('.btn-date-preset');

  // No min-date restriction — creators may need to backdate deals already due
  const today = new Date();

  // Default to +30 days
  const defaultTarget = new Date();
  defaultTarget.setDate(defaultTarget.getDate() + 30);
  const defYyyy = defaultTarget.getFullYear();
  const defMm = String(defaultTarget.getMonth() + 1).padStart(2, '0');
  const defDd = String(defaultTarget.getDate()).padStart(2, '0');
  dateInput.value = `${defYyyy}-${defMm}-${defDd}`;

  presetBtns.forEach(b => {
    b.classList.toggle('selected', b.dataset.days === '30');
  });

  // Preview snippet
  if (previewEl) {
    const snippet = (context.pitchSnippet || context.fullPitch || '').trim();
    previewEl.textContent = snippet.length > 120 ? snippet.substring(0, 117) + '…' : snippet;
  }

  overlay.classList.add('visible', 'active');
  modal.classList.add('visible', 'active');
  console.log('[AcceptDeal] Modal opened, overlay/modal classes:', overlay.className, modal.className);
  dateInput.focus();
}

function getDaysDiff(dateStr) {
  if (!dateStr) return 0;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'No date set';
  try {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

async function loadPayments() {
  const container = document.getElementById('tab-payments');
  if (!container) return;

  const listContainer = container.querySelector('#payments-list-container');
  const statsContainer = container.querySelector('#payments-stats-bar');
  const emptyState = container.querySelector('#payments-empty');
  const loadingState = container.querySelector('#payments-loading');

  if (loadingState) loadingState.style.display = 'flex';
  if (listContainer) listContainer.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';

  try {
    const deals = await getPaymentDeals();

    if (loadingState) loadingState.style.display = 'none';

    if (!deals || deals.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (statsContainer) statsContainer.style.display = 'none';
      if (listContainer) listContainer.innerHTML = '';
      updatePaymentNavBadge();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (statsContainer) statsContainer.style.display = 'grid';
    if (listContainer) listContainer.style.display = 'block';

    // Separate deals into categories
    const overdueDeals = [];
    const upcomingDeals = [];
    const paidDeals = [];

    deals.forEach(deal => {
      if (deal.status === 'paid') {
        paidDeals.push(deal);
      } else {
        const diff = getDaysDiff(deal.expected_payment_date);
        if (diff < 0) {
          overdueDeals.push({ ...deal, daysOverdue: Math.abs(diff) });
        } else {
          upcomingDeals.push({ ...deal, daysRemaining: diff });
        }
      }
    });

    // Sort overdue soonest due first (or largest overdue days first)
    overdueDeals.sort((a, b) => b.daysOverdue - a.daysOverdue);
    // Sort upcoming soonest due first
    upcomingDeals.sort((a, b) => a.daysRemaining - b.daysRemaining);
    // Sort paid most recently paid first
    paidDeals.sort((a, b) => (b.paid_at || '').localeCompare(a.paid_at || ''));

    // Update stats bar
    const totalPending = overdueDeals.length + upcomingDeals.length;
    renderPaymentStats(statsContainer, {
      total: deals.length,
      pending: totalPending,
      overdue: overdueDeals.length,
      paid: paidDeals.length
    });

    // Render lists
    let html = '';

    // 1. OVERDUE SECTION (prominently at the top if any exist)
    if (overdueDeals.length > 0) {
      html += `
        <div class="payments-group payments-group-overdue">
          <div class="group-header">
            <div class="group-title-wrapper">
              <span class="group-icon">🚨</span>
              <h3 class="group-title">Overdue Payments (${overdueDeals.length})</h3>
            </div>
            <span class="group-tag tag-overdue">Action Needed</span>
          </div>
          <div class="deals-cards-grid">
            ${overdueDeals.map(renderOverdueDealCard).join('')}
          </div>
        </div>
      `;
    }

    // 2. UPCOMING SECTION
    if (upcomingDeals.length > 0) {
      html += `
        <div class="payments-group payments-group-upcoming">
          <div class="group-header">
            <div class="group-title-wrapper">
              <span class="group-icon">⏳</span>
              <h3 class="group-title">Upcoming Expected Payments (${upcomingDeals.length})</h3>
            </div>
          </div>
          <div class="deals-cards-grid">
            ${upcomingDeals.map(renderUpcomingDealCard).join('')}
          </div>
        </div>
      `;
    }

    // 3. PAID / RESOLVED SECTION
    if (paidDeals.length > 0) {
      html += `
        <div class="payments-group payments-group-paid">
          <div class="group-header">
            <div class="group-title-wrapper">
              <span class="group-icon">✅</span>
              <h3 class="group-title">Paid / Resolved Deals (${paidDeals.length})</h3>
            </div>
          </div>
          <div class="deals-cards-grid">
            ${paidDeals.map(renderPaidDealCard).join('')}
          </div>
        </div>
      `;
    }

    listContainer.innerHTML = html;
    bindPaymentCardActions(listContainer);
    updatePaymentNavBadge(overdueDeals.length);
  } catch (err) {
    console.error('Failed to load payments:', err);
    if (loadingState) loadingState.style.display = 'none';
    if (listContainer) {
      listContainer.style.display = 'block';
      listContainer.innerHTML = `<div class="payments-error">Failed to load payments: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderPaymentStats(container, stats) {
  container.innerHTML = `
    <div class="stat-box">
      <span class="stat-number">${stats.total}</span>
      <span class="stat-label">Total Deals</span>
    </div>
    <div class="stat-box">
      <span class="stat-number">${stats.pending}</span>
      <span class="stat-label">Pending</span>
    </div>
    <div class="stat-box ${stats.overdue > 0 ? 'stat-box-overdue' : ''}">
      <span class="stat-number stat-overdue-count">${stats.overdue}</span>
      <span class="stat-label">${stats.overdue > 0 ? '🚨 Overdue' : 'Overdue'}</span>
    </div>
    <div class="stat-box">
      <span class="stat-number stat-paid-count">${stats.paid}</span>
      <span class="stat-label">Paid</span>
    </div>
  `;
}

function renderOverdueDealCard(deal) {
  const snippet = escapeHtml(deal.pitch_snippet || deal.full_pitch || 'Brand collaboration');
  const dateFormatted = formatDisplayDate(deal.expected_payment_date);

  return `
    <div class="payment-deal-card card-overdue" data-deal-id="${escapeHtml(deal.id)}">
      <div class="deal-card-top">
        <span class="badge-overdue-flag">⚠️ Overdue by ${deal.daysOverdue} day${deal.daysOverdue === 1 ? '' : 's'} — follow up</span>
        <span class="deal-verdict-tag verdict-${(deal.verdict || 'good').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(deal.verdict || '')}</span>
      </div>

      <div class="deal-pitch-snippet">
        "${snippet}"
      </div>

      <div class="deal-card-bottom">
        <div class="deal-date-info">
          <span class="date-label">Expected Payment:</span>
          <span class="date-value text-red">${dateFormatted}</span>
        </div>
        <button class="btn btn-mark-paid" data-action="mark-paid" data-id="${escapeHtml(deal.id)}">
          ✓ Mark as Paid
        </button>
      </div>
    </div>
  `;
}

function renderUpcomingDealCard(deal) {
  const snippet = escapeHtml(deal.pitch_snippet || deal.full_pitch || 'Brand collaboration');
  const dateFormatted = formatDisplayDate(deal.expected_payment_date);
  const dueText = deal.daysRemaining === 0
    ? 'Due today!'
    : `Due in ${deal.daysRemaining} day${deal.daysRemaining === 1 ? '' : 's'}`;

  return `
    <div class="payment-deal-card card-upcoming" data-deal-id="${escapeHtml(deal.id)}">
      <div class="deal-card-top">
        <span class="badge-upcoming-flag">⏳ ${dueText}</span>
        <span class="deal-verdict-tag verdict-${(deal.verdict || 'good').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(deal.verdict || '')}</span>
      </div>

      <div class="deal-pitch-snippet">
        "${snippet}"
      </div>

      <div class="deal-card-bottom">
        <div class="deal-date-info">
          <span class="date-label">Expected Payment:</span>
          <span class="date-value">${dateFormatted}</span>
        </div>
        <button class="btn btn-mark-paid" data-action="mark-paid" data-id="${escapeHtml(deal.id)}">
          ✓ Mark as Paid
        </button>
      </div>
    </div>
  `;
}

function renderPaidDealCard(deal) {
  const snippet = escapeHtml(deal.pitch_snippet || deal.full_pitch || 'Brand collaboration');
  const dateFormatted = formatDisplayDate(deal.expected_payment_date);

  return `
    <div class="payment-deal-card card-paid" data-deal-id="${escapeHtml(deal.id)}">
      <div class="deal-card-top">
        <span class="badge-paid-flag">✅ Paid</span>
        <span class="deal-verdict-tag verdict-${(deal.verdict || 'good').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(deal.verdict || '')}</span>
      </div>

      <div class="deal-pitch-snippet">
        "${snippet}"
      </div>

      <div class="deal-card-bottom">
        <div class="deal-date-info">
          <span class="date-label">Paid:</span>
          <span class="date-value text-muted">${dateFormatted}</span>
        </div>
        <span class="paid-check-mark">Resolved</span>
      </div>
    </div>
  `;
}

function bindPaymentCardActions(container) {
  const markPaidBtns = container.querySelectorAll('[data-action="mark-paid"]');
  markPaidBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const dealId = btn.dataset.id;
      if (!dealId) return;

      btn.disabled = true;
      btn.textContent = 'Updating…';

      try {
        await markPaymentAsPaid(dealId);
        if (typeof playVerdictSound === 'function') playVerdictSound('Good Fit');
        loadPayments();
      } catch (err) {
        console.error('Failed to mark deal as paid:', err);
        btn.disabled = false;
        btn.textContent = '✓ Mark as Paid';
      }
    });
  });
}

function updatePaymentNavBadge(explicitOverdueCount) {
  const badgeEl = document.getElementById('payments-badge');
  if (!badgeEl) return;

  if (typeof explicitOverdueCount === 'number') {
    if (explicitOverdueCount > 0) {
      badgeEl.textContent = String(explicitOverdueCount);
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
    }
    return;
  }

  // Calculate from local records
  try {
    const deals = getLocalPayments();
    let overdueCount = 0;
    deals.forEach(d => {
      if (d.status !== 'paid' && getDaysDiff(d.expected_payment_date) < 0) {
        overdueCount++;
      }
    });

    if (overdueCount > 0) {
      badgeEl.textContent = String(overdueCount);
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
    }
  } catch (e) {
    badgeEl.style.display = 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
