// ============================================
// Creator Profile Management Module
// Manages the rich 5-section Creator Profile
// Formats profile data for AI evaluations so creators
// never have to retype their info for each check.
// ============================================

const PROFILE_FIELD_IDS = [
  // 1. Basic Info
  'profile-name',
  'profile-instagram',
  'profile-youtube',
  'profile-other-socials',

  // 2. Audience Demographics & Metrics
  'profile-followers',
  'profile-avg-views',
  'profile-avg-reach',
  'profile-engagement-rate',
  'profile-audience-location',
  'profile-audience-age',
  'profile-audience-demographics',
  'profile-audience-interests',

  // 3. Content & Niche
  'profile-main-niche',
  'profile-secondary-niches',
  'profile-content-formats',
  'profile-platforms',
  'profile-content-style',

  // 4. Commercial Terms & Rates
  'profile-typical-rates',
  'profile-min-payment',
  'profile-preferred-collabs',
  'profile-preferred-industries',
  'profile-unwanted-industries',

  // 5. Deal Preferences & Rights
  'profile-dealbreakers',
  'profile-exclusivity',
  'profile-usage-rights',
  'profile-max-revisions',
  'profile-unpaid-rules'
];

async function initProfile() {
  const form = document.getElementById('creator-profile-form');
  const resetBtn = document.getElementById('profile-reset-btn');

  if (form) {
    form.addEventListener('submit', handleSaveProfile);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetProfile);
  }

  // Load existing profile from storage
  await loadProfileIntoForm();
}

async function loadProfileIntoForm() {
  try {
    const profile = await getCreatorProfile();
    if (!profile) return;

    // Populate all fields if available
    setFieldValue('profile-name', profile.name);
    setFieldValue('profile-instagram', profile.instagram_url);
    setFieldValue('profile-youtube', profile.youtube_url);
    setFieldValue('profile-other-socials', profile.other_social_links);

    setFieldValue('profile-followers', profile.followers_count);
    setFieldValue('profile-avg-views', profile.average_views);
    setFieldValue('profile-avg-reach', profile.average_reach);
    setFieldValue('profile-engagement-rate', profile.engagement_rate);
    setFieldValue('profile-audience-location', profile.audience_location);
    setFieldValue('profile-audience-age', profile.audience_age);
    setFieldValue('profile-audience-demographics', profile.audience_demographics);
    setFieldValue('profile-audience-interests', profile.audience_interests);

    setFieldValue('profile-main-niche', profile.main_niche);
    setFieldValue('profile-secondary-niches', profile.secondary_niches);
    setFieldValue('profile-content-formats', profile.content_formats);
    setFieldValue('profile-platforms', profile.platforms);
    setFieldValue('profile-content-style', profile.content_style);

    setFieldValue('profile-typical-rates', profile.typical_rates);
    setFieldValue('profile-min-payment', profile.min_acceptable_payment);
    setFieldValue('profile-preferred-collabs', profile.preferred_collab_types);
    setFieldValue('profile-preferred-industries', profile.preferred_industries);
    setFieldValue('profile-unwanted-industries', profile.unwanted_industries);

    setFieldValue('profile-dealbreakers', profile.dealbreakers);
    setFieldValue('profile-exclusivity', profile.exclusivity_preferences);
    setFieldValue('profile-usage-rights', profile.usage_rights_preferences);
    setFieldValue('profile-max-revisions', profile.max_revisions);
    setFieldValue('profile-unpaid-rules', profile.unpaid_collab_rules);

    // Update Checker tab banner if present
    updateCheckerProfileBanner(profile);

  } catch (err) {
    console.warn('[Profile] Error loading profile into form:', err);
  }
}

function setFieldValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) {
    el.value = val;
  }
}

function getFieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function handleSaveProfile(e) {
  if (e) e.preventDefault();

  const statusEl = document.getElementById('profile-save-status');
  const saveBtn = document.getElementById('profile-save-btn');

  const profileData = {
    name: getFieldValue('profile-name'),
    instagram_url: getFieldValue('profile-instagram'),
    youtube_url: getFieldValue('profile-youtube'),
    other_social_links: getFieldValue('profile-other-socials'),

    followers_count: getFieldValue('profile-followers'),
    average_views: getFieldValue('profile-avg-views'),
    average_reach: getFieldValue('profile-avg-reach'),
    engagement_rate: getFieldValue('profile-engagement-rate'),
    audience_location: getFieldValue('profile-audience-location'),
    audience_age: getFieldValue('profile-audience-age'),
    audience_demographics: getFieldValue('profile-audience-demographics'),
    audience_interests: getFieldValue('profile-audience-interests'),

    main_niche: getFieldValue('profile-main-niche'),
    secondary_niches: getFieldValue('profile-secondary-niches'),
    content_formats: getFieldValue('profile-content-formats'),
    platforms: getFieldValue('profile-platforms'),
    content_style: getFieldValue('profile-content-style'),

    typical_rates: getFieldValue('profile-typical-rates'),
    min_acceptable_payment: getFieldValue('profile-min-payment'),
    preferred_collab_types: getFieldValue('profile-preferred-collabs'),
    preferred_industries: getFieldValue('profile-preferred-industries'),
    unwanted_industries: getFieldValue('profile-unwanted-industries'),

    dealbreakers: getFieldValue('profile-dealbreakers'),
    exclusivity_preferences: getFieldValue('profile-exclusivity'),
    usage_rights_preferences: getFieldValue('profile-usage-rights'),
    max_revisions: getFieldValue('profile-max-revisions'),
    unpaid_collab_rules: getFieldValue('profile-unpaid-rules')
  };

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
  }

  try {
    const saved = await saveCreatorProfile(profileData);

    if (typeof playSuccessSound === 'function') {
      playSuccessSound();
    }

    if (statusEl) {
      statusEl.textContent = '✓ Profile saved successfully! Deals will now be evaluated against this profile.';
      statusEl.className = 'profile-status-message status-success visible';
      setTimeout(() => {
        statusEl.classList.remove('visible');
      }, 4000);
    }

    // Update greeting with creator name if provided
    if (saved.name && typeof setUserName === 'function') {
      setUserName(saved.name);
      if (typeof applyUserMode === 'function') {
        applyUserMode(typeof getUserMode === 'function' ? getUserMode() : 'creator');
      }
    }

    // Refresh Checker Tab banner
    updateCheckerProfileBanner(saved);

  } catch (err) {
    console.error('Error saving profile:', err);
    if (statusEl) {
      statusEl.textContent = `Error saving profile: ${err.message}`;
      statusEl.className = 'profile-status-message status-error visible';
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Profile';
    }
  }
}

