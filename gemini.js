// ============================================
// Gemini API Integration
// Routes AI evaluation and analysis requests
// through the secure serverless /api/gemini endpoint.
// Gemini API key is stored strictly on the server.
// ============================================

async function callServerGemini(prompt, generationConfig = {}, model = 'gemini-3.6-flash') {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      generationConfig: {
        temperature: generationConfig.temperature ?? 0.2,
        maxOutputTokens: generationConfig.maxOutputTokens ?? 2048,
        responseMimeType: generationConfig.responseMimeType ?? 'application/json'
      },
      model
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errorMsg = errData.error || `AI service error (${response.status}): ${response.statusText}`;
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const rawText = data.text || data.rawText || data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('No response received from AI service. Please try again.');
  }

  return rawText;
}

async function evaluatePitch(pitchText, profileText, personalRules) {
  // Build the personal rules section (if any)
  let rulesSection = '';
  if (personalRules && personalRules.trim()) {
    rulesSection = `

IMPORTANT — PERSONAL DEALBREAKER RULES:
The creator has set these personal rules. Check the pitch against EACH rule FIRST, before applying the general criteria. If any rule is violated, mention it explicitly in your reasoning with the specific rule text and the part of the pitch that violates it (or the absence of information that makes it impossible to confirm compliance).

Creator's personal rules:
${personalRules.trim()}

---
`;
  }

  const prompt = `You are evaluating a brand collaboration pitch for a content creator. Base your evaluation ONLY on the text provided — do not assume any information about the brand's reputation, history, or intentions beyond what is written.
${rulesSection}
CREATOR'S PROFILE:
${profileText}

BRAND'S PITCH:
${pitchText}

LANGUAGE & CURRENCY INSTRUCTIONS:
- Respond in the SAME language that the pitch was written in (e.g. if the pitch is in Spanish, French, German, Hindi, Portuguese, Japanese, etc., write the reasons, toolkit advice, written reply, questions, and explanations in that language). The JSON keys and the "verdict" string value ("Good Fit", "Risky", "Bad Fit") must remain in English.
- Correctly interpret ANY currency symbol or code mentioned (e.g. $, €, £, ₹, ¥, ₩, CAD, AUD, AED, etc.) without assuming INR or any single currency by default.

Evaluate using these criteria:
(1) Is payment or compensation clearly mentioned?
(2) Are there exclusivity or restrictive clauses?
(3) Does the pitch align with the creator's stated niche?
(4) Are there vague or red-flag phrases (e.g. "great exposure" instead of payment, unclear deliverables)?

If the pitch does not contain enough information to judge a criterion, say so explicitly instead of guessing.

Follow these EXACT rules when deciding the verdict:
- "Bad Fit" = use ONLY when there are 2 or more of these problems: no payment mentioned, vague/missing deliverables, restrictive exclusivity clauses, or clearly unrealistic demands.
- "Risky" = use when exactly ONE of those problems exists, OR when niche alignment is weak but everything else (payment, deliverables, exclusivity) is clear and fair.
- "Good Fit" = use when payment is clear, deliverables are clear, no exclusivity issues, AND niche aligns well.
- A pitch with clear payment, clear deliverables, and no exclusivity issues should NEVER be "Bad Fit" even if the niche doesn't match — niche mismatch alone is a business judgment call, at most "Risky".

MANDATORY SECTIONS TO INCLUDE IN YOUR JSON RESPONSE:

1. "highlight_phrases": Array of exact, verbatim substrings from the BRAND'S PITCH that triggered your reasons, red flags, or pressure tactics (e.g. "LIMITED TIME", "dream collaborator", "great exposure", "expires tonight").

2. "manipulation_tactics": Array of psychological pressure tactics detected in the pitch. Check carefully for:
   - Artificial Urgency / Deadlines (e.g. "LIMITED TIME", "expires tonight", "reply within 24h", "urgent")
   - Excessive Flattery / Love-bombing (e.g. "dream collaborator", "dream creator", "huge fan", "perfect match")
   - Guilt-tripping / Obligation (e.g. "thought you'd be excited", "don't let us down", "rare opportunity")
   - Artificial Scarcity / FOMO (e.g. "only 1 spot left", "exclusive invite", "hand-picked")
   For each tactic found, provide:
   { "tactic": "Name of tactic", "quote": "exact phrase from pitch", "explanation": "Why this is a pressure tactic" }
   If none are found, return [].

3. "missing_info_questions": If any criterion lacked information (compensation, scope, timeline, usage rights), provide 2-3 specific follow-up questions to ask the brand. If nothing is missing, return [].

4. "toolkit": For ANY pitch (especially "Risky" or "Bad Fit"), provide actionable guidance:
   - "advice": Specific negotiation or pushback guidance based on the failed criteria.
   - "written_reply": A complete, polished ready-to-send reply (counteroffer, clarification request, or polite decline).
   - "talking_points": 3-4 confident spoken points for phone/video calls.

You must respond in valid JSON matching this exact structure:
{
  "verdict": "Good Fit",
  "reasons": [
    "Reason 1 referencing or quoting specific text from the pitch",
    "Reason 2 referencing or quoting specific text from the pitch"
  ],
  "highlight_phrases": [
    "exact phrase 1 from pitch",
    "exact phrase 2 from pitch"
  ],
  "manipulation_tactics": [
    {
      "tactic": "Artificial Urgency",
      "quote": "LIMITED TIME offer expiring tonight",
      "explanation": "Manufactures time pressure to rush you into agreeing before reviewing terms."
    }
  ],
  "missing_info_questions": [
    "What is the designated monetary budget for this campaign?"
  ],
  "toolkit": {
    "advice": "Negotiate explicit payment terms and request a formal contract before producing any deliverables.",
    "written_reply": "Hi [Name],\\n\\nThank you for reaching out...",
    "talking_points": [
      "Ask for compensation details before agreeing to next steps.",
      "Clarify exact deliverable scope and turnaround times."
    ]
  }
}

Note: The "verdict" string MUST be exactly one of: "Good Fit", "Risky", or "Bad Fit". Provide 2 to 3 concise bullet points in "reasons".`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Raw Response:\n', rawText);
  return parseGeminiResponse(rawText);
}

