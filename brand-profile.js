// ============================================
// Brand Profile Management Module
// Manages the rich 5-section Brand Profile
// for Brand Mode. Formats profile data for
// AI evaluations so brands never have to
// retype their campaign details for each check.
// ============================================

const BRAND_PROFILE_FIELD_IDS = [
  // 1. Brand Identity
  'bp-brand-name',
  'bp-industry',
  'bp-product-service',
  'bp-positioning',
  'bp-website',

  // 2. Target Audience
  'bp-target-age',
  'bp-target-geography',
  'bp-target-demographics',
  'bp-target-interests',
  'bp-customer-profile',

  // 3. Campaign Details
  'bp-campaign-objective',
  'bp-campaign-description',

  // 4. Creator Requirements
  'bp-preferred-niche',
  'bp-preferred-platform',
  'bp-follower-range',
  'bp-engagement-expectations',
  'bp-creator-geography',
  'bp-content-format',
  'bp-audience-profile',
  'bp-creator-style',

  // 5. Commercial Terms
  'bp-campaign-budget',
  'bp-max-creator-budget',
  'bp-deliverables',
  'bp-timeline',
  'bp-usage-rights',
  'bp-exclusivity'
];

async function initBrandProfile() {
  const form = document.getElementById('brand-profile-form');
  const resetBtn = document.getElementById('bp-reset-btn');
  const genRecBtn = document.getElementById('bp-generate-rec-btn');

  if (form) {
    form.addEventListener('submit', handleSaveBrandProfile);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetBrandProfile);
  }

  if (genRecBtn) {
    genRecBtn.addEventListener('click', handleGenerateRecommendedProfile);
  }

  // Load existing brand profile from storage
  await loadBrandProfileIntoForm();
}

async function loadBrandProfileIntoForm() {
  try {
    const profile = await getBrandProfile();
    if (profile) {

    // 1. Brand Identity
    setBPFieldValue('bp-brand-name', profile.brand_name);
    setBPFieldValue('bp-industry', profile.industry);
    setBPFieldValue('bp-product-service', profile.product_service);
    setBPFieldValue('bp-positioning', profile.brand_positioning);
    setBPFieldValue('bp-website', profile.website);

    // 2. Target Audience
    setBPFieldValue('bp-target-age', profile.target_age);
    setBPFieldValue('bp-target-geography', profile.target_geography);
    setBPFieldValue('bp-target-demographics', profile.target_demographics);
    setBPFieldValue('bp-target-interests', profile.target_interests);
    setBPFieldValue('bp-customer-profile', profile.customer_profile);

    // 3. Campaign
    setBPFieldValue('bp-campaign-objective', profile.campaign_objective);
    setBPFieldValue('bp-campaign-description', profile.campaign_description);

    // 4. Creator Requirements
    setBPFieldValue('bp-preferred-niche', profile.preferred_niche);
    setBPFieldValue('bp-preferred-platform', profile.preferred_platform);
    setBPFieldValue('bp-follower-range', profile.follower_range);
    setBPFieldValue('bp-engagement-expectations', profile.engagement_expectations);
    setBPFieldValue('bp-creator-geography', profile.creator_geography);
    setBPFieldValue('bp-content-format', profile.content_format);
    setBPFieldValue('bp-audience-profile', profile.audience_profile);
    setBPFieldValue('bp-creator-style', profile.creator_style);

    // 5. Commercial Terms
    setBPFieldValue('bp-campaign-budget', profile.campaign_budget);
    setBPFieldValue('bp-max-creator-budget', profile.max_creator_budget);
    setBPFieldValue('bp-deliverables', profile.deliverables);
    setBPFieldValue('bp-timeline', profile.timeline);
    setBPFieldValue('bp-usage-rights', profile.usage_rights);
    setBPFieldValue('bp-exclusivity', profile.exclusivity);
    }

    // Load any previously generated recommended creator profile
    const savedRec = getLocalRecommendedCreatorProfile();
    if (savedRec) {
      renderRecommendedCreatorProfile(savedRec);
    }
  } catch (err) {
    console.warn('[BrandProfile] Error loading profile into form:', err);
  }
}

function setBPFieldValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) {
    el.value = val;
  }
}

function getBPFieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function handleSaveBrandProfile(e) {
  if (e) e.preventDefault();

  const statusEl = document.getElementById('bp-save-status');
  const saveBtn = document.getElementById('bp-save-btn');

  const profileData = {
    brand_name: getBPFieldValue('bp-brand-name'),
    industry: getBPFieldValue('bp-industry'),
    product_service: getBPFieldValue('bp-product-service'),
    brand_positioning: getBPFieldValue('bp-positioning'),
    website: getBPFieldValue('bp-website'),

    target_age: getBPFieldValue('bp-target-age'),
    target_geography: getBPFieldValue('bp-target-geography'),
    target_demographics: getBPFieldValue('bp-target-demographics'),
    target_interests: getBPFieldValue('bp-target-interests'),
    customer_profile: getBPFieldValue('bp-customer-profile'),

    campaign_objective: getBPFieldValue('bp-campaign-objective'),
    campaign_description: getBPFieldValue('bp-campaign-description'),

    preferred_niche: getBPFieldValue('bp-preferred-niche'),
    preferred_platform: getBPFieldValue('bp-preferred-platform'),
    follower_range: getBPFieldValue('bp-follower-range'),
    engagement_expectations: getBPFieldValue('bp-engagement-expectations'),
    creator_geography: getBPFieldValue('bp-creator-geography'),
    content_format: getBPFieldValue('bp-content-format'),
    audience_profile: getBPFieldValue('bp-audience-profile'),
    creator_style: getBPFieldValue('bp-creator-style'),

    campaign_budget: getBPFieldValue('bp-campaign-budget'),
    max_creator_budget: getBPFieldValue('bp-max-creator-budget'),
    deliverables: getBPFieldValue('bp-deliverables'),
    timeline: getBPFieldValue('bp-timeline'),
    usage_rights: getBPFieldValue('bp-usage-rights'),
    exclusivity: getBPFieldValue('bp-exclusivity')
  };

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
  }

  try {
    const saved = await saveBrandProfile(profileData);

    if (typeof playSuccessSound === 'function') {
      playSuccessSound();
    }

    if (statusEl) {
      statusEl.textContent = '✓ Brand profile saved successfully! Creator evaluations will use this profile as context.';
      statusEl.className = 'profile-status-message status-success visible';
      setTimeout(() => {
        statusEl.classList.remove('visible');
      }, 4000);
    }

    // Update greeting with brand name if provided
    if (saved.brand_name && typeof setUserName === 'function') {
      setUserName(saved.brand_name);
      if (typeof applyUserMode === 'function') {
        applyUserMode(typeof getUserMode === 'function' ? getUserMode() : 'brand');
      }
    }

  } catch (err) {
    console.error('Error saving brand profile:', err);
    if (statusEl) {
      statusEl.textContent = `Error saving profile: ${err.message}`;
      statusEl.className = 'profile-status-message status-error visible';
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Brand Profile';
    }
  }
}