function handleResetProfile() {
  if (!confirm('Are you sure you want to clear all profile fields?')) return;
  PROFILE_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function formatProfileForPrompt(p) {
  if (!p) return '';

  const sections = [];

  // Basic Info
  const basicParts = [];
  if (p.name) basicParts.push(`Creator Name: ${p.name}`);
  if (p.platforms) basicParts.push(`Primary Platforms: ${p.platforms}`);
  if (p.instagram_url) basicParts.push(`Instagram: ${p.instagram_url}`);
  if (p.youtube_url) basicParts.push(`YouTube: ${p.youtube_url}`);
  if (p.other_social_links) basicParts.push(`Other Socials: ${p.other_social_links}`);
  if (basicParts.length) sections.push(`BASIC PROFILE:\n${basicParts.join('\n')}`);

  // Audience & Reach
  const audienceParts = [];
  if (p.followers_count) audienceParts.push(`Followers/Subscribers: ${p.followers_count}`);
  if (p.average_views) audienceParts.push(`Average Views: ${p.average_views}`);
  if (p.average_reach) audienceParts.push(`Monthly Reach: ${p.average_reach}`);
  if (p.engagement_rate) audienceParts.push(`Engagement Rate: ${p.engagement_rate}`);
  if (p.audience_location) audienceParts.push(`Audience Top Locations: ${p.audience_location}`);
  if (p.audience_age) audienceParts.push(`Audience Age Bracket: ${p.audience_age}`);
  if (p.audience_demographics) audienceParts.push(`Audience Demographics: ${p.audience_demographics}`);
  if (p.audience_interests) audienceParts.push(`Audience Core Interests: ${p.audience_interests}`);
  if (audienceParts.length) sections.push(`AUDIENCE & METRICS:\n${audienceParts.join('\n')}`);

  // Content & Niche
  const contentParts = [];
  if (p.main_niche) contentParts.push(`Primary Niche: ${p.main_niche}`);
  if (p.secondary_niches) contentParts.push(`Secondary Niches: ${p.secondary_niches}`);
  if (p.content_formats) contentParts.push(`Content Formats Produced: ${p.content_formats}`);
  if (p.content_style) contentParts.push(`Content Style & Tone: ${p.content_style}`);
  if (contentParts.length) sections.push(`CONTENT & NICHE:\n${contentParts.join('\n')}`);

  // Commercial Terms & Rates
  const commercialParts = [];
  if (p.typical_rates) commercialParts.push(`Typical Rates / Rate Card: ${p.typical_rates}`);
  if (p.min_acceptable_payment) commercialParts.push(`MINIMUM Acceptable Payment (Hard Floor): ${p.min_acceptable_payment}`);
  if (p.preferred_collab_types) commercialParts.push(`Preferred Collaboration Types: ${p.preferred_collab_types}`);
  if (p.preferred_industries) commercialParts.push(`Preferred Brand Industries: ${p.preferred_industries}`);
  if (p.unwanted_industries) commercialParts.push(`EXCLUDED / Unwanted Industries & Categories: ${p.unwanted_industries}`);
  if (commercialParts.length) sections.push(`COMMERCIAL & RATES:\n${commercialParts.join('\n')}`);

  // Preferences & Dealbreakers
  const prefParts = [];
  if (p.dealbreakers) prefParts.push(`Personal Dealbreaker Rules: ${p.dealbreakers}`);
  if (p.exclusivity_preferences) prefParts.push(`Exclusivity Terms Limit: ${p.exclusivity_preferences}`);
  if (p.usage_rights_preferences) prefParts.push(`Usage Rights Policy: ${p.usage_rights_preferences}`);
  if (p.max_revisions) prefParts.push(`Revision Limits: ${p.max_revisions}`);
  if (p.unpaid_collab_rules) prefParts.push(`Unpaid / Gifted Policy: ${p.unpaid_collab_rules}`);
  if (prefParts.length) sections.push(`DEAL PREFERENCES & LIMITS:\n${prefParts.join('\n')}`);

  return sections.join('\n\n');
}

function getProfileSummary(p) {
  if (!p) return '';
  const name = p.name || 'Creator Profile';
  const niche = p.main_niche || p.platforms || '';
  const followers = p.followers_count ? `(${p.followers_count})` : '';
  return `${name} ${niche ? '• ' + niche : ''} ${followers}`.trim();
}

function updateCheckerProfileBanner(profile) {
  const banner = document.getElementById('active-profile-banner');
  const summaryEl = document.getElementById('active-profile-summary');
  const profileGroup = document.getElementById('profile-input-group');
  const toggleBtn = document.getElementById('btn-toggle-manual-profile');

  if (!banner || !summaryEl) return;

  const hasData = profile && (profile.name || profile.main_niche || profile.followers_count || profile.min_acceptable_payment);

  if (hasData) {
    summaryEl.textContent = getProfileSummary(profile);
    banner.style.display = 'flex';

    if (profileGroup) {
      profileGroup.classList.add('profile-auto-saved');
    }
    if (toggleBtn) {
      toggleBtn.style.display = 'inline-flex';
    }
  } else {
    banner.style.display = 'none';
    if (profileGroup) {
      profileGroup.classList.remove('profile-auto-saved');
    }
    if (toggleBtn) {
      toggleBtn.style.display = 'none';
    }
  }
}
