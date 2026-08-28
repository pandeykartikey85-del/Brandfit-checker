// ============================================
// Side Margin Decorative Illustrations
// Generates 8-10 ambient geometric line-art SVGs
// and randomly selects 4 per visit (2 left, 2 right)
// for desktop viewports.
// ============================================

const SIDE_ILLUSTRATIONS = [
  // 1. Handshake (Deal Agreement)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <circle cx="45" cy="45" r="40" stroke="#8B5CF6" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.3"/>
    <path d="M22 42l12-12a4 4 0 0 1 5.6 0l5.4 5.4a4 4 0 0 0 5.6 0L56 30a4 4 0 0 1 5.6 0l6.4 6.4" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M28 48l10 10a4 4 0 0 0 5.6 0l4.4-4.4a4 4 0 0 1 5.6 0l6.4 6.4" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M38 38l14 14" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <circle cx="45" cy="45" r="3" fill="#8B5CF6" opacity="0.6"/>
  </svg>`,

  // 2. Shield & Checkmark (Contract Protection)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <path d="M45 15L22 25v18c0 17 9.8 30.5 23 35c13.2-4.5 23-18 23-35V25L45 15z" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M35 44l7 7 15-15" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="45" cy="45" r="34" stroke="#8B5CF6" stroke-width="1" stroke-dasharray="4 4" opacity="0.4"/>
  </svg>`,

  // 3. Document & Signature (Deal Terms)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <rect x="25" y="16" width="40" height="56" rx="6" stroke="#8B5CF6" stroke-width="1.75"/>
    <path d="M33 30h24M33 38h18M33 46h24M33 54h14" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <circle cx="56" cy="56" r="7" stroke="#8B5CF6" stroke-width="1.5"/>
    <path d="M53 56l2 2 4-4" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 4. Growth Chart & Metric (Creator Reach)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <path d="M20 70h50" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M24 64v-12M36 64V44M48 64V34M60 64V24" stroke="#8B5CF6" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
    <path d="M24 50l12-10 12 6 18-20M66 26v-6h-6" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="48" cy="46" r="3" fill="#8B5CF6"/>
  </svg>`,

  // 5. Star Rating Badge (Creator Reputation)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <circle cx="45" cy="45" r="36" stroke="#8B5CF6" stroke-width="1.5" opacity="0.3"/>
    <path d="M45 22l6.5 13.5 14.5 2-10.5 10 2.5 14.5L45 55l-13 7 2.5-14.5-10.5-10 14.5-2L45 22z" stroke="#8B5CF6" stroke-width="1.75" stroke-linejoin="round"/>
    <circle cx="45" cy="45" r="8" stroke="#8B5CF6" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
  </svg>`,

  // 6. Balance Scales (Fair Value)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <path d="M45 20v48M30 68h30" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M22 28h46M45 20l-4-6h8l-4 6" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 28l-8 16h16l-8-16zM68 28l-8 16h16l-8-16z" stroke="#8B5CF6" stroke-width="1.5" stroke-linejoin="round" opacity="0.6"/>
    <circle cx="45" cy="20" r="3" fill="#8B5CF6"/>
  </svg>`,

  // 7. Target & Bullseye (Niche Alignment)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <circle cx="45" cy="45" r="34" stroke="#8B5CF6" stroke-width="1.5" opacity="0.3"/>
    <circle cx="45" cy="45" r="22" stroke="#8B5CF6" stroke-width="1.75"/>
    <circle cx="45" cy="45" r="10" stroke="#8B5CF6" stroke-width="1.5" opacity="0.6"/>
    <circle cx="45" cy="45" r="3" fill="#8B5CF6"/>
    <path d="M45 15v8M45 67v8M15 45h8M67 45h8" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // 8. Creative Spark / Lightbulb (Authenticity)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <path d="M34 48c-4-4-6-10-6-16a17 17 0 0 1 34 0c0 6-2 12-6 16v8H34v-8z" stroke="#8B5CF6" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M38 64h14M41 70h8" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M45 14v-6M20 25l-5-4M70 25l5-4M14 45h-6M82 45h-6" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
    <circle cx="45" cy="32" r="6" stroke="#8B5CF6" stroke-width="1" stroke-dasharray="2 2" opacity="0.6"/>
  </svg>`,

  // 9. Security Lock (Rights Safety)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <rect x="25" y="38" width="40" height="32" rx="6" stroke="#8B5CF6" stroke-width="1.75"/>
    <path d="M33 38V28a12 12 0 0 1 24 0v10" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round"/>
    <circle cx="45" cy="52" r="4" fill="#8B5CF6" opacity="0.6"/>
    <path d="M45 56v6" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round"/>
    <circle cx="45" cy="45" r="38" stroke="#8B5CF6" stroke-width="1" stroke-dasharray="4 4" opacity="0.25"/>
  </svg>`,

  // 10. Dialogue & Negotiation (Brand Chat)
  `<svg class="decor-svg" width="88" height="88" viewBox="0 0 90 90" fill="none">
    <path d="M22 28a6 6 0 0 1 6-6h34a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H38l-10 8v-8h-0a6 6 0 0 1-6-6V28z" stroke="#8B5CF6" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M34 38h22M34 44h14" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <circle cx="62" cy="58" r="10" stroke="#8B5CF6" stroke-width="1.5" opacity="0.5"/>
    <path d="M59 58h6" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  </svg>`
];

function initSideDecorations() {
  const leftContainer = document.getElementById('side-decorations-left');
  const rightContainer = document.getElementById('side-decorations-right');

  if (!leftContainer || !rightContainer) return;

  // Shuffle array copy
  const shuffled = [...SIDE_ILLUSTRATIONS].sort(() => Math.random() - 0.5);

  // Pick 2 for left, 2 for right
  const leftItems = shuffled.slice(0, 2);
  const rightItems = shuffled.slice(2, 4);

  leftContainer.innerHTML = leftItems.map((svgHtml, idx) => `
    <div class="side-decor-item side-decor-left-${idx + 1}">${svgHtml}</div>
  `).join('');

  rightContainer.innerHTML = rightItems.map((svgHtml, idx) => `
    <div class="side-decor-item side-decor-right-${idx + 1}">${svgHtml}</div>
  `).join('');
}