function handleResetBrandProfile() {
  if (!confirm('Are you sure you want to clear all brand profile fields?')) return;
  BRAND_PROFILE_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function formatBrandProfileForPrompt(p) {
  if (!p) return '';

  const sections = [];

  // Brand Identity
  const brandParts = [];
  if (p.brand_name) brandParts.push(`Brand Name: ${p.brand_name}`);
  if (p.industry) brandParts.push(`Industry: ${p.industry}`);
  if (p.product_service) brandParts.push(`Product / Service: ${p.product_service}`);
  if (p.brand_positioning) brandParts.push(`Brand Positioning: ${p.brand_positioning}`);
  if (p.website) brandParts.push(`Website: ${p.website}`);
  if (brandParts.length) sections.push(`BRAND IDENTITY:\n${brandParts.join('\n')}`);

  // Target Audience
  const targetParts = [];
  if (p.target_age) targetParts.push(`Target Age: ${p.target_age}`);
  if (p.target_geography) targetParts.push(`Target Geography: ${p.target_geography}`);
  if (p.target_demographics) targetParts.push(`Target Demographics: ${p.target_demographics}`);
  if (p.target_interests) targetParts.push(`Target Interests: ${p.target_interests}`);
  if (p.customer_profile) targetParts.push(`Ideal Customer Profile: ${p.customer_profile}`);
  if (targetParts.length) sections.push(`TARGET AUDIENCE:\n${targetParts.join('\n')}`);

  // Campaign
  const campaignParts = [];
  if (p.campaign_objective) campaignParts.push(`Campaign Objective: ${p.campaign_objective}`);
  if (p.campaign_description) campaignParts.push(`Campaign Description: ${p.campaign_description}`);
  if (campaignParts.length) sections.push(`CAMPAIGN:\n${campaignParts.join('\n')}`);

  // Creator Requirements
  const creatorParts = [];
  if (p.preferred_niche) creatorParts.push(`Preferred Creator Niche: ${p.preferred_niche}`);
  if (p.preferred_platform) creatorParts.push(`Preferred Platform: ${p.preferred_platform}`);
  if (p.follower_range) creatorParts.push(`Follower Range: ${p.follower_range}`);
  if (p.engagement_expectations) creatorParts.push(`Engagement Expectations: ${p.engagement_expectations}`);
  if (p.creator_geography) creatorParts.push(`Creator Geography: ${p.creator_geography}`);
  if (p.content_format) creatorParts.push(`Content Format: ${p.content_format}`);
  if (p.audience_profile) creatorParts.push(`Desired Audience Profile: ${p.audience_profile}`);
  if (p.creator_style) creatorParts.push(`Creator Style / Tone: ${p.creator_style}`);
  if (creatorParts.length) sections.push(`CREATOR REQUIREMENTS:\n${creatorParts.join('\n')}`);

  // Commercial Terms
  const commercialParts = [];
  if (p.campaign_budget) commercialParts.push(`Total Campaign Budget: ${p.campaign_budget}`);
  if (p.max_creator_budget) commercialParts.push(`Max Budget Per Creator: ${p.max_creator_budget}`);
  if (p.deliverables) commercialParts.push(`Deliverables: ${p.deliverables}`);
  if (p.timeline) commercialParts.push(`Timeline: ${p.timeline}`);
  if (p.usage_rights) commercialParts.push(`Usage Rights: ${p.usage_rights}`);
  if (p.exclusivity) commercialParts.push(`Exclusivity: ${p.exclusivity}`);
  if (commercialParts.length) sections.push(`COMMERCIAL TERMS:\n${commercialParts.join('\n')}`);

  return sections.join('\n\n');
}

function getBrandProfileSummary(p) {
  if (!p) return '';
  const name = p.brand_name || 'Brand Profile';
  const industry = p.industry || '';
  const objective = p.campaign_objective || '';
  return `${name}${industry ? ' • ' + industry : ''}${objective ? ' • ' + objective : ''}`.trim();
}

// ============================================
// AI Recommended Creator Profile Generation
// ============================================

const LOCAL_REC_CREATOR_KEY = 'bfc_recommended_creator_profile';

function getLocalRecommendedCreatorProfile() {
  try {
    const raw = localStorage.getItem(LOCAL_REC_CREATOR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Could not load recommended creator profile:', e);
    return null;
  }
}

function saveLocalRecommendedCreatorProfile(rec) {
  try {
    localStorage.setItem(LOCAL_REC_CREATOR_KEY, JSON.stringify(rec));
  } catch (e) {
    console.warn('Could not save recommended creator profile:', e);
  }
}

function getBrandProfileFromForm() {
  return {
    brand_name: getBPFieldValue('bp-brand-name'),
    industry: getBPFieldValue('bp-industry'),
    product_service: getBPFieldValue('bp-product-service'),
    brand_positioning: getBPFieldValue('bp-positioning'),
    website: getBPFieldValue('bp-website'),

    target_age: getBPFieldValue('bp-target-age'),
    target_geography: getBPFieldValue('bp-target-geography'),
    target_demographics: getBPFieldValue('bp-target-demographics'),
    target_interests: getBPFieldValue('bp-target-interests'),
    customer_profile: getBPFieldValue('bp-customer-profile'),

    campaign_objective: getBPFieldValue('bp-campaign-objective'),
    campaign_description: getBPFieldValue('bp-campaign-description'),

    preferred_niche: getBPFieldValue('bp-preferred-niche'),
    preferred_platform: getBPFieldValue('bp-preferred-platform'),
    follower_range: getBPFieldValue('bp-follower-range'),
    engagement_expectations: getBPFieldValue('bp-engagement-expectations'),
    creator_geography: getBPFieldValue('bp-creator-geography'),
    content_format: getBPFieldValue('bp-content-format'),
    audience_profile: getBPFieldValue('bp-audience-profile'),
    creator_style: getBPFieldValue('bp-creator-style'),

    campaign_budget: getBPFieldValue('bp-campaign-budget'),
    max_creator_budget: getBPFieldValue('bp-max-creator-budget'),
    deliverables: getBPFieldValue('bp-deliverables'),
    timeline: getBPFieldValue('bp-timeline'),
    usage_rights: getBPFieldValue('bp-usage-rights'),
    exclusivity: getBPFieldValue('bp-exclusivity')
  };
}

async function handleGenerateRecommendedProfile() {
  const genBtn = document.getElementById('bp-generate-rec-btn');
  const container = document.getElementById('bp-recommended-creator-container');
  if (!container) return;

  const currentProfile = getBrandProfileFromForm();
  const hasBasicData = currentProfile.brand_name || currentProfile.industry || currentProfile.product_service || currentProfile.campaign_objective;

  if (!hasBasicData) {
    container.innerHTML = `
      <div class="bp-rec-alert-box">
        <span class="bp-rec-alert-icon">⚠️</span>
        <div class="bp-rec-alert-content">
          <strong>More Details Needed</strong>
          <p>Please enter at least your <strong>Industry</strong>, <strong>Product/Service</strong>, or <strong>Campaign Objective</strong> in the sections above so the AI can dynamically tailor a creator profile to your goals.</p>
        </div>
      </div>
    `;
    return;
  }

  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="spinner"></span> Deducing Archetype…';
  }

  container.innerHTML = `
    <div class="bp-rec-loading-card">
      <span class="spinner"></span>
      <div class="bp-rec-loading-text">
        <strong>Analyzing your brand positioning, audience ICP & budget…</strong>
        <p class="text-muted">Deducing optimal niche, platform, follower range, content type, and engagement benchmarks.</p>
      </div>
    </div>
  `;

  try {
    const rec = await generateRecommendedCreatorProfile(currentProfile);
    saveLocalRecommendedCreatorProfile(rec);
    renderRecommendedCreatorProfile(rec);

    if (typeof playSuccessSound === 'function') playSuccessSound();
  } catch (err) {
    console.error('Error generating recommended creator profile:', err);
    if (err && err.isRateLimit) {
      if (typeof renderRateLimitNoticeCard === 'function') {
        renderRateLimitNoticeCard(container, err.message);
      } else {
        container.innerHTML = `<div class="result-card rate-limit-notice-card"><p>${escapeHtml(err.message)}</p></div>`;
      }
    } else {
      container.innerHTML = `
        <div class="bp-rec-error-card">
          <p>Failed to generate recommended profile: ${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-secondary btn-sm" onclick="handleGenerateRecommendedProfile()">Try Again</button>
        </div>
      `;
    }
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.innerHTML = '<span>✨ Generate Recommended Profile</span>';
    }
  }
}

