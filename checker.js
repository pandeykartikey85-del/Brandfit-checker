// ============================================
// Checker Tab
// Handles the main evaluation flow:
// input validation → rules fetch → Gemini call →
// result display → auto-save to Supabase.
// ============================================

let currentPitchInputMode = 'text'; // 'text' | 'image' | 'url'
let uploadedScreenshotData = null;

function initChecker() {
  const checkBtn = document.getElementById('check-btn');
  if (checkBtn) {
    checkBtn.addEventListener('click', handleCheckFit);
  }

  // Allow Ctrl+Enter to submit from either textarea
  const pitchInput = document.getElementById('pitch-input');
  const profileInput = document.getElementById('profile-input');
  if (pitchInput) pitchInput.addEventListener('keydown', handleCtrlEnter);
  if (profileInput) profileInput.addEventListener('keydown', handleCtrlEnter);

  // Initialize input mode tabs (Paste Text | Upload Screenshot | Paste URL)
  initInputModeTabs();

  // Initialize Brand Mode Pitch Extraction button
  const extractBtn = document.getElementById('btn-extract-creator-pitch');
  if (extractBtn) {
    extractBtn.addEventListener('click', handleExtractCreatorClaims);
  }

  // Initialize Compare Creators Creator 3 toggle
  const addCmp3Btn = document.getElementById('btn-add-creator-3');
  const col3 = document.getElementById('compare-col-3');
  const removeCmp3Btn = document.getElementById('btn-remove-creator-3');

  if (addCmp3Btn && col3) {
    addCmp3Btn.addEventListener('click', () => {
      col3.style.display = 'flex';
      addCmp3Btn.style.display = 'none';
      if (typeof playClickSound === 'function') playClickSound();
    });
  }

  if (removeCmp3Btn && col3 && addCmp3Btn) {
    removeCmp3Btn.addEventListener('click', () => {
      col3.style.display = 'none';
      addCmp3Btn.style.display = 'inline-flex';
      const n3 = document.getElementById('cmp-name-3');
      const p3 = document.getElementById('cmp-price-3');
      const t3 = document.getElementById('cmp-pitch-3');
      if (n3) n3.value = '';
      if (p3) p3.value = '';
      if (t3) t3.value = '';
      if (typeof playClickSound === 'function') playClickSound();
    });
  }

  // Edit profile link in active profile banner
  const editProfileLink = document.getElementById('btn-edit-profile-link');
  if (editProfileLink) {
    editProfileLink.addEventListener('click', (e) => {
      e.preventDefault();
      const currentMode = typeof getUserMode === 'function' ? getUserMode() : 'creator';
      if (typeof showTab === 'function') {
        showTab(currentMode === 'brand' ? 'brand-profile' : 'profile');
      }
    });
  }

  // Toggle manual profile input accordion
  const toggleBtn = document.getElementById('btn-toggle-manual-profile');
  const profileGroup = document.getElementById('profile-input-group');
  if (toggleBtn && profileGroup) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      profileGroup.classList.toggle('manual-expanded');
      const isExpanded = profileGroup.classList.contains('manual-expanded');
      toggleBtn.textContent = isExpanded ? 'Hide manual profile override ▲' : 'Override profile for this check ▼';
    });
  }

  // Initialize UI for active mode (Creator or Brand)
  const initialMode = typeof getUserMode === 'function' ? (getUserMode() || 'creator') : 'creator';
  updateCheckerModeUI(initialMode);
}

function initInputModeTabs() {
  const modeButtons = document.querySelectorAll('.input-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.inputMode;
      setInputMode(mode);
    });
  });

  // Setup Screenshot Dropzone
  initScreenshotDropzone();

  // Setup URL Fetcher
  initUrlFetcher();
}

function setInputMode(mode) {
  currentPitchInputMode = mode;

  // Update tabs active state
  document.querySelectorAll('.input-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.inputMode === mode);
  });

  // Update panels active state
  document.querySelectorAll('.pitch-input-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-input-${mode}`);
  });

  // Update Check button text and UI visibility for compare mode
  const checkBtn = document.getElementById('check-btn');
  const profileInputGroup = document.getElementById('profile-input-group');
  const isBrand = (typeof getUserMode === 'function' ? getUserMode() : 'creator') === 'brand';

  if (checkBtn) {
    if (mode === 'compare') {
      checkBtn.textContent = 'Compare Creators Side-by-Side';
      if (profileInputGroup) profileInputGroup.style.display = 'none';
    } else {
      checkBtn.textContent = isBrand ? 'Evaluate Creator Fit' : 'Check Fit';
      if (profileInputGroup) profileInputGroup.style.display = 'block';
    }
  }

  if (typeof playClickSound === 'function') playClickSound();
}

// ============================================
// Mode-Aware Dynamic UI for Checker Tab
// Switches labels, placeholders, dropzone hints,
// and banner between Creator and Brand Mode.
// ============================================

function updateCheckerModeUI(mode = (typeof getUserMode === 'function' ? getUserMode() : 'creator')) {
  const isBrand = mode === 'brand';

  // 1. Text panel
  const labelTextInput = document.getElementById('label-text-input');
  const pitchInput = document.getElementById('pitch-input');
  const brandExtractActions = document.getElementById('brand-extract-actions');
  const creatorExtractedCard = document.getElementById('creator-extracted-details-card');

  if (labelTextInput) {
    labelTextInput.textContent = isBrand
      ? "Paste the creator's pitch, DM, or email"
      : "Paste the brand's pitch / message";
  }
  if (pitchInput) {
    pitchInput.placeholder = isBrand
      ? "Paste the creator's DM, email, sponsorship proposal, rate card, or media kit text here…"
      : "Paste the full email, DM, or message from the brand here…";
  }
  if (brandExtractActions) {
    brandExtractActions.style.display = isBrand ? 'flex' : 'none';
  }
  if (!isBrand && creatorExtractedCard) {
    creatorExtractedCard.style.display = 'none';
  }

  // 2. Image / Screenshot panel
  const labelImageInput = document.getElementById('label-image-input');
  const dropzoneTitle = document.getElementById('dropzone-title');
  const dropzoneHint = document.getElementById('dropzone-hint');
  const labelImageExtracted = document.getElementById('label-image-extracted-text');

  if (labelImageInput) {
    labelImageInput.textContent = isBrand
      ? "Upload Creator Screenshot or Media Kit"
      : "Upload Screenshot or Image";
  }
  if (dropzoneTitle) {
    dropzoneTitle.innerHTML = isBrand
      ? 'Drag & drop creator screenshot or media kit here, or <span class="dropzone-link">browse</span>'
      : 'Drag & drop your screenshot here, or <span class="dropzone-link">browse</span>';
  }
  if (dropzoneHint) {
    dropzoneHint.textContent = isBrand
      ? "Supports Instagram DM, creator email, pitch, media kit, analytics screenshot, profile screenshot, WhatsApp conversation (PNG, JPG, WEBP)"
      : "Supports Instagram DMs, WhatsApp, Emails, Briefs, Proposals & Contracts (PNG, JPG, WEBP)";
  }
  if (labelImageExtracted) {
    labelImageExtracted.textContent = isBrand
      ? "Extracted Creator Pitch & Metrics (Editable)"
      : "Extracted Pitch Text (Editable)";
  }

  // 3. URL panel
  const labelUrlInput = document.getElementById('label-url-input');
  const pitchUrlInput = document.getElementById('pitch-url-input');
  const pitchUrlHint = document.getElementById('pitch-url-hint');
  const labelUrlExtracted = document.getElementById('label-url-extracted-text');

  if (labelUrlInput) {
    labelUrlInput.textContent = isBrand
      ? "Paste Creator Profile URL"
      : "Paste Brand or Campaign URL";
  }
  if (pitchUrlInput) {
    pitchUrlInput.placeholder = isBrand
      ? "https://instagram.com/creator or youtube.com/@channel or creator website"
      : "https://brand-website.com/campaign or product page";
  }
  if (pitchUrlHint) {
    pitchUrlHint.textContent = isBrand
      ? "Retrieve public profile info where technically possible. If protected or inaccessible, upload a screenshot or media kit."
      : "We'll fetch publicly accessible text from the page without inventing unverified claims.";
  }
  if (labelUrlExtracted) {
    labelUrlExtracted.textContent = isBrand
      ? "Retrieved Creator Profile Content (Editable)"
      : "Retrieved Page Content (Editable)";
  }

  // 4. Manual profile drawer
  const labelProfileInput = document.getElementById('label-profile-input');
  const profileInput = document.getElementById('profile-input');
  if (labelProfileInput) {
    labelProfileInput.textContent = isBrand
      ? "Describe your brand & campaign (Optional if Brand Profile is saved)"
      : "Describe your profile (Optional if My Profile is saved)";
  }
  if (profileInput) {
    profileInput.placeholder = isBrand
      ? "E.g., Sustainable athletic wear brand looking for fitness creators with 20K–100K followers for product launch sponsorship..."
      : "E.g., Tech reviewer on YouTube, 45K subscribers, audience is 18–34 male, primarily interested in budget smartphones and gadgets…";
  }

  // 5. Compare Creators Tab Visibility (Brand Mode only)
  const compareTabBtn = document.getElementById('btn-mode-compare');
  if (compareTabBtn) {
    compareTabBtn.style.display = isBrand ? 'inline-flex' : 'none';
  }
  if (!isBrand && currentPitchInputMode === 'compare') {
    setInputMode('text');
  }

  // 6. Check button
  const checkBtn = document.getElementById('check-btn');
  if (checkBtn && !checkBtn.disabled) {
    if (currentPitchInputMode === 'compare') {
      checkBtn.textContent = 'Compare Creators Side-by-Side';
    } else {
      checkBtn.textContent = isBrand ? "Evaluate Creator Fit" : "Check Fit";
    }
  }

  // 7. Update Active Profile Banner
  updateActiveModeProfileBanner(mode);
}

