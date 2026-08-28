// ============================================
// Sound Feedback System (Web Audio API)
// Provides subtle, soft audio cues for actions
// and verdict results. 100% synthetic, lightweight,
// and skippable with a header mute toggle.
// ============================================

let audioCtx = null;
let isSoundMuted = false;

function initAudio() {
  // Read mute preference from localStorage (default: unmuted)
  isSoundMuted = localStorage.getItem('bf_sound_muted') === 'true';

  const toggleBtn = document.getElementById('sound-toggle');
  if (toggleBtn) {
    updateSoundToggleUI(toggleBtn);
    toggleBtn.addEventListener('click', toggleSound);
  }
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function toggleSound() {
  isSoundMuted = !isSoundMuted;
  localStorage.setItem('bf_sound_muted', isSoundMuted ? 'true' : 'false');
  
  const toggleBtn = document.getElementById('sound-toggle');
  if (toggleBtn) {
    updateSoundToggleUI(toggleBtn);
  }

  // Play a brief confirmation click if unmuting
  if (!isSoundMuted) {
    playClickSound();
  }
}

function updateSoundToggleUI(btn) {
  if (isSoundMuted) {
    btn.classList.add('muted');
    btn.setAttribute('aria-label', 'Unmute sound effects');
    btn.setAttribute('title', 'Sound effects muted (click to unmute)');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    `;
  } else {
    btn.classList.remove('muted');
    btn.setAttribute('aria-label', 'Mute sound effects');
    btn.setAttribute('title', 'Sound effects enabled (click to mute)');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    `;
  }
}

// 1. Button Press / Action Trigger (soft click chime)
function playClickSound() {
  if (isSoundMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // Gracefully ignore audio errors (e.g. user gesture policy)
  }
}

// 2. Verdict Result Loaded
function playVerdictSound(verdict) {
  if (isSoundMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (verdict === 'Good Fit') {
      // Ascending two-tone melodic chime
      playTone(ctx, 587.33, 0.0, 0.16, 0.1, 'sine'); // D5
      playTone(ctx, 880.00, 0.08, 0.28, 0.12, 'sine'); // A5
    } else if (verdict === 'Risky') {
      // Warm neutral chime
      playTone(ctx, 440.00, 0.0, 0.14, 0.08, 'sine'); // A4
      playTone(ctx, 493.88, 0.07, 0.22, 0.09, 'sine'); // B4
    } else if (verdict === 'Bad Fit') {
      // Soft low descending tone
      playTone(ctx, 329.63, 0.0, 0.14, 0.08, 'sine'); // E4
      playTone(ctx, 261.63, 0.07, 0.22, 0.08, 'sine'); // C4
    }
  } catch (e) {
    // Ignore audio error
  }
}

function playTone(ctx, freq, delay, duration, volume, type = 'sine') {
  const startTime = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}
