// ============================================
// Dashboard Module
// Provides real-time, data-backed dashboards for:
// - Creator Mode ("Brand Fit"): Deals evaluated, fit breakdowns, pending & overdue payments
// - Brand Mode ("Creator Fit"): Creators evaluated, candidate tiers, campaigns & profile readiness
// Note: Displays clean empty states whenever there is no underlying data — never invents metrics!
// ============================================

function initDashboard() {
  // Initialized on app boot
}

async function renderDashboard() {
  const container = document.getElementById('dashboard-content-container');
  if (!container) return;

  const currentMode = typeof getUserMode === 'function' ? getUserMode() : 'creator';

  if (currentMode === 'brand') {
    await renderBrandDashboard(container);
  } else {
    await renderCreatorDashboard(container);
  }
}

// ============================================
// Creator Mode Dashboard ("Brand Fit")
// ============================================
async function renderCreatorDashboard(container) {
  // Fetch actual evaluations
  let evaluations = [];
  try {
    if (typeof getEvaluations === 'function') {
      evaluations = await getEvaluations(100);
    } else if (typeof getLocalEvaluations === 'function') {
      evaluations = getLocalEvaluations();
    }
  } catch (err) {
    console.warn('[Dashboard] Could not fetch evaluations:', err);
    if (typeof getLocalEvaluations === 'function') {
      evaluations = getLocalEvaluations();
    }
  }

  // Filter creator evaluations (standard verdicts)
  const creatorEvals = (evaluations || []).filter(e => {
    const v = (e.verdict || '').trim();
    return v === 'Good Fit' || v === 'Risky' || v === 'Bad Fit' || !e.verdict;
  });

  // Fetch actual payments
  let deals = [];
  try {
    if (typeof getPaymentDeals === 'function') {
      deals = await getPaymentDeals();
    } else if (typeof getLocalPayments === 'function') {
      deals = getLocalPayments();
    }
  } catch (err) {
    console.warn('[Dashboard] Could not fetch payments:', err);
    if (typeof getLocalPayments === 'function') {
      deals = getLocalPayments();
    }
  }

  // Fetch creator profile for context card
  let profile = null;
  try {
    if (typeof getCreatorProfile === 'function') {
      profile = await getCreatorProfile();
    } else if (typeof getLocalCreatorProfile === 'function') {
      profile = getLocalCreatorProfile();
    }
  } catch (e) {
    if (typeof getLocalCreatorProfile === 'function') {
      profile = getLocalCreatorProfile();
    }
  }

  // Calculate payment stats
  let pendingCount = 0;
  let overdueCount = 0;
  let paidCount = 0;

  (deals || []).forEach(deal => {
    if (deal.status === 'paid') {
      paidCount++;
    } else {
      const diff = typeof getDaysDiff === 'function' ? getDaysDiff(deal.expected_payment_date) : 0;
      if (diff < 0) {
        overdueCount++;
      } else {
        pendingCount++;
      }
    }
  });

  const totalEvaluated = creatorEvals.length;
  const goodFitCount = creatorEvals.filter(e => e.verdict === 'Good Fit').length;
  const riskyCount = creatorEvals.filter(e => e.verdict === 'Risky').length;
  const badFitCount = creatorEvals.filter(e => e.verdict === 'Bad Fit').length;

  // If there are zero evaluations and zero payments, show empty state
  if (totalEvaluated === 0 && (deals || []).length === 0) {
    container.innerHTML = `
      <div class="dashboard-header">
        <div>
          <h2 class="dashboard-title">Creator Dashboard</h2>
          <p class="dashboard-subtitle text-muted">Summary of brand collaboration opportunities and payments</p>
        </div>
      </div>

      <div class="dashboard-empty-card">
        <div class="dashboard-empty-icon">📊</div>
        <h3 class="dashboard-empty-title">No brand deals evaluated yet</h3>
        <p class="dashboard-empty-text text-muted">
          Your dashboard will automatically track pitch opportunities, fit breakdowns, and payments as you check brand pitches.
        </p>
        <div class="dashboard-empty-actions">
          <button type="button" class="btn btn-primary" onclick="showTab('checker')">
            Check Your First Pitch →
          </button>
          <button type="button" class="btn btn-secondary" onclick="showTab('profile')">
            Complete Creator Profile
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Render full creator dashboard with real data
  const recentEvals = creatorEvals.slice(0, 3);

  container.innerHTML = `
    <div class="dashboard-header">
      <div>
        <h2 class="dashboard-title">Creator Dashboard</h2>
        <p class="dashboard-subtitle text-muted">Real-time breakdown of evaluated brand deals and payments</p>
      </div>
      <div class="dashboard-actions">
        <button type="button" class="btn btn-primary btn-sm" onclick="showTab('checker')">
          + Check New Pitch
        </button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="dashboard-stats-grid">
      <div class="dashboard-stat-card">
        <div class="stat-card-top">
          <span class="stat-card-label">Deals Evaluated</span>
          <span class="stat-card-icon">📬</span>
        </div>
        <div class="stat-card-value">${totalEvaluated}</div>
        <div class="stat-card-subtext text-muted">Lifetime pitches analyzed</div>
      </div>

      <div class="dashboard-stat-card stat-card-good">
        <div class="stat-card-top">
          <span class="stat-card-label">Good Fit</span>
          <span class="stat-card-icon">🌟</span>
        </div>
        <div class="stat-card-value">${goodFitCount}</div>
        <div class="stat-card-subtext text-muted">High-synergy opportunities</div>
      </div>

      <div class="dashboard-stat-card stat-card-risky">
        <div class="stat-card-top">
          <span class="stat-card-label">Risky Opportunities</span>
          <span class="stat-card-icon">⚠️</span>
        </div>
        <div class="stat-card-value">${riskyCount}</div>
        <div class="stat-card-subtext text-muted">Require negotiation or caution</div>
      </div>

      <div class="dashboard-stat-card stat-card-bad">
        <div class="stat-card-top">
          <span class="stat-card-label">Bad Fit</span>
          <span class="stat-card-icon">🛑</span>
        </div>
        <div class="stat-card-value">${badFitCount}</div>
        <div class="stat-card-subtext text-muted">Decline or predatory terms</div>
      </div>
    </div>

    <!-- Payments Overview Row -->
    <div class="dashboard-section-card payments-overview-card">
      <div class="dash-card-header">
        <div class="dash-card-title-group">
          <span class="dash-section-icon">💳</span>
          <div>
            <h3 class="dash-card-title">Payment Pipeline</h3>
            <span class="dash-card-subtitle text-muted">Tracked invoices and pending payments</span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('payments')">
          View All Payments →
        </button>
      </div>

      <div class="dash-payments-stat-row">
        <div class="dash-payment-pill ${overdueCount > 0 ? 'pill-overdue' : 'pill-neutral'}">
          <span class="pill-label">Overdue</span>
          <strong class="pill-val">${overdueCount}</strong>
        </div>
        <div class="dash-payment-pill ${pendingCount > 0 ? 'pill-pending' : 'pill-neutral'}">
          <span class="pill-label">Upcoming / Pending</span>
          <strong class="pill-val">${pendingCount}</strong>
        </div>
        <div class="dash-payment-pill pill-paid">
          <span class="pill-label">Settled / Paid</span>
          <strong class="pill-val">${paidCount}</strong>
        </div>
      </div>
    </div>

    <!-- Two-column grid: Profile Context + Recent Deals -->
    <div class="dashboard-grid-2col">
      <!-- Profile Context Card -->
      <div class="dashboard-section-card">
        <div class="dash-card-header">
          <div class="dash-card-title-group">
            <span class="dash-section-icon">👤</span>
            <div>
              <h3 class="dash-card-title">Creator Profile Context</h3>
              <span class="dash-card-subtitle text-muted">Benchmarking your pitch evaluations</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('profile')">Edit Profile</button>
        </div>

        ${profile && (profile.name || profile.main_niche || profile.min_acceptable_payment) ? `
          <div class="dash-profile-details">
            <div class="dash-profile-item">
              <span class="item-label">Name / Channel:</span>
              <strong>${escapeDashboardHtml(profile.name || 'Not specified')}</strong>
            </div>
            <div class="dash-profile-item">
              <span class="item-label">Primary Niche:</span>
              <strong>${escapeDashboardHtml(profile.main_niche || 'General')}</strong>
            </div>
            <div class="dash-profile-item">
              <span class="item-label">Payment Floor:</span>
              <strong>${escapeDashboardHtml(profile.min_acceptable_payment || 'None set')}</strong>
            </div>
            <div class="dash-profile-item">
              <span class="item-label">Standard Rates:</span>
              <strong>${escapeDashboardHtml(profile.typical_rates || 'None set')}</strong>
            </div>
          </div>
        ` : `
          <div class="dash-item-empty">
            <p class="text-muted">No creator profile saved yet. Add your niche and rates so evaluations can flag underpaying deals.</p>
            <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('profile')">Setup Profile</button>
          </div>
        `}
      </div>

      <!-- Recent Evaluations Card -->
      <div class="dashboard-section-card">
        <div class="dash-card-header">
          <div class="dash-card-title-group">
            <span class="dash-section-icon">🕒</span>
            <div>
              <h3 class="dash-card-title">Recent Opportunities</h3>
              <span class="dash-card-subtitle text-muted">Latest analyzed pitches</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('history')">View All History →</button>
        </div>

        <div class="dash-recent-list">
          ${recentEvals.map(ev => {
            const verdict = ev.verdict || 'Risky';
            const badgeClass = verdict === 'Good Fit' ? 'verdict-good' : verdict === 'Bad Fit' ? 'verdict-bad' : 'verdict-risky';
            const cleanText = (ev.pitch_text || '').replace(/\s+/g, ' ').trim();
            const preview = cleanText.length > 90 ? cleanText.substring(0, 87) + '…' : cleanText;
            const dateStr = ev.created_at ? new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return `
              <div class="dash-recent-item" onclick="showTab('history')">
                <div class="dash-recent-top">
                  <span class="verdict-badge-sm ${badgeClass}">${escapeDashboardHtml(verdict)}</span>
                  <span class="dash-recent-date text-muted">${dateStr}</span>
                </div>
                <p class="dash-recent-pitch">${escapeDashboardHtml(preview)}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Brand Mode Dashboard ("Creator Fit")
// ============================================
async function renderBrandDashboard(container) {
  // Fetch actual evaluations
  let evaluations = [];
  try {
    if (typeof getEvaluations === 'function') {
      evaluations = await getEvaluations(100);
    } else if (typeof getLocalEvaluations === 'function') {
      evaluations = getLocalEvaluations();
    }
  } catch (err) {
    console.warn('[Dashboard] Could not fetch brand evaluations:', err);
    if (typeof getLocalEvaluations === 'function') {
      evaluations = getLocalEvaluations();
    }
  }

  // Filter Brand mode evaluations (identified by recommendation verdicts)
  const brandVerdicts = ['Strongly Consider', 'Consider', 'Request More Information', 'Negotiate', 'Low Priority', 'Reject'];
  const brandEvals = (evaluations || []).filter(e => {
    const v = (e.verdict || '').trim();
    return brandVerdicts.includes(v);
  });

  // Fetch saved Brand Profile
  let brandProfile = null;
  try {
    if (typeof getBrandProfile === 'function') {
      brandProfile = await getBrandProfile();
    } else if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }
  } catch (e) {
    if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }
  }

  const totalCreators = brandEvals.length;
  const strongCandidates = brandEvals.filter(e => e.verdict === 'Strongly Consider' || e.verdict === 'Consider').length;
  const needsVerification = brandEvals.filter(e => e.verdict === 'Request More Information').length;
  const negotiationCandidates = brandEvals.filter(e => e.verdict === 'Negotiate').length;
  const lowPriorityOrReject = brandEvals.filter(e => e.verdict === 'Low Priority' || e.verdict === 'Reject').length;

  // Empty state: no creators evaluated yet
  if (totalCreators === 0) {
    container.innerHTML = `
      <div class="dashboard-header">
        <div>
          <h2 class="dashboard-title">Brand Dashboard</h2>
          <p class="dashboard-subtitle text-muted">Summary of creator evaluations, candidates, and campaign fit</p>
        </div>
      </div>

      <div class="dashboard-empty-card">
        <div class="dashboard-empty-icon">👥</div>
        <h3 class="dashboard-empty-title">No creators evaluated yet</h3>
        <p class="dashboard-empty-text text-muted">
          Evaluate your first creator pitch, media kit, or social profile against your campaign criteria to see candidate tiers and insights.
        </p>
        <div class="dashboard-empty-actions">
          <button type="button" class="btn btn-primary" onclick="showTab('checker')">
            Evaluate Your First Creator →
          </button>
          <button type="button" class="btn btn-secondary" onclick="showTab('brand-profile')">
            Setup Brand & Campaign Profile
          </button>
        </div>
      </div>
    `;
    return;
  }

  const recentBrandEvals = brandEvals.slice(0, 4);

  container.innerHTML = `
    <div class="dashboard-header">
      <div>
        <h2 class="dashboard-title">Brand Dashboard</h2>
        <p class="dashboard-subtitle text-muted">Real-time candidate pipeline and creator evaluation summaries</p>
      </div>
      <div class="dashboard-actions">
        <button type="button" class="btn btn-primary btn-sm" onclick="showTab('checker')">
          + Evaluate Creator
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('creator-comparison')">
          Compare Creators
        </button>
      </div>
    </div>

    <!-- Candidate Pipeline Stat Cards -->
    <div class="dashboard-stats-grid">
      <div class="dashboard-stat-card">
        <div class="stat-card-top">
          <span class="stat-card-label">Creators Evaluated</span>
          <span class="stat-card-icon">👥</span>
        </div>
        <div class="stat-card-value">${totalCreators}</div>
        <div class="stat-card-subtext text-muted">Total profiles & pitches checked</div>
      </div>

      <div class="dashboard-stat-card stat-card-strong">
        <div class="stat-card-top">
          <span class="stat-card-label">Strong Candidates</span>
          <span class="stat-card-icon">🌟</span>
        </div>
        <div class="stat-card-value">${strongCandidates}</div>
        <div class="stat-card-subtext text-muted">Strongly Consider & Consider</div>
      </div>

      <div class="dashboard-stat-card stat-card-verification">
        <div class="stat-card-top">
          <span class="stat-card-label">Needs Verification</span>
          <span class="stat-card-icon">🔍</span>
        </div>
        <div class="stat-card-value">${needsVerification}</div>
        <div class="stat-card-subtext text-muted">Request analytics or reach data</div>
      </div>

      <div class="dashboard-stat-card stat-card-negotiate">
        <div class="stat-card-top">
          <span class="stat-card-label">Negotiation Candidates</span>
          <span class="stat-card-icon">🤝</span>
        </div>
        <div class="stat-card-value">${negotiationCandidates}</div>
        <div class="stat-card-subtext text-muted">Promising with rate / rights edits</div>
      </div>
    </div>

    <!-- Two-column grid: Active Campaign + Recent Creators -->
    <div class="dashboard-grid-2col">
      <!-- Active Campaign Card -->
      <div class="dashboard-section-card">
        <div class="dash-card-header">
          <div class="dash-card-title-group">
            <span class="dash-section-icon">🎯</span>
            <div>
              <h3 class="dash-card-title">Active Campaign</h3>
              <span class="dash-card-subtitle text-muted">Target parameters from your Brand Profile</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('campaigns')">Campaign Details</button>
        </div>

        ${brandProfile && (brandProfile.brand_name || brandProfile.campaign_objective) ? `
          <div class="dash-profile-details">
            <div class="dash-profile-item">
              <span class="item-label">Brand:</span>
              <strong>${escapeDashboardHtml(brandProfile.brand_name || 'Brand Profile')}</strong>
            </div>
            <div class="dash-profile-item">
              <span class="item-label">Objective:</span>
              <strong>${escapeDashboardHtml(brandProfile.campaign_objective || 'General Awareness')}</strong>
            </div>
            <div class="dash-profile-item">
              <span class="item-label">Target Audience:</span>
              <strong>${escapeDashboardHtml(brandProfile.target_demographics || brandProfile.target_age || 'Target Market')}</strong>
            </div>
            <div class="dash-profile-item">
              <span class="item-label">Creator Budget:</span>
              <strong>${escapeDashboardHtml(brandProfile.max_creator_budget || brandProfile.campaign_budget || 'Flexible')}</strong>
            </div>
          </div>
        ` : `
          <div class="dash-item-empty">
            <p class="text-muted">No brand campaign saved. Complete your Brand Profile to ground creator evaluations in real criteria.</p>
            <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('brand-profile')">Setup Profile</button>
          </div>
        `}
      </div>

      <!-- Recent Creator Candidates Card -->
      <div class="dashboard-section-card">
        <div class="dash-card-header">
          <div class="dash-card-title-group">
            <span class="dash-section-icon">📋</span>
            <div>
              <h3 class="dash-card-title">Recent Candidates</h3>
              <span class="dash-card-subtitle text-muted">Evaluated creator pitches & profiles</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('history')">View All History →</button>
        </div>

        <div class="dash-recent-list">
          ${recentBrandEvals.map(ev => {
            const rec = ev.verdict || 'Request More Information';
            const badgeClass = rec === 'Strongly Consider' ? 'badge-tag-emerald'
              : rec === 'Consider' ? 'badge-tag-cyan'
              : rec === 'Negotiate' ? 'badge-tag-purple'
              : rec === 'Request More Information' ? 'badge-tag-blue'
              : 'badge-tag-slate';
            const cleanText = (ev.pitch_text || '').replace(/\s+/g, ' ').trim();
            const preview = cleanText.length > 90 ? cleanText.substring(0, 87) + '…' : cleanText;
            const dateStr = ev.created_at ? new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

            return `
              <div class="dash-recent-item" onclick="showTab('history')">
                <div class="dash-recent-top">
                  <span class="verdict-badge-sm ${badgeClass}">${escapeDashboardHtml(rec)}</span>
                  <span class="dash-recent-date text-muted">${dateStr}</span>
                </div>
                <p class="dash-recent-pitch">${escapeDashboardHtml(preview)}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function escapeDashboardHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ============================================
// Brand Mode: Campaigns Tab Renderer
// Displays Campaign overview, requirements, & creator candidate pipeline
// ============================================

async function renderCampaignsTab() {
  const container = document.getElementById('campaigns-content-container');
  if (!container) return;

  let brandProfile = null;
  try {
    if (typeof getBrandProfile === 'function') {
      brandProfile = await getBrandProfile();
    } else if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }
  } catch (e) {
    if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }
  }

  let evaluations = [];
  try {
    if (typeof getEvaluations === 'function') {
      evaluations = await getEvaluations(100);
    } else if (typeof getLocalEvaluations === 'function') {
      evaluations = getLocalEvaluations();
    }
  } catch (e) {
    if (typeof getLocalEvaluations === 'function') {
      evaluations = getLocalEvaluations();
    }
  }

  const brandVerdicts = ['Strongly Consider', 'Consider', 'Request More Information', 'Negotiate', 'Low Priority', 'Reject'];
  const candidates = (evaluations || []).filter(e => brandVerdicts.includes((e.verdict || '').trim()));

  if (!brandProfile || (!brandProfile.brand_name && !brandProfile.campaign_objective)) {
    container.innerHTML = `
      <div class="dashboard-empty-card">
        <div class="dashboard-empty-icon">🎯</div>
        <h3 class="dashboard-empty-title">No campaign configured yet</h3>
        <p class="dashboard-empty-text text-muted">
          Define your campaign objective, target audience, creator guidelines, and commercial terms in Brand Profile.
        </p>
        <div class="dashboard-empty-actions">
          <button type="button" class="btn btn-primary" onclick="showTab('brand-profile')">
            Configure Brand & Campaign Profile →
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="campaign-summary-card">
      <div class="campaign-summary-top">
        <div class="campaign-badge-title">
          <span class="campaign-status-pill">Active Campaign</span>
          <h3>${escapeDashboardHtml(brandProfile.brand_name || 'Brand Campaign')}</h3>
        </div>
        <div class="campaign-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('brand-profile')">
            Edit Parameters ⚙️
          </button>
        </div>
      </div>

      <div class="campaign-meta-grid">
        <div class="campaign-meta-item">
          <span class="meta-label">Objective:</span>
          <strong>${escapeDashboardHtml(brandProfile.campaign_objective || 'General Awareness')}</strong>
        </div>
        <div class="campaign-meta-item">
          <span class="meta-label">Total Campaign Budget:</span>
          <strong>${escapeDashboardHtml(brandProfile.campaign_budget || 'Flexible')}</strong>
        </div>
        <div class="campaign-meta-item">
          <span class="meta-label">Max Creator Rate:</span>
          <strong>${escapeDashboardHtml(brandProfile.max_creator_budget || 'Flexible')}</strong>
        </div>
        <div class="campaign-meta-item">
          <span class="meta-label">Preferred Niche:</span>
          <strong>${escapeDashboardHtml(brandProfile.preferred_niche || brandProfile.industry || 'Category Relevant')}</strong>
        </div>
        <div class="campaign-meta-item">
          <span class="meta-label">Platform:</span>
          <strong>${escapeDashboardHtml(brandProfile.preferred_platform || 'Multi-platform')}</strong>
        </div>
        <div class="campaign-meta-item">
          <span class="meta-label">Timeline:</span>
          <strong>${escapeDashboardHtml(brandProfile.timeline || 'TBD')}</strong>
        </div>
      </div>

      ${brandProfile.campaign_description ? `
        <div class="campaign-desc-box">
          <span class="meta-label">Campaign Brief & Key Messages:</span>
          <p class="campaign-desc-text">${escapeDashboardHtml(brandProfile.campaign_description)}</p>
        </div>
      ` : ''}
    </div>

    <!-- Candidate Pipeline Section -->
    <div class="campaign-pipeline-card">
      <div class="dash-card-header">
        <div class="dash-card-title-group">
          <span class="dash-section-icon">👥</span>
          <div>
            <h3 class="dash-card-title">Creator Candidate Pipeline</h3>
            <span class="dash-card-subtitle text-muted">${candidates.length} evaluated creator(s) for this campaign</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="showTab('checker')">
          + Check New Creator
        </button>
      </div>

      ${candidates.length > 0 ? `
        <div class="campaign-candidate-table-wrapper">
          <table class="brand-compare-table">
            <thead>
              <tr>
                <th>Creator Pitch / Bio</th>
                <th>Recommendation</th>
                <th>Evaluated Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${candidates.map(c => {
                const rec = c.verdict || 'Request More Information';
                const badgeClass = rec === 'Strongly Consider' ? 'badge-tag-emerald'
                  : rec === 'Consider' ? 'badge-tag-cyan'
                  : rec === 'Negotiate' ? 'badge-tag-purple'
                  : rec === 'Request More Information' ? 'badge-tag-blue'
                  : 'badge-tag-slate';
                const cleanText = (c.pitch_text || '').replace(/\s+/g, ' ').trim();
                const preview = cleanText.length > 80 ? cleanText.substring(0, 77) + '…' : cleanText;
                const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                return `
                  <tr>
                    <td><strong>${escapeDashboardHtml(preview)}</strong></td>
                    <td><span class="verdict-badge-sm ${badgeClass}">${escapeDashboardHtml(rec)}</span></td>
                    <td class="text-muted">${dateStr}</td>
                    <td>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="showTab('history')">
                        View Details
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="dash-item-empty">
          <p class="text-muted">No creator candidates evaluated for this campaign yet.</p>
          <button type="button" class="btn btn-primary btn-sm" onclick="showTab('checker')">Evaluate Creator Now →</button>
        </div>
      `}
    </div>
  `;
}

// ============================================
// Brand Mode: Creator Comparison Tab Renderer
// Dedicated side-by-side creator comparator view
// ============================================

function renderCreatorComparisonTab() {
  const container = document.getElementById('comparison-tab-content-container');
  if (!container) return;

  container.innerHTML = `
    <div class="comparison-tab-wrapper">
      <div class="comparison-tab-intro">
        <p class="text-muted">Enter 2 to 3 creators below to generate a multi-dimensional comparison table evaluating Audience Fit, Engagement, Cost, and Campaign Fit alongside a plain-English trade-off analysis.</p>
      </div>

      <div class="compare-creators-grid" id="tab-compare-creators-grid">
        <!-- Creator 1 -->
        <div class="compare-creator-col" id="tab-cmp-col-1">
          <div class="compare-col-header">
            <span class="compare-col-badge">Creator 1</span>
            <span class="compare-col-label">Required</span>
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-name-1">Creator Name / Handle</label>
            <input type="text" id="tab-cmp-name-1" placeholder="E.g., @techreviewer, Sarah Jenkins" class="cmp-input">
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-price-1">Stated / Quoted Rate</label>
            <input type="text" id="tab-cmp-price-1" placeholder="E.g., ₹45,000, $1,200, or TBD" class="cmp-input">
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-pitch-1">Pitch / Deliverables / Stats</label>
            <textarea id="tab-cmp-pitch-1" rows="5" placeholder="Paste Creator 1's email, DM, deliverables, claimed followers & engagement…" class="cmp-textarea"></textarea>
          </div>
        </div>

        <!-- Creator 2 -->
        <div class="compare-creator-col" id="tab-cmp-col-2">
          <div class="compare-col-header">
            <span class="compare-col-badge">Creator 2</span>
            <span class="compare-col-label">Required</span>
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-name-2">Creator Name / Handle</label>
            <input type="text" id="tab-cmp-name-2" placeholder="E.g., @lifestylecreator, Alex Chen" class="cmp-input">
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-price-2">Stated / Quoted Rate</label>
            <input type="text" id="tab-cmp-price-2" placeholder="E.g., ₹25,000, $800, or TBD" class="cmp-input">
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-pitch-2">Pitch / Deliverables / Stats</label>
            <textarea id="tab-cmp-pitch-2" rows="5" placeholder="Paste Creator 2's email, DM, deliverables, claimed followers & engagement…" class="cmp-textarea"></textarea>
          </div>
        </div>

        <!-- Creator 3 (Optional) -->
        <div class="compare-creator-col compare-col-optional" id="tab-cmp-col-3" style="display:none;">
          <div class="compare-col-header">
            <span class="compare-col-badge">Creator 3</span>
            <button type="button" class="btn-remove-cmp-col" id="tab-btn-remove-creator-3" title="Remove Creator 3">&times;</button>
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-name-3">Creator Name / Handle</label>
            <input type="text" id="tab-cmp-name-3" placeholder="E.g., @foodieguide, Priya Sharma" class="cmp-input">
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-price-3">Stated / Quoted Rate</label>
            <input type="text" id="tab-cmp-price-3" placeholder="E.g., ₹60,000, $1,500, or TBD" class="cmp-input">
          </div>
          <div class="form-group compare-field-group">
            <label for="tab-cmp-pitch-3">Pitch / Deliverables / Stats</label>
            <textarea id="tab-cmp-pitch-3" rows="5" placeholder="Paste Creator 3's email, DM, deliverables, claimed followers & engagement…" class="cmp-textarea"></textarea>
          </div>
        </div>
      </div>

      <div class="compare-grid-actions">
        <button type="button" id="tab-btn-add-creator-3" class="btn btn-secondary btn-sm">
          <span>+ Add 3rd Creator</span>
        </button>
      </div>

      <div id="tab-cmp-error" class="checker-error"></div>

      <div class="compare-run-actions">
        <button type="button" id="tab-btn-run-compare" class="btn btn-primary btn-check">
          Compare Creators Side-by-Side
        </button>
      </div>

      <div id="tab-cmp-result-container" class="checker-result" style="margin-top: 1.5rem;"></div>
    </div>
  `;

  // Bind 3rd creator add/remove
  const btnAdd3 = document.getElementById('tab-btn-add-creator-3');
  const col3 = document.getElementById('tab-cmp-col-3');
  const btnRemove3 = document.getElementById('tab-btn-remove-creator-3');

  if (btnAdd3 && col3) {
    btnAdd3.onclick = () => {
      col3.style.display = 'block';
      btnAdd3.style.display = 'none';
    };
  }

  if (btnRemove3 && col3 && btnAdd3) {
    btnRemove3.onclick = () => {
      col3.style.display = 'none';
      btnAdd3.style.display = 'inline-flex';
      const n3 = document.getElementById('tab-cmp-name-3');
      const p3 = document.getElementById('tab-cmp-price-3');
      const t3 = document.getElementById('tab-cmp-pitch-3');
      if (n3) n3.value = '';
      if (p3) p3.value = '';
      if (t3) t3.value = '';
    };
  }

  // Bind run compare
  const runBtn = document.getElementById('tab-btn-run-compare');
  if (runBtn) {
    runBtn.onclick = handleTabRunCompare;
  }
}

async function handleTabRunCompare() {
  const errorEl = document.getElementById('tab-cmp-error');
  const resultEl = document.getElementById('tab-cmp-result-container');
  const runBtn = document.getElementById('tab-btn-run-compare');

  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
  if (resultEl) {
    resultEl.innerHTML = '';
    resultEl.classList.remove('visible');
  }

  const name1 = (document.getElementById('tab-cmp-name-1')?.value || '').trim();
  const price1 = (document.getElementById('tab-cmp-price-1')?.value || '').trim();
  const pitch1 = (document.getElementById('tab-cmp-pitch-1')?.value || '').trim();

  const name2 = (document.getElementById('tab-cmp-name-2')?.value || '').trim();
  const price2 = (document.getElementById('tab-cmp-price-2')?.value || '').trim();
  const pitch2 = (document.getElementById('tab-cmp-pitch-2')?.value || '').trim();

  const col3 = document.getElementById('tab-cmp-col-3');
  const isCol3Visible = col3 && col3.style.display !== 'none';
  const name3 = (document.getElementById('tab-cmp-name-3')?.value || '').trim();
  const price3 = (document.getElementById('tab-cmp-price-3')?.value || '').trim();
  const pitch3 = (document.getElementById('tab-cmp-pitch-3')?.value || '').trim();

  const creators = [];
  if (pitch1 || name1) {
    creators.push({
      name: name1 || 'Creator 1',
      stated_price: price1,
      pitch_text: pitch1 || 'No pitch text provided.'
    });
  }
  if (pitch2 || name2) {
    creators.push({
      name: name2 || 'Creator 2',
      stated_price: price2,
      pitch_text: pitch2 || 'No pitch text provided.'
    });
  }
  if (isCol3Visible && (pitch3 || name3)) {
    creators.push({
      name: name3 || 'Creator 3',
      stated_price: price3,
      pitch_text: pitch3 || 'No pitch text provided.'
    });
  }

  if (creators.length < 2) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in details for at least 2 creators to compare.';
      errorEl.classList.add('visible');
    }
    return;
  }

  let brandProfile = null;
  try {
    if (typeof getBrandProfile === 'function') {
      brandProfile = await getBrandProfile();
    } else if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }
  } catch (e) {
    if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }
  }

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Comparing Creators…';
  }
  if (resultEl) {
    resultEl.innerHTML = '<div class="dashboard-loading"><span class="spinner"></span> Comparing creators side-by-side with AI…</div>';
    resultEl.classList.add('visible');
  }

  try {
    const comparisonResult = await compareCreatorsForBrand(creators, brandProfile);
    if (typeof displayBrandCompareResult === 'function') {
      displayBrandCompareResult(comparisonResult, resultEl);
    }
  } catch (err) {
    console.error('Comparison error:', err);
    if (errorEl) {
      errorEl.textContent = 'Comparison failed: ' + err.message;
      errorEl.classList.add('visible');
    }
    if (resultEl) {
      resultEl.classList.remove('visible');
    }
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = 'Compare Creators Side-by-Side';
    }
  }
}