async function updateActiveModeProfileBanner(mode = (typeof getUserMode === 'function' ? getUserMode() : 'creator')) {
  const banner = document.getElementById('active-profile-banner');
  const summaryEl = document.getElementById('active-profile-summary');
  const editLink = document.getElementById('btn-edit-profile-link');
  const profileGroup = document.getElementById('profile-input-group');
  const toggleBtn = document.getElementById('btn-toggle-manual-profile');

  if (!banner || !summaryEl) return;

  if (mode === 'brand') {
    let profile = null;
    if (typeof getBrandProfile === 'function') {
      profile = await getBrandProfile();
    } else if (typeof getLocalBrandProfile === 'function') {
      profile = getLocalBrandProfile();
    }

    const hasData = profile && (profile.brand_name || profile.industry || profile.campaign_objective);
    if (hasData) {
      const summaryText = typeof getBrandProfileSummary === 'function'
        ? getBrandProfileSummary(profile)
        : (profile.brand_name || 'Brand Profile');
      summaryEl.textContent = summaryText;
      banner.style.display = 'flex';
      if (editLink) {
        editLink.textContent = 'Edit Brand Profile';
      }
      if (profileGroup) profileGroup.classList.add('profile-auto-saved');
      if (toggleBtn) toggleBtn.style.display = 'inline-flex';
    } else {
      banner.style.display = 'none';
      if (profileGroup) profileGroup.classList.remove('profile-auto-saved');
      if (toggleBtn) toggleBtn.style.display = 'none';
    }
  } else {
    // Creator mode
    let profile = null;
    if (typeof getCreatorProfile === 'function') {
      profile = await getCreatorProfile();
    } else if (typeof getLocalCreatorProfile === 'function') {
      profile = getLocalCreatorProfile();
    }

    const hasData = profile && (profile.name || profile.main_niche || profile.followers_count || profile.min_acceptable_payment);
    if (hasData) {
      const summaryText = typeof getProfileSummary === 'function'
        ? getProfileSummary(profile)
        : (profile.name || 'Creator Profile');
      summaryEl.textContent = summaryText;
      banner.style.display = 'flex';
      if (editLink) {
        editLink.textContent = 'Edit Profile';
      }
      if (profileGroup) profileGroup.classList.add('profile-auto-saved');
      if (toggleBtn) toggleBtn.style.display = 'inline-flex';
    } else {
      banner.style.display = 'none';
      if (profileGroup) profileGroup.classList.remove('profile-auto-saved');
      if (toggleBtn) toggleBtn.style.display = 'none';
    }
  }
}

// Backward-compatible alias
function updateCheckerProfileBanner(profile) {
  updateActiveModeProfileBanner(typeof getUserMode === 'function' ? getUserMode() : 'creator');
}

// ============================================
// Brand Mode: Creator Claims Extraction
// ============================================

async function handleExtractCreatorClaims() {
  const pitchInput = document.getElementById('pitch-input');
  const extractedCard = document.getElementById('creator-extracted-details-card');
  const extractBtn = document.getElementById('btn-extract-creator-pitch');
  const errorEl = document.getElementById('checker-error');

  const text = pitchInput ? pitchInput.value.trim() : '';
  if (!text) {
    if (errorEl) {
      errorEl.textContent = "Please paste the creator's pitch, DM, or email text first before extracting.";
      errorEl.classList.add('visible');
    }
    return;
  }
  if (errorEl) errorEl.classList.remove('visible');

  if (extractBtn) {
    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="spinner"></span> Extracting creator claims…';
  }

  try {
    const claims = await extractCreatorPitchDetails(text);
    renderExtractedCreatorDetails(claims, extractedCard);
  } catch (err) {
    console.warn('Creator claims extraction failed:', err);
    if (extractedCard) {
      if (err && err.isRateLimit) {
        extractedCard.innerHTML = (typeof getRateLimitNoticeHtml === 'function')
          ? getRateLimitNoticeHtml(err.message)
          : `<p class="extract-error">${escapeHtml(err.message)}</p>`;
      } else {
        extractedCard.innerHTML = `<p class="extract-error">Extraction failed: ${escapeHtml(err.message)}</p>`;
      }
      extractedCard.style.display = 'block';
    }
  } finally {
    if (extractBtn) {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span>✨ Extract Creator Claims</span>';
    }
  }
}

function renderExtractedCreatorDetails(claims, container) {
  if (!container) return;

  const items = [
    { label: 'Creator / Channel', value: claims.creatorName, icon: '👤' },
    { label: 'Handle / Account', value: claims.handle, icon: '🏷️' },
    { label: 'Followers / Audience', value: claims.followers, icon: '👥' },
    { label: 'Claimed Engagement', value: claims.claimedEngagement, icon: '📈' },
    { label: 'Claimed Reach', value: claims.claimedReach, icon: '🚀' },
    { label: 'Niche', value: claims.niche, icon: '🎯' },
    { label: 'Platforms', value: claims.platforms, icon: '📱' },
    { label: 'Proposed Collab', value: claims.proposedCollaboration, icon: '🤝' },
    { label: 'Deliverables', value: claims.deliverables, icon: '📦' },
    { label: 'Rate / Compensation', value: claims.rate, icon: '💰' },
    { label: 'Contact Details', value: claims.contactDetails, icon: '📬' },
    { label: 'Other Claims', value: claims.otherClaims, icon: '📝' }
  ];

  const validItems = items.filter(it => it.value && it.value !== 'null' && it.value !== 'Not specified');

  const gridHtml = validItems.map(it => `
    <div class="extracted-claim-item">
      <span class="claim-label">${it.icon} ${escapeHtml(it.label)}:</span>
      <strong class="claim-val">${escapeHtml(it.value)}</strong>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="extracted-claims-header">
      <span class="extracted-claims-title">📊 Extracted Creator Claims (${validItems.length} found)</span>
      <button type="button" class="btn-dismiss-claims" title="Hide claims summary">&times;</button>
    </div>
    <div class="extracted-claims-grid">
      ${gridHtml || '<p class="text-muted" style="font-size:0.85rem;">No specific claims detected. Ensure the text contains details like followers, rates, deliverables, or handles.</p>'}
    </div>
  `;
  container.style.display = 'block';

  const dismissBtn = container.querySelector('.btn-dismiss-claims');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      container.style.display = 'none';
    };
  }
}