function parseGeminiResponse(rawText) {
  let cleaned = (rawText || '').trim();

  // Strip XML/HTML style thought blocks (e.g. <thought>...</thought>)
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Attempt 1: Direct or substring JSON parse
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // If direct parse fails, try extracting between first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonSubstring);
      } catch (innerErr) {
        console.warn('Substring JSON parse failed:', innerErr);
      }
    }
  }

  // If JSON parse succeeded, extract and normalize verdict & fields
  if (parsed && typeof parsed === 'object') {
    const verdict = extractVerdict(parsed.verdict || parsed.Verdict || parsed.decision || parsed.fit || '');
    const reasons = extractReasons(parsed.reasons || parsed.Reasons || parsed.reasoning || parsed.points || parsed.details);
    const highlightPhrases = extractStringArray(parsed.highlight_phrases || parsed.highlights || parsed.red_flags || parsed.phrases);
    const missingInfoQuestions = extractStringArray(parsed.missing_info_questions || parsed.follow_up_questions || parsed.questions);
    const manipulationTactics = extractManipulationTactics(parsed.manipulation_tactics || parsed.pressure_tactics || parsed.tactics);
    const toolkit = extractToolkit(parsed.toolkit || parsed.response_toolkit || parsed);

    if (reasons.length > 0) {
      return {
        verdict,
        reasons: reasons.slice(0, 3),
        highlightPhrases,
        missingInfoQuestions,
        manipulationTactics,
        toolkit,
        rawResponse: rawText
      };
    }
  }

  // Attempt 2: Robust regex fallback parser
  console.warn('Falling back to regex text extraction for response:', rawText);
  return fallbackParse(rawText);
}

function extractVerdict(verdictStr) {
  if (typeof verdictStr !== 'string') verdictStr = String(verdictStr || '');
  const lower = verdictStr.toLowerCase().trim();

  if (lower.includes('good')) return 'Good Fit';
  if (lower.includes('bad')) return 'Bad Fit';
  if (lower.includes('risk')) return 'Risky';
  return 'Risky';
}

function cleanModelText(text) {
  if (typeof text !== 'string') return String(text || '');
  let cleaned = text.trim();
  // Strip leaked internal prompt/instruction markers and headers
  cleaned = cleaned.replace(/^\*{0,2}(?:final\s+polish|structure\s+strictly\s+matching\s+input|internal\s+instruction|system\s+note|formatting\s+note|translation\s+note|note)\*{0,2}\s*[:\-–—]\s*/i, '');
  cleaned = cleaned.replace(/\n+\*{0,2}(?:final\s+polish|structure\s+strictly\s+matching\s+input|internal\s+instruction|system\s+note|formatting\s+note)\*{0,2}.*$/i, '');
  cleaned = cleaned.replace(/\*{0,2}final\s+polish\*{0,2}/gi, '');
  cleaned = cleaned.replace(/structure\s+strictly\s+matching\s+input/gi, '');
  return cleaned.trim();
}

