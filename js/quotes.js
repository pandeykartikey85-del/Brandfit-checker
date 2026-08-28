// ============================================
// Daily Rotating Quotes
// 25 quotes about deal-making, creator
// independence, and good judgment.
// Selected by day-of-year — same quote all day,
// changes at midnight automatically.
// ============================================

const DAILY_QUOTES = [
  "Know your worth, then add tax.",
  "A good deal leaves both sides smiling.",
  "Free exposure doesn't pay rent.",
  "The best partnerships are built on clarity, not charm.",
  "If the brief is vague, the red flags are vivid.",
  "Your audience trusts you. Protect that above all.",
  "No contract is better than a bad contract.",
  "Silence on payment is never an oversight.",
  "The right brand will respect your boundaries.",
  "Creativity has value. Never let anyone forget that.",
  "Read the fine print like your reputation depends on it — because it does.",
  "A brand that values you will show it in writing.",
  "Exclusivity without premium pay is just a cage.",
  "Trust your gut, but verify with the contract.",
  "Great collaborations start with great communication.",
  "Your platform is your business. Treat every deal like one.",
  "If they can't define deliverables, they can't define success.",
  "The word 'opportunity' without numbers is just noise.",
  "Negotiate like you plan to stay in this industry for decades.",
  "Alignment beats reach. Every single time.",
  "A pitch that respects your time will respect your terms.",
  "Don't trade long-term trust for short-term cash.",
  "Clear payment terms are the minimum, not the bonus.",
  "Your niche is your power. Choose partners who see that.",
  "When in doubt, walk away. The right deals will find you."
];

function getDailyQuote() {
  return DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
}

// ============================================
// Creator Deal Tips (for loading state)
// 14 actionable tips cycling every 2 seconds
// during the AI evaluation wait state.
// ============================================

const CREATOR_TIPS = [
  'Tip: An offer of only "exposure" with no payment is one of the most common red flags in creator pitches.',
  'Tip: Usage rights and payment timeline are just as important as the fee itself.',
  'Tip: Always define the revision scope in writing — "reasonable edits" can turn into unlimited reshoots.',
  'Tip: Exclusivity clauses should always command a significant rate multiplier or strict time limits.',
  'Tip: Net-30 or Net-60 payment terms are standard, but upfront deposits protect your production costs.',
  'Tip: Perpetual whitelisting or ad-usage rights should never be bundled into standard post rates for free.',
  'Tip: If a brand demands immediate posting without a written agreement, ask for a signed brief first.',
  'Tip: Don\'t negotiate against yourself — state your rate with confidence and let the brand respond.',
  'Tip: Creative control ensures brand messaging feels authentic to your audience and converts better.',
  'Tip: Competitor non-compete clauses should be restricted to specific direct rivals, not entire industries.',
  'Tip: Separate organic posting rates from paid amplification and paid advertising usage rights.',
  'Tip: A clear brief with agreed deliverables and due dates prevents scope creep before filming begins.',
  'Tip: When a brand claims they have "zero budget", suggest reduced deliverables rather than free labor.',
  'Tip: Track performance metrics on past campaigns to justify higher rates on future brand deals.'
];

// ============================================
// Creator Playbook Tips
// 25 evergreen tips about negotiation, red
// flags, and audience growth. 3 random tips
// displayed per visit.
// ============================================

const CREATOR_PLAYBOOK_TIPS = [
  { category: 'Negotiation', tip: 'Always counter-offer. The first number a brand gives is rarely their ceiling — it\'s their floor.' },
  { category: 'Red Flags', tip: 'If a brand says "we\'ll discuss payment after you deliver," that\'s not a partnership — it\'s free labor with a maybe attached.' },
  { category: 'Contracts', tip: 'Never sign a contract that grants "perpetual, irrevocable, worldwide" usage rights without a separate licensing fee.' },
  { category: 'Negotiation', tip: 'Anchor high. Present your premium rate first, then offer a trimmed deliverable package as the "budget option" — don\'t start at your minimum.' },
  { category: 'Red Flags', tip: 'Watch for phrases like "quick turnaround" or "easy content" — they almost always underestimate your actual production time and effort.' },
  { category: 'Growth', tip: 'Document every brand deal outcome (views, clicks, engagement) in a personal case study deck — it\'s your most powerful rate negotiation tool.' },
  { category: 'Contracts', tip: 'Exclusivity should always be time-limited (30-90 days max) and come with a premium — never agree to open-ended non-competes.' },
  { category: 'Negotiation', tip: 'When a brand says "we have no budget," suggest a reduced scope (1 Story instead of 3 posts) instead of dropping your rate to zero.' },
  { category: 'Red Flags', tip: 'Brands that pressure you with artificial deadlines ("offer expires in 24 hours") are using urgency to prevent you from reading the fine print.' },
  { category: 'Growth', tip: 'Niche down before you scale up. Brands pay premium rates for focused audiences, not broad ones — a 10K niche audience beats a 100K general one.' },
  { category: 'Contracts', tip: 'Always clarify revision limits in writing. "Reasonable revisions" without a number cap can mean unlimited reshoots at your expense.' },
  { category: 'Negotiation', tip: 'Separate your content creation fee from usage rights. Organic posting and paid ad amplification are two different things at two different price points.' },
  { category: 'Red Flags', tip: 'If a brand won\'t put payment terms in writing before you start work, they\'re not a real business partner — they\'re a risk.' },
  { category: 'Growth', tip: 'Repurpose every brand collaboration into portfolio content — behind-the-scenes posts, case study threads, or "how I shot this" breakdowns grow your authority.' },
  { category: 'Contracts', tip: 'Check if the contract allows the brand to sublicense your content to third parties — this is a common hidden clause that expands usage far beyond the original deal.' },
  { category: 'Negotiation', tip: 'Ask for a kill fee clause: if the brand cancels the project after you\'ve started, you should be compensated for work already done.' },
  { category: 'Red Flags', tip: 'A "collab" that requires you to purchase the product yourself and only offers affiliate commission is not a sponsorship — it\'s a sales job.' },
  { category: 'Growth', tip: 'Build a simple one-page media kit with your demographics, engagement rates, past brand logos, and starting rates — it saves time and signals professionalism.' },
  { category: 'Contracts', tip: 'Moral rights waivers let brands alter your content without permission. Only agree to this if the compensation reflects the creative control you\'re giving up.' },
  { category: 'Negotiation', tip: 'When asked "what\'s your rate?", ask the brand\'s budget first. Their answer tells you the playing field before you put a number on the table.' },
  { category: 'Red Flags', tip: 'If a brand insists on "payment upon publication" with no advance, push for at least 50% upfront — legitimate companies have media budgets allocated in advance.' },
  { category: 'Growth', tip: 'Consistent posting schedule matters more than viral hits. Brands look for creators who show up reliably, not ones who peaked once and disappeared.' },
  { category: 'Contracts', tip: 'Indemnification clauses can make YOU personally liable for legal issues with the brand\'s product claims — flag these for legal review every time.' },
  { category: 'Negotiation', tip: 'Don\'t negotiate over DMs. Move to email for a paper trail — it protects you if the brand changes terms or denies agreements later.' },
  { category: 'Growth', tip: 'Your audience\'s trust is your most valuable asset. Every deal that feels inauthentic erodes it slightly — but those small erosions compound over time.' }
];

function getRandomPlaybookTips(count = 3) {
  const shuffled = [...CREATOR_PLAYBOOK_TIPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