function initScreenshotDropzone() {
  const dropzone = document.getElementById('screenshot-dropzone');
  const fileInput = document.getElementById('screenshot-file-input');
  const removeBtn = document.getElementById('btn-remove-screenshot');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleImageFile(fileInput.files[0]);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', resetScreenshotInput);
  }
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, WEBP, or GIF).');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const [header, base64Data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || file.type;

    uploadedScreenshotData = {
      mimeType,
      data: base64Data,
      name: file.name
    };

    // Show preview UI
    const previewContainer = document.getElementById('screenshot-preview-container');
    const previewImg = document.getElementById('screenshot-preview-img');
    const filenameEl = document.getElementById('screenshot-filename');
    const dropzone = document.getElementById('screenshot-dropzone');
    const ocrIndicator = document.getElementById('ocr-status-indicator');
    const extractedTextarea = document.getElementById('extracted-image-text');

    if (previewImg) previewImg.src = dataUrl;
    if (filenameEl) filenameEl.textContent = file.name;
    if (dropzone) dropzone.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'block';

    // Run OCR extraction via Gemini
    if (ocrIndicator) {
      ocrIndicator.style.display = 'inline-flex';
      ocrIndicator.innerHTML = '<span class="ocr-spinner"></span> Extracting pitch text from screenshot…';
      ocrIndicator.className = 'ocr-status-indicator';
    }

    try {
      const currentMode = typeof getUserMode === 'function' ? getUserMode() : 'creator';
      const extractedText = await extractTextFromImage({ mimeType, data: base64Data }, currentMode);
      if (extractedTextarea) {
        extractedTextarea.value = extractedText;
      }
      if (ocrIndicator) {
        ocrIndicator.innerHTML = '✓ Text extracted successfully';
        ocrIndicator.classList.add('ocr-complete');
      }
    } catch (err) {
      console.warn('OCR extraction failed:', err);
      if (ocrIndicator) {
        if (err && err.isRateLimit) {
          ocrIndicator.innerHTML = '⚠️ Daily free limit reached. <a href="#" onclick="if(typeof showSettingsModal===\'function\')showSettingsModal();return false;" style="text-decoration:underline;font-weight:600;color:inherit;">Enter your API key</a> or type text manually.';
        } else {
          ocrIndicator.innerHTML = '⚠️ Could not auto-extract text. Please review the image and type or paste the text.';
        }
        ocrIndicator.classList.add('ocr-error');
      }
    } finally {
      // Memory Hygiene: Clean up base64 payload from in-memory object once OCR processing is completed
      if (uploadedScreenshotData) {
        uploadedScreenshotData.data = null;
      }
    }
  };

  reader.readAsDataURL(file);
}

function resetScreenshotInput() {
  uploadedScreenshotData = null;
  const fileInput = document.getElementById('screenshot-file-input');
  const previewContainer = document.getElementById('screenshot-preview-container');
  const dropzone = document.getElementById('screenshot-dropzone');
  const extractedTextarea = document.getElementById('extracted-image-text');
  const ocrIndicator = document.getElementById('ocr-status-indicator');

  if (fileInput) fileInput.value = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (dropzone) dropzone.style.display = 'block';
  if (extractedTextarea) extractedTextarea.value = '';
  if (ocrIndicator) {
    ocrIndicator.className = 'ocr-status-indicator';
    ocrIndicator.style.display = 'none';
  }
}

function initUrlFetcher() {
  const fetchBtn = document.getElementById('btn-fetch-url-content');
  const urlInput = document.getElementById('pitch-url-input');

  if (fetchBtn && urlInput) {
    fetchBtn.addEventListener('click', () => handleFetchUrl(urlInput.value.trim()));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFetchUrl(urlInput.value.trim());
      }
    });
  }
}