function extractReasons(reasonsVal) {
  if (Array.isArray(reasonsVal)) {
    return reasonsVal.map(item => {
      let str = '';
      if (typeof item === 'string') str = item.trim();
      else if (item && typeof item === 'object') {
        str = item.text || item.reason || item.point || item.description || Object.values(item).join(' - ');
      } else {
        str = String(item);
      }
      return cleanModelText(str);
    }).filter(Boolean);
  }

  if (typeof reasonsVal === 'string' && reasonsVal.trim()) {
    return reasonsVal.split('\n')
      .map(l => cleanModelText(l.replace(/^[\s\-•*\d.)]+/, '')))
      .filter(Boolean);
  }

  return [];
}

function extractStringArray(val) {
  if (Array.isArray(val)) {
    return val.map(item => {
      let str = '';
      if (typeof item === 'string') str = item.trim();
      else if (item && typeof item === 'object') {
        str = item.question || item.phrase || item.text || Object.values(item).join(' ');
      } else {
        str = String(item).trim();
      }
      return cleanModelText(str);
    }).filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return val.split('\n')
      .map(l => cleanModelText(l.replace(/^[\s\-•*\d.)]+/, '')))
      .filter(Boolean);
  }
  return [];
}

function extractManipulationTactics(val) {
  if (!Array.isArray(val)) return [];

  return val.map(item => {
    if (!item) return null;
    if (typeof item === 'string') {
      return {
        tactic: 'Pressure Tactic',
        quote: cleanModelText(item),
        explanation: 'Uses psychological pressure to influence decision-making.'
      };
    }
    if (typeof item === 'object') {
      const tactic = item.tactic || item.name || item.type || 'Pressure Tactic';
      const quote = item.quote || item.phrase || item.text || '';
      const explanation = item.explanation || item.reason || item.description || '';
      if (!quote && !explanation) return null;
      return {
        tactic: cleanModelText(String(tactic)),
        quote: cleanModelText(String(quote)),
        explanation: cleanModelText(String(explanation))
      };
    }
    return null;
  }).filter(Boolean);
}

function extractToolkit(val) {
  if (!val || typeof val !== 'object') return null;

  const rawAdvice = typeof val.advice === 'string'
    ? val.advice.trim()
    : (typeof val.Advice === 'string' ? val.Advice.trim() : '');
  const advice = cleanModelText(rawAdvice);

  const rawReply = typeof (val.written_reply || val.writtenReply || val.reply || val.WrittenReply || val.message || val.reply_message) === 'string'
    ? (val.written_reply || val.writtenReply || val.reply || val.WrittenReply || val.message || val.reply_message).trim()
    : '';
  const writtenReply = cleanModelText(rawReply);

  const talkingPoints = extractStringArray(val.talking_points || val.talkingPoints || val.points || val.TalkingPoints || val.talking_points_list);

  if (!advice && !writtenReply && talkingPoints.length === 0) {
    return null;
  }

  return {
    advice,
    writtenReply,
    talkingPoints
  };
}

function fallbackParse(text) {
  let verdict = 'Risky';
  const lower = text.toLowerCase();

  // Search for verdict in text
  const verdictMatch = text.match(/(?:verdict|fit|evaluation)["':\s]*["']?(Good Fit|Risky|Bad Fit|Good|Bad)/i);
  if (verdictMatch) {
    verdict = extractVerdict(verdictMatch[1]);
  } else if (lower.includes('good fit')) {
    verdict = 'Good Fit';
  } else if (lower.includes('bad fit')) {
    verdict = 'Bad Fit';
  }

  // Extract bullet points or numbered lines
  const lines = text.split('\n');
  let reasons = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line looks like a bullet point or numbered item
    if (/^[\-•*]\s+/.test(trimmed) || /^\d+[\.\)]\s+/.test(trimmed)) {
      const cleanReason = trimmed.replace(/^[\-•*\d.)]+\s*/, '').trim();
      // Skip if this line is just the verdict declaration
      if (!cleanReason.toLowerCase().startsWith('verdict:')) {
        reasons.push(cleanReason);
      }
    }
  }

  // If no bullet points found, extract quoted parts or substantive sentences
  if (reasons.length === 0) {
    const cleanLines = lines
      .map(l => l.trim())
      .filter(l => l.length > 20 && !l.startsWith('{') && !l.startsWith('}') && !l.startsWith('```'));
    reasons = cleanLines.slice(0, 3);
  }

  if (reasons.length === 0) {
    reasons.push('Evaluation completed. Review the full response details below.');
  }

  return {
    verdict,
    reasons: reasons.slice(0, 3),
    highlightPhrases: [],
    missingInfoQuestions: [],
    manipulationTactics: [],
    toolkit: null,
    rawResponse: text
  };
}