function renderRecommendedCreatorProfile(rec) {
  const container = document.getElementById('bp-recommended-creator-container');
  if (!container || !rec) return;

  const tipsHtml = (rec.vettingTips || []).map(tip => `
    <li class="bp-rec-tip-item">
      <span class="bp-rec-tip-check">✓</span>
      <span>${escapeHtml(cleanModelText(tip))}</span>
    </li>
  `).join('');

  const summaryCopyText = `🌟 Recommended Creator Profile for Campaign:
• Archetype: ${rec.archetypeTitle}
• Niche: ${rec.niche}
• Platform: ${rec.platform}
• Follower Range: ${rec.followerRange}
• Audience Age & Geo: ${rec.audienceAgeGeo}
• Content Type: ${rec.contentType}
• Target Engagement: ${rec.engagementLevel}

💡 Strategic Rationale:
${rec.strategicRationale}`;

  container.innerHTML = `
    <div class="bp-rec-result-card">
      <div class="bp-rec-hero-row">
        <div class="bp-rec-hero-left">
          <span class="bp-rec-kicker">Optimal Creator Persona</span>
          <h4 class="bp-rec-archetype-title">${escapeHtml(rec.archetypeTitle)}</h4>
        </div>
        <div class="bp-rec-hero-actions">
          <button type="button" id="bp-copy-rec-btn" class="btn-copy-small" data-copy="${escapeAttr(summaryCopyText)}">
            📋 Copy Profile
          </button>
          <button type="button" id="bp-apply-rec-btn" class="btn-copy-small btn-apply-archetype">
            ⚡ Apply to Section 4
          </button>
        </div>
      </div>

      <!-- 6 Dimensions Grid -->
      <div class="bp-rec-dimensions-grid">
        <div class="bp-rec-dimension-card">
          <div class="bp-dim-header">
            <span class="bp-dim-icon">🎯</span>
            <span class="bp-dim-label">Target Niche</span>
          </div>
          <strong class="bp-dim-val">${escapeHtml(rec.niche)}</strong>
        </div>

        <div class="bp-rec-dimension-card">
          <div class="bp-dim-header">
            <span class="bp-dim-icon">📱</span>
            <span class="bp-dim-label">Optimal Platform</span>
          </div>
          <strong class="bp-dim-val">${escapeHtml(rec.platform)}</strong>
        </div>

        <div class="bp-rec-dimension-card">
          <div class="bp-dim-header">
            <span class="bp-dim-icon">👥</span>
            <span class="bp-dim-label">Follower Range</span>
          </div>
          <strong class="bp-dim-val">${escapeHtml(rec.followerRange)}</strong>
        </div>

        <div class="bp-rec-dimension-card">
          <div class="bp-dim-header">
            <span class="bp-dim-icon">🌍</span>
            <span class="bp-dim-label">Audience Age & Geo</span>
          </div>
          <strong class="bp-dim-val">${escapeHtml(rec.audienceAgeGeo)}</strong>
        </div>

        <div class="bp-rec-dimension-card">
          <div class="bp-dim-header">
            <span class="bp-dim-icon">🎬</span>
            <span class="bp-dim-label">Ideal Content Type</span>
          </div>
          <strong class="bp-dim-val">${escapeHtml(rec.contentType)}</strong>
        </div>

        <div class="bp-rec-dimension-card">
          <div class="bp-dim-header">
            <span class="bp-dim-icon">📈</span>
            <span class="bp-dim-label">Target Engagement</span>
          </div>
          <strong class="bp-dim-val">${escapeHtml(rec.engagementLevel)}</strong>
        </div>
      </div>

      <!-- Strategic Rationale Box -->
      <div class="bp-rec-rationale-box">
        <h5 class="bp-rec-rationale-title">Strategic Campaign Rationale</h5>
        <p class="bp-rec-rationale-p">${escapeHtml(rec.strategicRationale)}</p>
      </div>

      <!-- Vetting Tips -->
      ${tipsHtml ? `
        <div class="bp-rec-tips-box">
          <h5 class="bp-rec-tips-title">Creator Verification Checklist for this Archetype</h5>
          <ul class="bp-rec-tips-list">
            ${tipsHtml}
          </ul>
        </div>
      ` : ''}

      <div id="bp-apply-status" class="profile-status-message" style="margin-top: 10px;"></div>
    </div>
  `;

  // Bind copy button
  const copyBtn = container.querySelector('#bp-copy-rec-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const textToCopy = copyBtn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(textToCopy);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy Profile'; }, 2000);
      } catch (e) {
        console.warn('Clipboard write failed:', e);
      }
    });
  }

  // Bind Apply to Section 4 button
  const applyBtn = container.querySelector('#bp-apply-rec-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applyRecommendedProfileToForm(rec);
    });
  }
}