async function handleFetchUrl(url) {
  const statusEl = document.getElementById('url-status-message');
  const containerEl = document.getElementById('url-extracted-container');
  const textareaEl = document.getElementById('extracted-url-text');
  const fetchBtn = document.getElementById('btn-fetch-url-content');

  if (!url) {
    if (statusEl) {
      statusEl.textContent = 'Please enter a webpage URL first.';
      statusEl.className = 'url-status-message status-error visible';
      statusEl.style.display = 'block';
    }
    return;
  }

  if (fetchBtn) {
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching…';
  }
  if (statusEl) {
    statusEl.textContent = 'Fetching public page content…';
    statusEl.className = 'url-status-message status-info visible';
    statusEl.style.display = 'block';
  }

  try {
    const currentMode = typeof getUserMode === 'function' ? getUserMode() : 'creator';
    const res = await fetchPageContentFromUrl(url, currentMode);

    if (res.success && res.text) {
      if (textareaEl) textareaEl.value = res.text;
      if (containerEl) containerEl.style.display = 'block';
      if (statusEl) {
        statusEl.textContent = `✓ Retrieved content from ${res.domain || 'page'}`;
        statusEl.className = 'url-status-message status-success visible';
      }
    } else {
      if (containerEl) containerEl.style.display = 'none';
      if (statusEl) {
        statusEl.textContent = res.message || (currentMode === 'brand'
          ? "We couldn't retrieve sufficient public profile information. Upload a screenshot, media kit, or analytics report."
          : "We couldn't retrieve enough information from this page. Upload a screenshot or paste the relevant text for a deeper analysis.");
        statusEl.className = 'url-status-message status-error visible';
      }
    }
  } catch (err) {
    const currentMode = typeof getUserMode === 'function' ? getUserMode() : 'creator';
    if (statusEl) {
      statusEl.textContent = currentMode === 'brand'
        ? "We couldn't retrieve sufficient public profile information. Upload a screenshot, media kit, or analytics report."
        : "We couldn't retrieve enough information from this page. Upload a screenshot or paste the relevant text for a deeper analysis.";
      statusEl.className = 'url-status-message status-error visible';
    }
  } finally {
    if (fetchBtn) {
      fetchBtn.disabled = false;
      fetchBtn.textContent = 'Fetch Page';
    }
  }
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

  // 1. Normalize pitch text based on active input mode
  let pitch = '';

  if (currentPitchInputMode === 'text') {
    pitch = pitchInput ? pitchInput.value.trim() : '';
  } else if (currentPitchInputMode === 'image') {
    const extractedEl = document.getElementById('extracted-image-text');
    pitch = extractedEl ? extractedEl.value.trim() : '';
    if (!pitch && uploadedScreenshotData) {
      errorEl.textContent = 'Extracting text from your screenshot. Please wait a moment or review the extracted text.';
      errorEl.classList.add('visible');
      return;
    }
  } else if (currentPitchInputMode === 'url') {
    const urlTextEl = document.getElementById('extracted-url-text');
    const urlInputEl = document.getElementById('pitch-url-input');
    pitch = urlTextEl ? urlTextEl.value.trim() : '';

    if (!pitch && urlInputEl && urlInputEl.value.trim()) {
      // Auto-fetch if user pasted URL and clicked Check Fit directly
      await handleFetchUrl(urlInputEl.value.trim());
      pitch = urlTextEl ? urlTextEl.value.trim() : '';
    }
  }

  const isBrand = (typeof getUserMode === 'function' ? getUserMode() : 'creator') === 'brand';

  if (currentPitchInputMode === 'compare') {
    await handleCheckCompareCreators(isBrand);
    return;
  }

  let manualProfile = profileInput ? profileInput.value.trim() : '';

  // Determine effective profile: manual override or saved creator/brand profile
  let effectiveProfile = manualProfile;
  if (!effectiveProfile) {
    if (isBrand) {
      if (typeof getBrandProfile === 'function') {
        const savedBrand = await getBrandProfile();
        if (savedBrand && typeof formatBrandProfileForPrompt === 'function') {
          effectiveProfile = formatBrandProfileForPrompt(savedBrand);
        }
      }
    } else {
      if (typeof getCreatorProfile === 'function') {
        const savedProfileObj = await getCreatorProfile();
        if (savedProfileObj && typeof formatProfileForPrompt === 'function') {
          effectiveProfile = formatProfileForPrompt(savedProfileObj);
        }
      }
    }
  }

  // Validation: empty pitch
  if (!pitch) {
    let modePrompt = '';
    if (isBrand) {
      modePrompt = currentPitchInputMode === 'image'
        ? 'Please upload a screenshot or media kit of the creator before evaluating.'
        : currentPitchInputMode === 'url'
        ? 'Please enter and fetch a creator profile URL before evaluating.'
        : 'Please paste the creator’s DM, pitch, or email before evaluating.';
    } else {
      modePrompt = currentPitchInputMode === 'image'
        ? 'Please upload a screenshot of the brand pitch before checking.'
        : currentPitchInputMode === 'url'
        ? 'Please enter and fetch a brand/campaign webpage URL before checking.'
        : 'Please paste the brand’s pitch before checking.';
    }
    errorEl.textContent = modePrompt;
    errorEl.classList.add('visible');
    return;
  }

  // Validation: no profile
  if (!effectiveProfile) {
    errorEl.textContent = isBrand
      ? 'Please enter your brand & campaign details below or save your profile in the "Brand Profile" tab.'
      : 'Please enter your profile details below or save your profile in the "My Profile" tab.';
    errorEl.classList.add('visible');
    return;
  }

  // Validation: pitch too short (under 15 words)
  const wordCount = pitch.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 15) {
    errorEl.textContent =
      'This pitch content is too short to evaluate properly. Please provide more context (at least 15 words).';
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

    // 2. Call Gemini for evaluation with effective profile
    let result;
    if (isBrand) {
      result = await evaluateCreatorForBrand(pitch, effectiveProfile, personalRules);
    } else {
      result = await evaluatePitch(pitch, effectiveProfile, personalRules);
    }

    // Stop rotation before rendering result
    stopLoadingState(checkBtn);

    // 3. Display the result
    if (isBrand) {
      displayBrandResult(result, resultEl, pitch);
    } else {
      displayResult(result, resultEl, pitch);
    }

    // 4. Auto-save to Supabase
    try {
      const reasoningText = Array.isArray(result.reasons) && result.reasons.length > 0
        ? result.reasons.join('\n')
        : (result.recommendationExplanation || '');
      await saveEvaluation(pitch, effectiveProfile, result.verdict, reasoningText);
      showSaveConfirmation(resultEl);
    } catch (e) {
      console.error('Failed to save evaluation:', e);
      // Don't block the user — result is still shown
    }
  } catch (error) {
    stopLoadingState(checkBtn);
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

async function handleCheckCompareCreators(isBrand) {
  const errorEl = document.getElementById('checker-error');
  const resultEl = document.getElementById('checker-result');
  const checkBtn = document.getElementById('check-btn');

  const name1 = (document.getElementById('cmp-name-1')?.value || '').trim();
  const price1 = (document.getElementById('cmp-price-1')?.value || '').trim();
  const pitch1 = (document.getElementById('cmp-pitch-1')?.value || '').trim();

  const name2 = (document.getElementById('cmp-name-2')?.value || '').trim();
  const price2 = (document.getElementById('cmp-price-2')?.value || '').trim();
  const pitch2 = (document.getElementById('cmp-pitch-2')?.value || '').trim();

  const col3 = document.getElementById('compare-col-3');
  const isCol3Visible = col3 && col3.style.display !== 'none';
  const name3 = (document.getElementById('cmp-name-3')?.value || '').trim();
  const price3 = (document.getElementById('cmp-price-3')?.value || '').trim();
  const pitch3 = (document.getElementById('cmp-pitch-3')?.value || '').trim();

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
    errorEl.textContent = 'Please provide details (pitch, stats, or rates) for at least Creator 1 and Creator 2 to compare.';
    errorEl.classList.add('visible');
    return;
  }

  if (typeof playClickSound === 'function') playClickSound();
  if (typeof setMascotState === 'function') setMascotState('analyzing');

  // Loading state
  checkBtn.disabled = true;
  checkBtn.innerHTML = '<span class="spinner"></span> Comparing Creators…';

  const placeholder = document.getElementById('checker-empty-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  let currentTipIdx = Math.floor(Math.random() * CREATOR_TIPS.length);
  resultEl.innerHTML = `
    <div class="result-card loading-state-card">
      <div class="loading-state-header">
        <div class="loading-indicator-badge">
          <span class="spinner"></span>
          <span class="loading-label">Evaluating ${creators.length} creators side-by-side with AI…</span>
        </div>
      </div>
      <div class="loading-tip-wrapper">
        <p id="loading-rotating-tip-text" class="loading-rotating-tip">${escapeHtml(CREATOR_TIPS[currentTipIdx])}</p>
      </div>
    </div>
  `;
  resultEl.classList.add('visible');

  try {
    let brandProfile = null;
    if (typeof getBrandProfile === 'function') {
      brandProfile = await getBrandProfile();
    } else if (typeof getLocalBrandProfile === 'function') {
      brandProfile = getLocalBrandProfile();
    }

    const result = await compareCreatorsForBrand(creators, brandProfile);
    stopLoadingState(checkBtn);
    displayBrandCompareResult(result, resultEl);

    if (typeof setMascotState === 'function') setMascotState('good');
  } catch (err) {
    stopLoadingState(checkBtn);
    if (typeof setMascotState === 'function') setMascotState('idle');
    if (err && err.isRateLimit) {
      if (typeof renderRateLimitNoticeCard === 'function') {
        renderRateLimitNoticeCard(resultEl, err.message);
      } else {
        resultEl.innerHTML = `<div class="result-card rate-limit-notice-card"><p>${escapeHtml(err.message)}</p></div>`;
        resultEl.classList.add('visible');
      }
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    } else {
      errorEl.textContent = `Comparison failed: ${err.message}`;
      errorEl.classList.add('visible');
      resultEl.classList.remove('visible');
    }
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
  const isBrand = (typeof getUserMode === 'function' ? getUserMode() : 'creator') === 'brand';
  checkBtn.innerHTML = isBrand ? 'Evaluate Creator Fit' : 'Check Fit';
}

function displayResult(result, container, originalPitch) {
  const verdictClass = {
    'Good Fit': 'verdict-good',
    'Risky':    'verdict-risky',
    'Bad Fit':  'verdict-bad'
  }[result.verdict] || 'verdict-risky';

  // 1. Recommendation Badge & Explanation
  const recommendation = result.recommendation || 'Consider';
  const recBadgeClass = {
    'Strong Fit': 'rec-badge-strong',
    'Worth Negotiating': 'rec-badge-negotiate',
    'Consider': 'rec-badge-consider',
    'Decline': 'rec-badge-decline'
  }[recommendation] || 'rec-badge-consider';

  const recBadgeHtml = `
    <span class="recommendation-badge ${recBadgeClass}">
      <span class="rec-icon">${getRecIcon(recommendation)}</span>
      <span>${escapeHtml(recommendation)}</span>
    </span>
  `;

  // 2. Trade-off Strategic Explanation Callout
  let tradeoffCalloutHtml = '';
  if (result.recommendationExplanation) {
    tradeoffCalloutHtml = `
      <div class="result-section tradeoff-callout-card">
        <div class="tradeoff-callout-header">
          <span class="tradeoff-icon">⚖️</span>
          <h4 class="tradeoff-title">Strategic Trade-off Analysis</h4>
        </div>
        <p class="tradeoff-text">${escapeHtml(cleanModelText(result.recommendationExplanation))}</p>
      </div>
    `;
  }

  // 3. 5-Pillar Trade-off Analysis Grid
  let tradeoffGridHtml = '';
  if (result.tradeoffAnalysis && Object.values(result.tradeoffAnalysis).some(v => v && v.trim())) {
    const ta = result.tradeoffAnalysis;
    const pillars = [
      { icon: '💰', title: 'Financial Value & Effort', text: ta.financialValue },
      { icon: '🎯', title: 'Niche & Audience Synergy', text: ta.nicheAndAudienceFit },
      { icon: '⚖️', title: 'Rights & Contract Terms', text: ta.rightsAndTerms },
      { icon: '📈', title: 'Risk vs. Creator Upside', text: ta.riskVsUpside },
      { icon: '🤝', title: 'Negotiation Leverage', text: ta.negotiationLeverage }
    ].filter(p => p.text && p.text.trim());

    if (pillars.length > 0) {
      const pillarsHtml = pillars.map(p => `
        <div class="tradeoff-pillar-card">
          <div class="pillar-top">
            <span class="pillar-icon">${p.icon}</span>
            <span class="pillar-title">${escapeHtml(p.title)}</span>
          </div>
          <p class="pillar-desc">${escapeHtml(cleanModelText(p.text))}</p>
        </div>
      `).join('');

      tradeoffGridHtml = `
        <div class="result-section tradeoff-pillars-section">
          <div class="section-header">
            <h3 class="section-title">Deal Evaluation Pillars</h3>
            <span class="section-subtitle">Holistic business assessment beyond basic niche match</span>
          </div>
          <div class="tradeoff-pillars-grid">
            ${pillarsHtml}
          </div>
        </div>
      `;
    }
  }

  // 4. 17-Factor Deep Breakdown Chips
  let keyFactorsHtml = '';
  if (result.keyFactors && result.keyFactors.length > 0) {
    const factorsListHtml = result.keyFactors.map(f => {
      const statusClass = `factor-status-${f.status.toLowerCase()}`;
      const statusIcon = {
        'Positive': '✓',
        'Warning': '⚠️',
        'Negative': '✕',
        'Unspecified': '?'
      }[f.status] || '•';

      return `
        <div class="factor-row-item ${statusClass}">
          <div class="factor-row-left">
            <span class="factor-status-pill">${statusIcon} ${escapeHtml(f.status)}</span>
            <strong class="factor-name">${escapeHtml(f.factor)}</strong>
          </div>
          ${f.detail ? `<p class="factor-detail">${escapeHtml(cleanModelText(f.detail))}</p>` : ''}
        </div>
      `;
    }).join('');

    keyFactorsHtml = `
      <div class="result-section key-factors-section">
        <div class="section-header">
          <h3 class="section-title">Factor-by-Factor Breakdown</h3>
          <span class="section-subtitle">Detailed compensation, rights, and risk factors</span>
        </div>
        <div class="factors-table-card">
          ${factorsListHtml}
        </div>
      </div>
    `;
  }

  // 5. Potential Creator Upside Section (Estimates)
  let creatorUpsideHtml = '';
  if (result.creatorUpside && Object.values(result.creatorUpside).some(v => v && v.trim())) {
    const cu = result.creatorUpside;
    const upsideItems = [
      { icon: '👥', label: 'Potential Follower Growth', value: cu.followerGrowth },
      { icon: '📡', label: 'Potential Reach', value: cu.potentialReach },
      { icon: '💬', label: 'Engagement Potential', value: cu.engagementPotential },
      { icon: '📁', label: 'Portfolio Value', value: cu.portfolioValue },
      { icon: '🏅', label: 'Brand Credibility', value: cu.brandCredibility },
      { icon: '🔄', label: 'Future Collaboration Potential', value: cu.futureCollaboration },
      { icon: '🤝', label: 'Networking Value', value: cu.networkingValue },
      { icon: '💰', label: 'Revenue Value', value: cu.revenueValue },
      { icon: '🌐', label: 'Audience Expansion', value: cu.audienceExpansion }
    ].filter(item => item.value && item.value.trim());

    if (upsideItems.length > 0) {
      const itemsHtml = upsideItems.map(item => `
        <div class="upside-dimension-card">
          <div class="upside-dim-header">
            <span class="upside-dim-icon">${item.icon}</span>
            <span class="upside-dim-label">${escapeHtml(item.label)}</span>
          </div>
          <p class="upside-dim-value">${escapeHtml(cleanModelText(item.value))}</p>
        </div>
      `).join('');

      creatorUpsideHtml = `
        <div class="result-section creator-upside-section">
          <div class="section-header">
            <div class="header-with-badge">
              <h3 class="section-title">Potential Creator Upside</h3>
              <span class="badge-tag badge-tag-estimate">AI Estimates · Projections</span>
            </div>
            <span class="section-subtitle">Estimated growth, reach, and credibility upside (Not guaranteed outcomes)</span>
          </div>
          <div class="creator-upside-grid">
            ${itemsHtml}
          </div>
          <p class="estimate-disclaimer-note">
            ⚠️ <em>Estimates are AI strategic projections based on pitch scope and creator demographics. Actual results depend on organic algorithm delivery and audience reception.</em>
          </p>
        </div>
      `;
    }
  }

  // 6. Reasons HTML
  const reasonsHtml = (result.reasons || [])
    .map(r => `<li>${escapeHtml(cleanModelText(r))}</li>`)
    .join('');

  // 7. Pressure Tactics Detected (Combine AI detection with local regex scanner)
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

  // 8. Inline Highlighted Pitch HTML
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

  // 9. Missing-Info Questions ("Ask the brand this")
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

  // 10. Expanded Negotiation Toolkit ("What should I do?") — Provided for every deal!
  const tk = ensureToolkit(result.toolkit, result.verdict, result.reasons);
  const adviceText = cleanModelText(tk.advice);
  const replyText = cleanModelText(tk.writtenReply);
  const talkingPointsHtml = (tk.talkingPoints && tk.talkingPoints.length > 0)
    ? tk.talkingPoints.map(tp => `<li>${escapeHtml(cleanModelText(tp))}</li>`).join('')
    : `<li>${escapeHtml(cleanModelText('Ask for payment details and scope clarification before committing to a call.'))}</li>`;

  const negotiationGuidanceHtml = (tk.whatToNegotiate || tk.why || tk.targetNumberOrCondition) ? `
    <div class="negotiation-strategy-cards">
      ${tk.whatToNegotiate ? `
        <div class="neg-card neg-card-what">
          <span class="neg-card-label">🎯 What to Negotiate:</span>
          <p class="neg-card-val">${escapeHtml(tk.whatToNegotiate)}</p>
        </div>
      ` : ''}
      ${tk.why ? `
        <div class="neg-card neg-card-why">
          <span class="neg-card-label">💡 Strategic Why:</span>
          <p class="neg-card-val">${escapeHtml(tk.why)}</p>
        </div>
      ` : ''}
      ${tk.targetNumberOrCondition ? `
        <div class="neg-card neg-card-target">
          <span class="neg-card-label">🎯 Target Number / Condition:</span>
          <p class="neg-card-val">${escapeHtml(tk.targetNumberOrCondition)}</p>
        </div>
      ` : ''}
    </div>
  ` : '';

  const toolkitHtml = `
    <div class="result-section toolkit-panel">
      <div class="section-header">
        <div class="header-with-badge">
          <h3 class="section-title toolkit-title">Negotiation & Response Toolkit</h3>
          <span class="badge-tag badge-tag-purple">Action Plan</span>
        </div>
        <span class="section-subtitle">What to negotiate, target numbers, and ready-to-send responses</span>
      </div>

      ${negotiationGuidanceHtml}

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
        <div class="verdict-row-wrapper">
          <div class="verdict-badge ${verdictClass}">
            ${escapeHtml(result.verdict)}
          </div>
          ${recBadgeHtml}
        </div>
        <ul class="reasons-list">
          ${reasonsHtml}
        </ul>
      </div>

      ${tradeoffCalloutHtml}
      ${tradeoffGridHtml}
      ${creatorUpsideHtml}
      ${keyFactorsHtml}
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

// ============================================
// Brand Mode Result Display
// Dedicated dashboard evaluating creator against
// brand profile: Audience Fit, Creator Quality,
// Claims vs Evidence, and Questions to Ask.
// ============================================

function displayBrandResult(result, container, originalPitch) {
  const verdictClass = {
    'Good Fit': 'verdict-good',
    'Risky':    'verdict-risky',
    'Bad Fit':  'verdict-bad'
  }[result.verdict] || 'verdict-risky';

  // 1. Practical Recommendation Categories Mapping
  const recommendation = result.recommendation || 'Request More Information';
  const recMap = {
    'Strongly Consider': {
      cardClass: 'rec-hero-strongly-consider',
      badgeClass: 'rec-badge-strongly-consider',
      icon: '🌟',
      title: 'Strongly Consider'
    },
    'Consider': {
      cardClass: 'rec-hero-consider',
      badgeClass: 'rec-badge-consider',
      icon: '💡',
      title: 'Consider'
    },
    'Request More Information': {
      cardClass: 'rec-hero-request-info',
      badgeClass: 'rec-badge-request-info',
      icon: '🔍',
      title: 'Request More Information'
    },
    'Negotiate': {
      cardClass: 'rec-hero-negotiate',
      badgeClass: 'rec-badge-negotiate',
      icon: '🤝',
      title: 'Negotiate'
    },
    'Low Priority': {
      cardClass: 'rec-hero-low-priority',
      badgeClass: 'rec-badge-low-priority',
      icon: '⏳',
      title: 'Low Priority'
    },
    'Reject': {
      cardClass: 'rec-hero-reject',
      badgeClass: 'rec-badge-reject',
      icon: '🛑',
      title: 'Reject'
    }
  };

  const recMeta = recMap[recommendation] || recMap['Request More Information'];

  // Hero Recommendation Card with Plain-English Explanation
  const recHeroHtml = `
    <div class="brand-hero-recommendation-card ${recMeta.cardClass}">
      <div class="brand-hero-top">
        <div class="brand-hero-badge ${recMeta.badgeClass}">
          <span class="hero-icon">${recMeta.icon}</span>
          <span class="hero-text">${escapeHtml(recMeta.title)}</span>
        </div>
        <span class="brand-verdict-pill ${verdictClass}">Database Fit: ${escapeHtml(result.verdict)}</span>
      </div>
      <p class="brand-hero-explanation">${escapeHtml(cleanModelText(result.recommendationExplanation || 'Evaluated against your active Brand Profile and campaign requirements.'))}</p>
      ${result.executiveSummary && result.executiveSummary !== result.recommendationExplanation ? `
        <p class="brand-hero-exec-summary">${escapeHtml(cleanModelText(result.executiveSummary))}</p>
      ` : ''}
    </div>
  `;

  // 2. Cost vs. Value Analysis (Dynamic Pricing Assessment)
  let costVsValueHtml = '';
  const cv = result.costVsValue || {};
  const statedPrice = cv.statedPrice || 'None stated / Rate on request';
  const pricingAssessment = cv.pricingAssessment || 'Unspecified / Rate on Request';
  const pricingReasoning = cv.reasoning || '';

  const priceBadgeClass = {
    'Strong Value': 'price-badge-strong-value',
    'Potentially Fair': 'price-badge-fair',
    'Expensive': 'price-badge-expensive',
    'Unspecified / Rate on Request': 'price-badge-unspecified'
  }[pricingAssessment] || 'price-badge-fair';

  costVsValueHtml = `
    <div class="result-section brand-cost-value-section">
      <div class="section-header">
        <div class="header-with-badge">
          <h3 class="section-title">Cost vs. Value Analysis</h3>
          <span class="pricing-assessment-badge ${priceBadgeClass}">Pricing Assessment: ${escapeHtml(pricingAssessment)}</span>
        </div>
        <span class="section-subtitle">Evaluated dynamically against followers, reach, engagement, deliverables, usage rights, and campaign goals</span>
      </div>
      <div class="cost-value-card">
        <div class="cost-value-meta-bar">
          <div class="cost-meta-col">
            <span class="meta-label">Quoted Rate / Ask:</span>
            <strong class="meta-val">${escapeHtml(statedPrice)}</strong>
          </div>
          <div class="cost-meta-col">
            <span class="meta-label">Pricing Assessment:</span>
            <span class="pricing-pill ${priceBadgeClass}">${escapeHtml(pricingAssessment)}</span>
          </div>
        </div>
        ${pricingReasoning ? `<p class="cost-value-reasoning-text">${escapeHtml(cleanModelText(pricingReasoning))}</p>` : ''}
        <div class="pricing-disclaimer-note">
          <span>ℹ️ Cost effectiveness is evaluated against deliverables, reach, and format. Exact market rates vary by niche negotiation leverage.</span>
        </div>
      </div>
    </div>
  `;

  // 3. Potential Brand Benefit (AI Estimates across 7 Dimensions)
  let potentialBrandBenefitHtml = '';
  const pbb = result.potentialBrandBenefit || {};
  const benefitDimensions = [
    { label: 'Potential Reach', val: pbb.potentialReach, icon: '🚀' },
    { label: 'Audience Relevance', val: pbb.audienceRelevance, icon: '🎯' },
    { label: 'Awareness Potential', val: pbb.awarenessPotential, icon: '📣' },
    { label: 'Engagement Potential', val: pbb.engagementPotential, icon: '💬' },
    { label: 'Purchase-Intent Potential', val: pbb.purchaseIntentPotential, icon: '🛍️' },
    { label: 'Content Value & Creative Reuse', val: pbb.contentValue, icon: '🎨' },
    { label: 'Long-Term Creator Value', val: pbb.longTermCreatorValue, icon: '🤝' }
  ];

  const benefitCardsHtml = benefitDimensions.map(dim => {
    return `
      <div class="brand-benefit-card">
        <div class="benefit-card-top">
          <span class="benefit-card-icon">${dim.icon}</span>
          <span class="benefit-card-title">${escapeHtml(dim.label)}</span>
        </div>
        <p class="benefit-card-val">${escapeHtml(cleanModelText(dim.val || 'Unknown / Requires Verification'))}</p>
      </div>
    `;
  }).join('');

  potentialBrandBenefitHtml = `
    <div class="result-section brand-benefits-section">
      <div class="section-header">
        <div class="header-with-badge">
          <h3 class="section-title">Potential Brand Benefit</h3>
          <span class="badge-tag badge-tag-purple">AI Projections & Estimates</span>
        </div>
        <span class="section-subtitle">Estimated campaign upside across 7 dimensions · Projections, not guaranteed outcomes</span>
      </div>
      <div class="brand-benefits-grid">
        ${benefitCardsHtml}
      </div>
      <div class="brand-benefit-disclaimer-banner">
        <span>⚠️ Estimates and projections are generated by AI based on submitted creator claims. They do not constitute guaranteed commercial results.</span>
      </div>
    </div>
  `;

  // 4. Audience Fit Section (evidence-backed scores)
  let audienceFitHtml = '';
  const af = result.audienceFit || {};
  const afDimensions = [
    { label: 'Niche Alignment', data: af.nicheRelevance, icon: '🎯' },
    { label: 'Audience Relevance', data: af.audienceRelevance, icon: '👥' },
    { label: 'Geography Fit', data: af.geographyFit, icon: '🌍' },
    { label: 'Demographics Fit', data: af.demographicsFit, icon: '📊' },
    { label: 'Interests & Topics', data: af.interestsAlignment, icon: '💡' },
    { label: 'Customer Relevance (ICP)', data: af.customerRelevance, icon: '🛍️' }
  ];

  const afCards = afDimensions.map(dim => {
    let scoreVal = dim.data?.score || 'Unknown / Requires Verification';
    const isUnverified = /unverified|n\/a|unknown|requires verification/i.test(scoreVal);
    if (isUnverified) {
      scoreVal = 'Unknown / Requires Verification';
    }
    const scoreClass = isUnverified ? 'score-unverified' : 'score-verified';
    const assessment = dim.data?.assessment || (isUnverified ? 'No verified evidence provided — requires verification' : '');

    return `
      <div class="audience-fit-card ${scoreClass}">
        <div class="fit-card-top">
          <span class="fit-card-title">${dim.icon} ${escapeHtml(dim.label)}</span>
          <span class="fit-score-badge ${scoreClass}">${escapeHtml(scoreVal)}</span>
        </div>
        ${assessment ? `<p class="fit-card-desc">${escapeHtml(cleanModelText(assessment))}</p>` : ''}
      </div>
    `;
  }).join('');

  audienceFitHtml = `
    <div class="result-section brand-audience-fit-section">
      <div class="section-header">
        <div class="header-with-badge">
          <h3 class="section-title">Audience Fit Analysis</h3>
          ${af.overallScore ? `<span class="badge-tag badge-tag-purple">Overall Fit: ${escapeHtml(af.overallScore)}</span>` : ''}
        </div>
        <span class="section-subtitle">Only scoring what available evidence supports — unverified dimensions flagged</span>
      </div>
      <div class="audience-fit-grid">
        ${afCards}
      </div>
    </div>
  `;

  // 5. Creator Quality Assessment (8 Dimensions)
  let qualityHtml = '';
  const cq = result.creatorQuality || {};
  const cqFactors = Array.isArray(cq.factors) ? cq.factors : [];
  if (cqFactors.length > 0) {
    const factorsListHtml = cqFactors.map(f => {
      const isReviewRequired = /verification required|unverified|needs review/i.test(f.status);
      const isStrong = /strong|high|positive/i.test(f.status);
      const statusClass = isStrong ? 'quality-strong' : (isReviewRequired ? 'quality-review' : 'quality-moderate');
      const statusIcon = isStrong ? '✓' : (isReviewRequired ? '🔍' : '•');

      return `
        <div class="quality-factor-card ${statusClass}">
          <div class="quality-factor-top">
            <strong class="quality-factor-name">${escapeHtml(f.factor)}</strong>
            <span class="quality-status-pill ${statusClass}">${statusIcon} ${escapeHtml(f.status)}</span>
          </div>
          ${f.detail ? `<p class="quality-factor-detail">${escapeHtml(cleanModelText(f.detail))}</p>` : ''}
        </div>
      `;
    }).join('');

    qualityHtml = `
      <div class="result-section brand-quality-section">
        <div class="section-header">
          <div class="header-with-badge">
            <h3 class="section-title">Creator Quality & Consistency</h3>
            <span class="badge-tag badge-tag-blue">${cqFactors.length} Dimensions</span>
          </div>
          <span class="section-subtitle">Evaluated on consistency, engagement & brand suitability · Zero negative assumptions without proof</span>
        </div>
        <div class="quality-factors-grid">
          ${factorsListHtml}
        </div>
      </div>
    `;
  }

  // 6. Claims vs Evidence Section
  let claimsHtml = '';
  const cve = result.claimsVsEvidence || {};
  const evQuality = cve.evidenceQuality || 'Partial';
  const evBadgeClass = {
    'Verified': 'ev-badge-verified',
    'Partial': 'ev-badge-partial',
    'Unverified / Self-Claimed': 'ev-badge-unverified'
  }[evQuality] || 'ev-badge-partial';

  const claimsList = Array.isArray(cve.creatorClaims) ? cve.creatorClaims : [];
  const evidenceList = Array.isArray(cve.verifiedEvidence) ? cve.verifiedEvidence : [];
  const missingList = Array.isArray(cve.missingForVerification) ? cve.missingForVerification : [];

  claimsHtml = `
    <div class="result-section brand-claims-section">
      <div class="section-header">
        <div class="header-with-badge">
          <h3 class="section-title">Claims vs. Evidence</h3>
          <span class="evidence-quality-badge ${evBadgeClass}">Evidence Quality: ${escapeHtml(evQuality)}</span>
        </div>
        <span class="section-subtitle">${escapeHtml(cleanModelText(cve.evidenceExplanation || 'Separating creator self-reported statements from verified metrics'))}</span>
      </div>

      <div class="claims-evidence-trio">
        <div class="claims-col claims-col-says">
          <div class="claims-col-header">
            <span class="claims-col-icon">🗣️</span>
            <h4>What Creator Says</h4>
          </div>
          <ul class="claims-col-list">
            ${claimsList.map(c => `<li>${escapeHtml(cleanModelText(c))}</li>`).join('') || '<li class="text-muted">No explicit claims extracted</li>'}
          </ul>
        </div>

        <div class="claims-col claims-col-provided">
          <div class="claims-col-header">
            <span class="claims-col-icon">📊</span>
            <h4>Evidence Provided</h4>
          </div>
          <ul class="claims-col-list">
            ${evidenceList.map(e => `<li>${escapeHtml(cleanModelText(e))}</li>`).join('') || '<li class="text-muted">No concrete verification proof attached</li>'}
          </ul>
        </div>

        <div class="claims-col claims-col-missing">
          <div class="claims-col-header">
            <span class="claims-col-icon">🔍</span>
            <h4>Missing for Verification</h4>
          </div>
          <ul class="claims-col-list">
            ${missingList.map(m => `<li>${escapeHtml(cleanModelText(m))}</li>`).join('') || '<li class="text-muted">All claims verified with proof</li>'}
          </ul>
        </div>
      </div>
    </div>
  `;

  // 7. Missing Information & Questions to Ask Creator
  let missingAndQuestionsHtml = '';
  const missingInfo = Array.isArray(result.missingInformation) ? result.missingInformation : [];
  const questions = Array.isArray(result.questionsToAskCreator) ? result.questionsToAskCreator : [];

  const missingChipsHtml = missingInfo.map(item => `
    <div class="missing-info-chip">
      <span class="missing-chip-icon">❓</span>
      <span>${escapeHtml(cleanModelText(item))}</span>
    </div>
  `).join('');

  const questionsListHtml = questions.map((q, idx) => `
    <div class="creator-question-card">
      <div class="question-number">Q${idx + 1}</div>
      <div class="question-body">
        <p class="question-text">${escapeHtml(cleanModelText(q))}</p>
        <button type="button" class="btn-copy-small btn-copy-question" data-copy="${escapeAttr(cleanModelText(q))}">
          Copy Question
        </button>
      </div>
    </div>
  `).join('');

  missingAndQuestionsHtml = `
    <div class="result-section brand-questions-section">
      <div class="section-header">
        <div class="header-with-badge">
          <h3 class="section-title">Missing Information & Questions to Ask</h3>
          <span class="badge-tag badge-tag-amber">${questions.length} Questions</span>
        </div>
        <span class="section-subtitle">Copy-paste these direct questions to the creator to verify metrics before signing</span>
      </div>

      ${missingChipsHtml ? `
        <div class="missing-items-wrapper">
          <span class="missing-items-label">Information Still Needed by Brand:</span>
          <div class="missing-chips-container">
            ${missingChipsHtml}
          </div>
        </div>
      ` : ''}

      <div class="creator-questions-list">
        ${questionsListHtml}
      </div>
    </div>
  `;

  // 8. Reasons & Key Takeaways
  const reasonsHtml = (result.reasons || []).map(r => `
    <li class="reason-item">
      <span class="reason-bullet">•</span>
      <span>${escapeHtml(cleanModelText(r))}</span>
    </li>
  `).join('');

  // 9. Commercial Alignment Card (if present)
  let commercialHtml = '';
  if (result.commercialAlignment && typeof result.commercialAlignment === 'object') {
    const ca = result.commercialAlignment;
    commercialHtml = `
      <div class="result-section brand-commercial-section">
        <div class="section-header">
          <h3 class="section-title">Commercial & Campaign Feasibility</h3>
          <span class="section-subtitle">Deliverables, timeline, and rate alignment with brand budget</span>
        </div>
        <div class="brand-commercial-grid">
          ${ca.budgetStatus ? `<div class="commercial-item"><span class="comm-label">Budget Fit:</span><strong class="comm-val">${escapeHtml(ca.budgetStatus)}</strong></div>` : ''}
          ${ca.deliverablesFit ? `<div class="commercial-item"><span class="comm-label">Deliverables:</span><span class="comm-val">${escapeHtml(cleanModelText(ca.deliverablesFit))}</span></div>` : ''}
          ${ca.timelineFit ? `<div class="commercial-item"><span class="comm-label">Timeline:</span><span class="comm-val">${escapeHtml(cleanModelText(ca.timelineFit))}</span></div>` : ''}
          ${ca.rightsAndExclusivity ? `<div class="commercial-item"><span class="comm-label">Rights & Exclusivity:</span><span class="comm-val">${escapeHtml(cleanModelText(ca.rightsAndExclusivity))}</span></div>` : ''}
        </div>
      </div>
    `;
  }

  // 10. Share / Copy Summary
  const cleanPitch = (originalPitch || '').trim().replace(/\s+/g, ' ');
  const pitchPreview = cleanPitch.length > 200 ? cleanPitch.substring(0, 197).trim() + '...' : cleanPitch;
  const reasonsSummary = (result.reasons || []).slice(0, 3).map(r => `• ${cleanModelText(r)}`).join('\n');
  const summaryText = `🏢 Creator Evaluation: ${recommendation}\n💰 Pricing: ${pricingAssessment} (${statedPrice})\n👤 Creator Pitch / Submission:\n"${pitchPreview}"\n\n💡 Key Findings:\n${reasonsSummary}\n\nEvaluated with Creator Fit (Brand Mode)`;

  const shareSummaryHtml = `
    <div class="result-section share-summary-section">
      <div class="share-summary-inner">
        <span class="share-summary-hint">Take action on this evaluation</span>
        <div class="action-buttons-group">
          <button class="btn-copy-small btn-copy-summary" data-copy="${escapeAttr(summaryText)}">
            📋 Copy Evaluation Summary
          </button>
        </div>
      </div>
    </div>
  `;

  // 11. Raw Debug Section
  const rawSection = result.rawResponse ? `
    <details class="debug-raw-response">
      <summary>View Raw AI Response</summary>
      <pre><code>${escapeHtml(result.rawResponse)}</code></pre>
    </details>
  ` : '';

  // Render combined card
  container.innerHTML = `
    <div class="result-card brand-result-card">
      ${recHeroHtml}

      ${reasonsHtml ? `
        <div class="result-section brand-reasons-card">
          <h4 class="brand-reasons-title">Key Strategic Findings</h4>
          <ul class="reasons-list">${reasonsHtml}</ul>
        </div>
      ` : ''}

      ${costVsValueHtml}
      ${potentialBrandBenefitHtml}
      ${audienceFitHtml}
      ${qualityHtml}
      ${claimsHtml}
      ${missingAndQuestionsHtml}
      ${commercialHtml}
      ${shareSummaryHtml}
      ${rawSection}
    </div>
  `;
  container.classList.add('visible');

  // Bind copy buttons
  bindCopyButtons(container);

  // Play audio and update mascot
  if (typeof playVerdictSound === 'function') playVerdictSound(result.verdict);
  if (typeof setMascotState === 'function') setMascotState(result.verdict);

  // Trigger verdict micro-animation
  requestAnimationFrame(() => {
    triggerVerdictAnimation(result.verdict, container);
  });
}

// ============================================
// Brand Mode: Display Multi-Creator Comparison Table & Trade-offs
// ============================================

function displayBrandCompareResult(result, container) {
  if (!result || !container) return;

  const rows = Array.isArray(result.comparisonTable) ? result.comparisonTable : [];

  const recBadgeClass = (rec) => {
    switch (rec) {
      case 'Strongly Consider': return 'badge-tag-emerald';
      case 'Consider': return 'badge-tag-cyan';
      case 'Request More Information': return 'badge-tag-blue';
      case 'Negotiate': return 'badge-tag-purple';
      case 'Low Priority': return 'badge-tag-slate';
      case 'Reject': return 'badge-tag-rose';
      default: return 'badge-tag-purple';
    }
  };

  const costPillClass = (assessment) => {
    switch (assessment) {
      case 'Strong Value': return 'pricing-pill-strong-value';
      case 'Potentially Fair': return 'pricing-pill-fair';
      case 'Expensive': return 'pricing-pill-expensive';
      default: return 'pricing-pill-unspecified';
    }
  };

  const rowsHtml = rows.map((r, i) => `
    <tr class="brand-compare-row">
      <td class="col-creator-name">
        <div class="creator-name-cell">
          <span class="creator-num-badge">#${i + 1}</span>
          <strong>${escapeHtml(r.creatorName)}</strong>
        </div>
      </td>
      <td class="col-audience-fit">
        <span class="cell-text">${escapeHtml(r.audienceFit)}</span>
      </td>
      <td class="col-engagement">
        <span class="cell-text">${escapeHtml(r.engagement)}</span>
      </td>
      <td class="col-cost">
        <div class="cell-cost-box">
          <span class="cost-amount">${escapeHtml(r.cost)}</span>
          <span class="pricing-assessment-pill ${costPillClass(r.costAssessment)}">${escapeHtml(r.costAssessment)}</span>
        </div>
      </td>
      <td class="col-campaign-fit">
        <span class="cell-text">${escapeHtml(r.campaignFit)}</span>
      </td>
      <td class="col-rec">
        <span class="badge-tag ${recBadgeClass(r.recommendation)}">${escapeHtml(r.recommendation)}</span>
      </td>
    </tr>
    <tr class="brand-compare-subrow">
      <td colspan="6">
        <div class="creator-tradeoff-pills">
          <span class="pill-strength"><strong>✓ Strength:</strong> ${escapeHtml(r.keyStrength)}</span>
          <span class="pill-risk"><strong>⚠️ Trade-off / Risk:</strong> ${escapeHtml(r.keyRisk)}</span>
        </div>
      </td>
    </tr>
  `).join('');

  const nextStepsHtml = (result.nextSteps || []).map(step => `
    <li class="compare-step-item">
      <span class="compare-step-check">✓</span>
      <span>${escapeHtml(cleanModelText(step))}</span>
    </li>
  `).join('');

  const summaryText = `👥 Creator Comparison Summary:\n` +
    rows.map((r, i) => `#${i + 1} ${r.creatorName}: ${r.recommendation} (Audience Fit: ${r.audienceFit} | Cost: ${r.cost} - ${r.costAssessment})`).join('\n') +
    `\n\n⚖️ Strategic Trade-offs:\n${result.tradeoffAnalysis}\n\n⚠️ ${result.disclaimer}`;

  container.innerHTML = `
    <div class="result-card brand-compare-result-card">
      <div class="compare-result-header">
        <div class="header-with-badge">
          <h3 class="compare-result-title">👥 Side-by-Side Creator Evaluation</h3>
          <span class="badge-tag badge-tag-purple">${rows.length} Creators Compared</span>
        </div>
        <button type="button" class="btn-copy-small btn-copy-summary" data-copy="${escapeAttr(summaryText)}">
          📋 Copy Comparison Summary
        </button>
      </div>

      <!-- Comparison Table -->
      <div class="brand-compare-table-wrapper">
        <table class="brand-compare-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Audience Fit</th>
              <th>Engagement</th>
              <th>Cost & Value</th>
              <th>Campaign Fit</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Trade-off Analysis Box -->
      <div class="brand-compare-tradeoffs-box">
        <div class="section-header">
          <h4 class="section-title">⚖️ Strategic Trade-off Analysis</h4>
          <span class="section-subtitle">Multi-factor comparative trade-offs without single-metric bias</span>
        </div>
        <p class="tradeoff-analysis-text">${escapeHtml(result.tradeoffAnalysis)}</p>
      </div>

      <!-- Actionable Next Steps -->
      ${nextStepsHtml ? `
        <div class="brand-compare-steps-box">
          <h4 class="compare-steps-title">📋 Recommended Brand Action Plan</h4>
          <ul class="compare-steps-list">
            ${nextStepsHtml}
          </ul>
        </div>
      ` : ''}

      <!-- AI Disclaimer Banner -->
      <div class="brand-compare-disclaimer-banner">
        <span class="disclaimer-icon">ℹ️</span>
        <span class="disclaimer-text"><strong>AI Strategic Analysis:</strong> ${escapeHtml(result.disclaimer)}</span>
      </div>
    </div>
  `;

  container.classList.add('visible');
  bindCopyButtons(container);
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
  const tk = toolkit || {};

  const whatToNegotiate = tk.whatToNegotiate || (isBad
    ? 'Require guaranteed upfront monetary payment and eliminate unpaid deliverable demands.'
    : 'Clarify exact deliverable scope, usage rights license duration, and payment timeline.');

  const why = tk.why || (isBad
    ? 'Unpaid deliverables or perpetual rights exploit your production time without fair compensation.'
    : 'Clear scope boundaries and explicit payment terms prevent scope creep and secure your revenue floor.');

  const targetNumberOrCondition = tk.targetNumberOrCondition || (isBad
    ? 'Propose standard minimum rate floor or decline uncompensated work.'
    : 'Propose fixed fee with 30-day organic usage rights and 1 revision round limit.');

  const advice = tk.advice || (isBad
    ? 'This pitch has major red flags. Politely decline or demand clear upfront compensation and terms before doing any work.'
    : 'Clarify payment terms, timeline, and exact scope of deliverables before committing.');

  const writtenReply = tk.writtenReply || (isBad
    ? `Hi there,\n\nThank you for reaching out. At this time, I only accept collaboration opportunities that include guaranteed monetary compensation and clearly defined deliverable scopes. I will have to pass on this particular project, but feel free to reach out in the future with paid opportunities.\n\nBest regards,`
    : `Hi there,\n\nThank you for reaching out! I would be interested in discussing this collaboration further. Before we proceed, could you please provide details on the compensation budget, the exact deliverables expected, and the usage rights timeline?\n\nLooking forward to hearing from you,\n[Your Name]`);

  const talkingPoints = (tk.talkingPoints && tk.talkingPoints.length > 0)
    ? tk.talkingPoints
    : [
      'Ask for written clarification on payment and compensation terms before committing to next steps.',
      'Clarify the exact scope of deliverables (number of posts, formats, and due dates).',
      'State your standard rate card or minimum baseline for brand collaborations.',
      'Ensure usage rights and ad whitelisting timelines are clearly defined and compensated.'
    ];

  return {
    whatToNegotiate,
    why,
    targetNumberOrCondition,
    advice,
    writtenReply,
    talkingPoints
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

function getRecIcon(rec) {
  if (!rec) return '💡';
  const r = rec.toLowerCase();
  if (r.includes('strong')) return '🌟';
  if (r.includes('negotiat')) return '🤝';
  if (r.includes('decline')) return '🛑';
  return '💡';
}