// ============================================
// Contract Fine-Print Translator
// Analyzes contract clauses and explains them
// in plain English for content creators.
// ============================================

async function explainContract(contractText) {
  const prompt = `You are an expert contract fine-print translator for content creators and influencers.
Analyze the following contract or agreement text. Identify any unusual, restrictive, notable, or creator-impacting clauses (e.g. perpetual usage rights, whitelisting/paid ad amplification, broad exclusivity, non-compete clauses, indemnification clauses, moral rights waivers, termination without pay, uncompensated revision demands).

CONTRACT TEXT:
${contractText}

For each notable clause identified, provide:
1. "quote": The exact clause or key sentence quoted directly from the contract text.
2. "title": A short title for the clause (e.g. "Perpetual Ad Whitelisting", "Broad Exclusivity", "Unlimited Revisions").
3. "meaning": A clear, plain-English explanation of what this clause means in practice for the creator.
4. "why_it_matters": Why this clause matters to the creator, what hidden risks it carries, and what to watch out for or negotiate.

Also provide a brief 1-2 sentence "summary" of the overall contract fairness from a creator perspective.

Respond in valid JSON matching this exact structure:
{
  "summary": "1-2 sentence overall summary of the contract clauses.",
  "clauses": [
    {
      "quote": "Exact contract clause quoted",
      "title": "Clause Title",
      "meaning": "Plain-English meaning in practice",
      "why_it_matters": "Why this matters to the creator"
    }
  ]
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Contract Raw Response:\n', rawText);
  return parseContractResponse(rawText);
}

function parseContractResponse(rawText) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for contract:', inner);
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const clausesRaw = Array.isArray(parsed.clauses) ? parsed.clauses : [];

    const clauses = clausesRaw.map(c => {
      if (!c || typeof c !== 'object') return null;
      return {
        quote: typeof c.quote === 'string' ? c.quote.trim() : '',
        title: typeof c.title === 'string' ? c.title.trim() : 'Contract Clause',
        meaning: typeof c.meaning === 'string' ? c.meaning.trim() : '',
        why_it_matters: typeof (c.why_it_matters || c.whyItMatters || c.importance) === 'string'
          ? (c.why_it_matters || c.whyItMatters || c.importance).trim()
          : ''
      };
    }).filter(c => c && (c.meaning || c.quote));

    return {
      summary,
      clauses,
      rawResponse: rawText
    };
  }

  // Fallback if parsing was not a structured JSON
  return {
    summary: 'Here is the plain-English breakdown of the contract clauses.',
    clauses: [
      {
        quote: 'Contract text provided',
        title: 'Overview',
        meaning: cleaned.substring(0, 300) + (cleaned.length > 300 ? '…' : ''),
        why_it_matters: 'Review these terms carefully before signing.'
      }
    ],
    rawResponse: rawText
  };
}

// ============================================
// Multi-Pitch Comparison
// Compares 2-3 saved pitches side-by-side,
// recommends which to prioritize, and details
// trade-offs (pay vs niche fit vs risk).
// ============================================

async function comparePitches(pitches) {
  const formattedList = pitches.map((p, idx) => `
--- PITCH #${idx + 1} ---
Original Pitch Text:
${p.pitch_text}

Creator Profile Used:
${p.profile_text || 'Standard profile'}

Previous Verdict: ${p.verdict}
Evaluation Reasons:
${p.reasoning}
`).join('\n');

  const prompt = `You are a creator business advisor comparing ${pitches.length} brand collaboration pitches for a content creator.
Compare these pitches directly, recommend which to prioritize, and explain the key trade-offs between them (compensation/pay vs. niche alignment vs. risk/exclusivity).

${formattedList}

Respond in valid JSON matching this exact structure:
{
  "recommendation": {
    "top_choice_index": 1,
    "top_choice_title": "Pitch #1",
    "rationale": "Clear 2-sentence explanation of why this pitch is the best option to prioritize over the others."
  },
  "tradeoffs": [
    {
      "pitch_index": 1,
      "preview": "Short 1-line preview of the pitch",
      "verdict": "Good Fit",
      "compensation": "Analysis of pay/compensation terms",
      "niche_fit": "Analysis of niche and audience alignment",
      "risk_level": "Analysis of exclusivity, deliverables, or hidden risks",
      "priority_rank": 1
    }
  ],
  "action_plan": "Specific advice on next steps (e.g. which to accept, what to negotiate on the second choice, which to decline)."
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Compare Raw Response:\n', rawText);
  return parseCompareResponse(rawText, pitches);
}

function parseCompareResponse(rawText, originalPitches) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for compare:', inner);
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    return {
      recommendation: parsed.recommendation || {
        top_choice_index: 1,
        top_choice_title: 'Pitch #1',
        rationale: 'Review the side-by-side trade-offs below to decide on your priority.'
      },
      tradeoffs: Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : [],
      actionPlan: parsed.action_plan || parsed.actionPlan || '',
      rawResponse: rawText
    };
  }

  // Fallback
  return {
    recommendation: {
      top_choice_index: 1,
      top_choice_title: 'Pitch #1',
      rationale: 'Comparison completed. Review the details below.'
    },
    tradeoffs: originalPitches.map((p, i) => ({
      pitch_index: i + 1,
      preview: p.pitch_text.substring(0, 60) + '…',
      verdict: p.verdict,
      compensation: 'Review compensation in evaluation reasoning.',
      niche_fit: 'Review niche alignment in evaluation reasoning.',
      risk_level: 'Review clauses in evaluation reasoning.',
      priority_rank: i + 1
    })),
    actionPlan: 'Prioritize pitches with clear compensation and well-defined deliverables.',
    rawResponse: rawText
  };
}