function applyRecommendedProfileToForm(rec) {
  if (!rec) return;

  if (rec.niche) setBPFieldValue('bp-preferred-niche', rec.niche);
  if (rec.platform) setBPFieldValue('bp-preferred-platform', rec.platform);
  if (rec.followerRange) setBPFieldValue('bp-follower-range', rec.followerRange);
  if (rec.engagementLevel) setBPFieldValue('bp-engagement-expectations', rec.engagementLevel);
  if (rec.contentType) setBPFieldValue('bp-content-format', rec.contentType);
  if (rec.audienceAgeGeo) setBPFieldValue('bp-audience-profile', rec.audienceAgeGeo);
  if (rec.archetypeTitle) setBPFieldValue('bp-creator-style', rec.archetypeTitle);

  const statusEl = document.getElementById('bp-apply-status');
  if (statusEl) {
    statusEl.textContent = '✓ Applied archetype values to Section 4 (Creator Requirements)! Click "Save Brand Profile" above to persist.';
    statusEl.className = 'profile-status-message status-success visible';
    setTimeout(() => { statusEl.classList.remove('visible'); }, 5000);
  }

  // Scroll smoothly up to Section 4
  const sec4 = document.getElementById('bp-preferred-niche');
  if (sec4) {
    sec4.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sec4.focus();
  }
}