// ============================================
// Pattern Summary from History ("Your Patterns")
// Summarizes creator patterns using ONLY their
// own stored evaluation data (no invented stats).
// ============================================

async function generatePatternSummary(evaluations) {
  const goodFitCount = evaluations.filter(e => e.verdict === 'Good Fit').length;
  const riskyCount = evaluations.filter(e => e.verdict === 'Risky').length;
  const badFitCount = evaluations.filter(e => e.verdict === 'Bad Fit').length;

  const sampleSummaries = evaluations.slice(0, 15).map((e, idx) => {
    const preview = e.pitch_text.length > 100 ? e.pitch_text.substring(0, 100) + '…' : e.pitch_text;
    const reasoningSnippet = e.reasoning.split('\n').filter(r => r.trim()).slice(0, 2).join('; ');
    return `[#${idx + 1}] Verdict: ${e.verdict} | Pitch snippet: "${preview}" | Key reasoning: ${reasoningSnippet}`;
  }).join('\n');

  const prompt = `You are summarizing the past brand collaboration pitch evaluation history for a content creator.
Summarize REAL patterns using ONLY the creator's own stored evaluation data below.
STRICT RULES:
1. Do NOT invent statistics or numbers.
2. Do NOT assume anything outside the provided history.
3. Base your observations strictly on the actual counts (${evaluations.length} total: ${goodFitCount} Good Fit, ${riskyCount} Risky, ${badFitCount} Bad Fit) and the actual reasoning reasons given.

STORED EVALUATION DATA:
Total saved evaluations: ${evaluations.length}
Good Fit count: ${goodFitCount}
Risky count: ${riskyCount}
Bad Fit count: ${badFitCount}

Evaluations detail:
${sampleSummaries}

Provide 2 to 3 concise, factual bullet-point pattern observations about what kinds of deals they receive, why deals are flagged/rejected, and common factors in their Good Fit partnerships.

Respond in valid JSON matching this exact structure:
{
  "patterns": [
    "Factual observation 1 based on actual data",
    "Factual observation 2 based on actual data",
    "Factual observation 3 based on actual data"
  ]
}`;

  const rawText = await callServerGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json'
  });

  console.log('Gemini Patterns Raw Response:\n', rawText);
  return parsePatternResponse(rawText, goodFitCount, riskyCount, badFitCount, evaluations.length);
}

function parsePatternResponse(rawText, goodFitCount, riskyCount, badFitCount, totalCount) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (inner) {
        console.warn('Substring JSON parse failed for patterns:', inner);
      }
    }
  }

  if (parsed && Array.isArray(parsed.patterns) && parsed.patterns.length > 0) {
    return parsed.patterns.slice(0, 3);
  }

  // Factual deterministic fallback based strictly on counts
  const fallback = [];
  fallback.push(`You have evaluated ${totalCount} pitches so far (${goodFitCount} Good Fit, ${riskyCount} Risky, ${badFitCount} Bad Fit).`);
  if (badFitCount + riskyCount > 0) {
    fallback.push(`${badFitCount + riskyCount} out of ${totalCount} pitches had issues such as missing compensation, vague deliverables, or exclusivity terms.`);
  }
  if (goodFitCount > 0) {
    fallback.push(`${goodFitCount} pitch${goodFitCount === 1 ? '' : 'es'} met all criteria with clear pay and well-defined terms.`);
  }

  return fallback;
}

