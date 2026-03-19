/**
 * agent.js
 * Claude API integration — deep research phase + batched script generation.
 *
 * Script target: 110–140 words = ~37–47 seconds at a natural energetic pace (3 words/sec).
 */

const CLAUDE_API   = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const BATCH_SIZE   = 10;   // max scripts per API call

// Weekday labels used for day assignment
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── LOW-LEVEL API CALL ────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, apiKey) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const e = await res.json(); msg = e?.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data.content[0].text;
}

// Strip markdown fences and parse JSON from Claude's response
function extractJson(raw) {
  let clean = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  return JSON.parse(clean);
}

// ─── FUNNEL STAGE DEFINITIONS ─────────────────────────────────────────────────
const FUNNEL_CONFIG = {
  tof: {
    label: 'Top of Funnel (Awareness)',
    researchFocus: `You are researching AWARENESS-stage content. The goal is to reach COLD audiences who do not know this creator yet.
Focus on:
- Content that travels outside existing followers (high shareability, relatable broad appeal)
- Pattern-interrupts, curiosity hooks, and entertainment-first formats
- Topics that speak to the problem, not the solution
- Zero selling — value and entertainment only
- Content that makes strangers stop scrolling and follow`,
    scriptFocus: `FUNNEL STAGE: TOP OF FUNNEL (Awareness)
AUDIENCE: Cold — they do not know this creator. Reach new viewers.
OBJECTIVE: Stop the scroll, create a follow, build brand awareness.
TONE: Relatable, entertaining, curiosity-driven. Zero selling.
CTA STYLE: Soft — "follow for more", "save this", "share with someone who needs this", "comment X if you agree"
FORBIDDEN: Pricing, offers, "DM me", "apply now", service pitches, urgency tactics
TYPE DISTRIBUTION PRIORITY: Value and Entertainment heavy — make it shareable`,
    typeWeights: { value: 0.40, entertainment: 0.35, education: 0.20, softSell: 0.05 },
    formats: 'Pattern Interrupt, Contrarian Take, Hot Take, Unfiltered Rant, Transformation Before-After, Relatable Story, Trending Format',
  },
  mof: {
    label: 'Mid Funnel (Consideration)',
    researchFocus: `You are researching CONSIDERATION-stage content. The goal is to deepen trust with warm audiences who already know this creator.
Focus on:
- Authority-building content that demonstrates deep expertise
- Education-heavy formats that go one level deeper than TOF content
- Myth-busting, case studies, frameworks, step-by-step breakdowns
- Light social proof woven naturally into value-driven content
- Content that makes viewers think "this person really knows their stuff"`,
    scriptFocus: `FUNNEL STAGE: MID FUNNEL (Consideration)
AUDIENCE: Warm — they follow or have seen this creator before. Deepen trust.
OBJECTIVE: Build authority, demonstrate expertise, move viewers toward a decision.
TONE: Confident expert, educational, slightly more direct. Light social proof allowed.
CTA STYLE: Medium — "comment below", "DM me [word]", "link in bio for more", "save this framework"
ALLOWED: Mentioning results (yours or clients'), frameworks, case studies. No hard pitches.
TYPE DISTRIBUTION PRIORITY: Education and Value heavy — establish authority`,
    typeWeights: { value: 0.30, entertainment: 0.15, education: 0.40, softSell: 0.15 },
    formats: 'Step-by-Step Walkthrough, 3 Mistakes List, Authority Callout, Quiet Flex / Calm Authority, Problem-Solution, Contrarian Take, Case Study',
  },
  bof: {
    label: 'Bottom of Funnel (Conversion)',
    researchFocus: `You are researching CONVERSION-stage content. The goal is to turn warm, ready-to-buy audiences into paying clients.
Focus on:
- Direct response content — clear offer, clear CTA, clear outcome
- Testimonials, before/after transformations, objection-handling
- Urgency, scarcity, social proof, results
- Content that speaks to product-aware people who just need the final nudge
- Formats that prompt direct action: DM, apply, book a call, buy`,
    scriptFocus: `FUNNEL STAGE: BOTTOM OF FUNNEL (Conversion)
AUDIENCE: Hot — warm followers ready to buy. Convert them.
OBJECTIVE: Drive direct action — DM, apply, book a call, purchase.
TONE: Direct, confident, results-focused. Create urgency. Speak to the buyer.
CTA STYLE: Direct — "DM me [word]", "link in bio — book your call", "apply now — limited spots", "comment [word] for details"
REQUIRED: Clear outcome stated, social proof or results referenced, specific offer implied or named.
TYPE DISTRIBUTION PRIORITY: Soft Sell and Value mix — move people to act`,
    typeWeights: { value: 0.25, entertainment: 0.05, education: 0.20, softSell: 0.50 },
    formats: 'Soft Sell, Transformation Before-After, Authority Callout, Quiet Flex / Calm Authority, Problem-Solution, Testimonial Story, Objection Handling, Offer Reveal',
  },
};

// ─── PHASE 1: DEEP NICHE RESEARCH ─────────────────────────────────────────────
async function researchNiche(persona, config, apiKey, onStatus) {
  onStatus('Researching current best practices for: ' + persona.niche + '...');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const funnel    = config.funnel || 'tof';
  const fCfg      = FUNNEL_CONFIG[funnel];
  const language  = persona.language || 'English';
  const langNote  = language !== 'English'
    ? `\n\nLANGUAGE: Write all content values, examples, hook lines, pain points, and topic descriptions in ${language}. JSON keys must remain in English.`
    : '';

  const system = `You are a senior short-form video content strategist who has analysed thousands of viral TikTok and Instagram Reels accounts across every niche. You have direct, current knowledge of what separates content that gets 10k views from content that gets 10M views.

Today is ${today}.

Your analysis must be SPECIFIC and ACTIONABLE — not generic best practices but actual patterns that are working RIGHT NOW in the specific niche you are given. Every insight you provide must be something a creator could act on immediately to make better-performing content.

FUNNEL STAGE CONTEXT:
${fCfg.researchFocus}${langNote}`;

  const user = `Conduct a deep, current content strategy analysis for this niche and client.

NICHE: ${persona.niche}
FUNNEL STAGE: ${fCfg.label}

ICP PROFILE:
${persona.icpDoc || '(Infer from niche — describe the exact person this content is for)'}

OFFER / SERVICES:
${persona.offerDoc || '(Infer from niche — what problem is being solved)'}

Analyse the following dimensions deeply and specifically, always through the lens of the ${fCfg.label} stage:

1. WHAT IS WORKING RIGHT NOW (top 6–8 topic categories getting real traction in this niche on TikTok/Reels at this moment for ${fCfg.label} content — be specific, not generic)

2. HOOK STRUCTURES THAT STOP THE SCROLL (4–6 proven hook patterns for ${fCfg.label} — with specific language examples that match this funnel stage's audience awareness level)

3. CONTENT FORMATS DOMINATING THIS NICHE (4–6 specific formats that work for ${fCfg.label} content — include format mechanics and why they work at this funnel stage)

4. PAIN POINTS BEING ACTIVELY VOICED (6–8 frustrations, fears, or desires that are relevant at the ${fCfg.label} stage — specific ICP language)

5. CONTENT ANGLES THAT MATCH THIS FUNNEL STAGE (4–6 angles that are appropriate for ${fCfg.label} — the right level of selling, authority, or awareness content)

6. WHAT IS OVERSATURATED / WHAT TO AVOID (3–4 content types or topics that are overdone and will underperform at this funnel stage)

7. PLATFORM-SPECIFIC SIGNALS (what is the TikTok algorithm rewarding right now for this niche vs Instagram Reels — specific signals, completion triggers, format preferences)

8. CONTENT GAPS AND OPPORTUNITIES (2–3 underserved angles that the ICP wants but isn't getting — these become differentiated content)

9. WEEKLY STRATEGY SUMMARY (2–3 sentences: the most important strategic direction for this week's ${fCfg.label} content based on all the above)

Return ONLY a JSON object. No markdown, no preamble, no extra keys:
{
  "trendingTopics": ["specific topic 1", "specific topic 2", ...],
  "hookStructures": [
    { "pattern": "hook pattern name", "example": "full example opening line as spoken", "why": "why this stops scroll" }
  ],
  "bestFormats": [
    { "name": "format name", "mechanics": "how this format actually works step by step", "why": "why it outperforms" }
  ],
  "painPoints": ["specific pain point with the language the ICP uses", ...],
  "contentAngles": ["angle 1", "angle 2", ...],
  "avoid": ["what to avoid 1", ...],
  "platformInsights": {
    "tiktok": ["specific signal or behaviour", ...],
    "instagram": ["specific signal or behaviour", ...]
  },
  "contentGaps": ["underserved angle 1", ...],
  "summary": "2–3 sentence strategic direction for this week"
}`;

  const raw = await callClaude(system, user, apiKey);
  return extractJson(raw);
}

// ─── PHASE 2: BATCH SCRIPT GENERATION ─────────────────────────────────────────
/**
 * Generate one batch of scripts for a single platform.
 *
 * @param {string} platform    - 'tiktok' or 'instagram'
 * @param {number} count       - number of scripts in this batch
 * @param {number} batchIndex  - 0-based batch index (used to vary topics)
 * @param {number} totalBatches- total batches for this platform
 * @param {Object} persona
 * @param {Object} research
 * @param {string} apiKey
 */
async function generateBatch(platform, count, batchIndex, totalBatches, persona, config, research, apiKey) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const platformLabel = platform === 'tiktok' ? 'TikTok' : 'Instagram Reels';
  const language      = persona.language || 'English';
  const funnel        = config.funnel || 'tof';
  const fCfg          = FUNNEL_CONFIG[funnel];

  // Distribute content types based on funnel stage
  const typeDistribution = buildTypeDistribution(count, funnel);

  // Tell subsequent batches to use different topics to avoid repetition
  const batchNote = totalBatches > 1
    ? `\nIMPORTANT: This is batch ${batchIndex + 1} of ${totalBatches} for ${platformLabel}. Use DIFFERENT topics and formats from earlier batches — no repeated angles.`
    : '';

  const langInstruction = language !== 'English'
    ? `\n\nLANGUAGE: Generate ALL content — scripts, hooks, outlines, on-screen text, carousel copy, and CTAs — in ${language}. Do not use English in any generated content field.`
    : '';

  const system = `You are an elite short-form video scriptwriter and content strategist specialised in ${persona.niche} for ${platformLabel}.${langInstruction}

${fCfg.scriptFocus}

For each script you generate FOUR content formats from the same core idea:
1. Full video script (spoken word)
2. Outline (talking-point bullets for improvising)
3. On-screen text overlays (what appears as text during the video)
4. Carousel copy (repurposed as swipeable slides)

STRICT SCRIPT LENGTH: Every "script" field must be exactly 110–140 words. Count every word.
At 3 words/sec energetic pace = 37–47 seconds. Never exceed 140 words in the script field.

VOICE RULES (applies to script field):
- Hook lands in the FIRST word or first phrase — not "In this video" or "Hey guys"
- Write exactly what is spoken — no emojis, no bullets, no markdown, no stage directions
- Zero filler openers: never start with "So", "Today", "Welcome", "I wanted to"
- Every script is complete and standalone — full value in under 50 seconds
- CTAs are earned and natural, never salesy
- Match the client's exact tone and vocabulary

CONTENT QUALITY:
- 100% grounded in current best practices and content patterns for this niche
- Deliver one clear, memorable idea per script — no rambling, no padding`;

  const user = `Generate ${count} ${platformLabel} ${fCfg.label} scripts for ${persona.name || 'this client'}. Week of ${today}.${batchNote}

CLIENT: ${persona.name || 'Client'}
NICHE: ${persona.niche}

ICP PROFILE:
${persona.icpDoc || 'Focus on the target audience typical for this niche.'}

OFFER / SERVICES:
${persona.offerDoc || 'Focus on helping the ICP solve their core problem.'}

TONE OF VOICE:
${persona.toneDoc || 'Direct, no-fluff, confident not arrogant. Speaks to practitioners not beginners. No buzzwords.'}

━━━ CURRENT RESEARCH INTELLIGENCE ━━━
TRENDING TOPICS RIGHT NOW:
${research.trendingTopics?.join('\n')}

HIGH-PERFORMING HOOK STRUCTURES:
${research.hookStructures?.map(h => `• ${h.pattern}: "${h.example}"`).join('\n')}

BEST-PERFORMING FORMATS:
${research.bestFormats?.map(f => `• ${f.name}: ${f.mechanics}`).join('\n')}

KEY PAIN POINTS (ICP language):
${research.painPoints?.join('\n')}

CONTENT ANGLES:
${research.contentAngles?.join('\n')}

CONTENT GAPS (underserved — opportunity):
${research.contentGaps?.join('\n')}

${platformLabel.toUpperCase()} PLATFORM SIGNALS:
${(platform === 'tiktok' ? research.platformInsights?.tiktok : research.platformInsights?.instagram)?.join('\n')}

WHAT TO AVOID:
${research.avoid?.join('\n')}

STRATEGY THIS WEEK: ${research.summary}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT REQUIREMENTS:
- Platform: ${platformLabel} ONLY
- Count: exactly ${count} scripts
- Type distribution: ${typeDistribution.join(', ')}
- Formats to use (vary them, prioritise funnel-appropriate ones): ${fCfg.formats}
- Each script needs TWO hook variants (hookA and hookB) — different angles, same body
- Script body: EXACTLY 110–140 words. Count every word before finalising.
- No two scripts should share the same topic or format

Return ONLY a JSON array of exactly ${count} objects. No markdown, no preamble, no extra keys:
[
  {
    "platform": "${platform}",
    "topic": "specific topic, 5–10 words",
    "type": "Value" | "Education" | "Entertainment" | "Soft Sell",
    "format": "exact format name from the list above",
    "hookA": "first hook — full opening line exactly as spoken",
    "hookB": "second hook — different opening angle, same script body",
    "script": "EXACTLY 110–140 words of natural spoken language — count every word",
    "outline": [
      "Talking point 1 — the opening claim/hook idea (phrase, not sentence)",
      "Talking point 2 — first supporting argument or example",
      "Talking point 3 — second supporting point or contrast",
      "Talking point 4 — the payoff or insight",
      "Talking point 5 — transition to CTA"
    ],
    "screenText": [
      "Opening: bold 2–5 word hook text that appears in first 2 seconds",
      "Mid: short punchy claim or stat (shown mid-video)",
      "Mid: another key line from the script (2–5 words)",
      "Close: CTA text shown at end"
    ],
    "carousel": {
      "cover": "Bold cover headline, 5–8 words maximum",
      "slides": [
        { "headline": "Slide 1 headline (short)", "body": "1–2 sentences of value — can be read in 5 seconds" },
        { "headline": "Slide 2 headline", "body": "..." },
        { "headline": "Slide 3 headline", "body": "..." },
        { "headline": "Slide 4 headline", "body": "..." },
        { "headline": "Slide 5 headline", "body": "..." }
      ],
      "cta": "Final slide CTA text — what to do next (1 sentence)"
    },
    "ctaA": "primary CTA as spoken (1 sentence)",
    "ctaB": "secondary / softer CTA as spoken (1 sentence)"
  }
]`;

  const raw = await callClaude(system, user, apiKey);
  return extractJson(raw);
}

// ─── HELPER: TYPE DISTRIBUTION ─────────────────────────────────────────────────
function buildTypeDistribution(count, funnel) {
  const weights = FUNNEL_CONFIG[funnel || 'tof']?.typeWeights || {
    value: 0.37, entertainment: 0.23, education: 0.25, softSell: 0.15,
  };

  const softSell      = Math.max(funnel === 'bof' ? 2 : 0, Math.round(count * weights.softSell));
  const entertainment = Math.max(funnel === 'tof' ? 1 : 0, Math.round(count * weights.entertainment));
  const education     = Math.round(count * weights.education);
  const value         = Math.max(1, count - softSell - entertainment - education);

  const dist = [];
  if (value > 0)         dist.push(`${value}x Value`);
  if (education > 0)     dist.push(`${education}x Education`);
  if (entertainment > 0) dist.push(`${entertainment}x Entertainment`);
  if (softSell > 0)      dist.push(`${softSell}x Soft Sell`);
  return dist;
}

// ─── DAY / SLOT ASSIGNMENT ────────────────────────────────────────────────────
/**
 * Assigns day and slot to each script.
 * Scripts are organized as 3 per platform per day.
 *
 * @param {Array}  scripts   - flat array, already split by platform
 * @param {number} days      - number of posting days
 * @returns the same array, mutated with .day and .slot
 */
function assignDaysAndSlots(scripts, days) {
  const dayNames = WEEK_DAYS.slice(0, days);

  // Group by platform
  const byPlatform = {};
  scripts.forEach(s => {
    if (!byPlatform[s.platform]) byPlatform[s.platform] = [];
    byPlatform[s.platform].push(s);
  });

  // Each platform: 3 scripts per day, rotating through dayNames
  Object.values(byPlatform).forEach(platformScripts => {
    platformScripts.forEach((s, i) => {
      s.day  = dayNames[Math.floor(i / 3) % dayNames.length];
      s.slot = (i % 3) + 1;
    });
  });

  return scripts;
}

// ─── MAIN AGENT RUNNER ────────────────────────────────────────────────────────
/**
 * Run the full content agent: research + batched generation per platform.
 *
 * @param {Object}   persona     - Persona object
 * @param {Object}   config      - { platforms: string[], days: number }
 * @param {string}   apiKey
 * @param {Function} onStatus    - status string callback
 * @param {Function} onResearch  - called with research JSON after phase 1
 * @param {Function} onProgress  - called with (completedBatches, totalBatches)
 *
 * @returns {{ research, scripts }}
 */
async function runContentAgent(persona, config, apiKey, onStatus, onResearch, onProgress) {
  const { platforms, days } = config;
  const scriptsPerPlatform  = 3 * days;

  // ── Phase 1: Research ───────────────────────────────────────────────────────
  const research = await researchNiche(persona, config, apiKey, onStatus);
  if (onResearch) onResearch(research);

  // ── Phase 2: Generate per platform, in batches ──────────────────────────────
  const allScripts  = [];
  let completedBatches = 0;

  // Pre-compute total batch count for progress tracking
  const totalBatches = platforms.reduce((sum, _) => {
    return sum + Math.ceil(scriptsPerPlatform / BATCH_SIZE);
  }, 0);

  for (const platform of platforms) {
    const platformLabel = platform === 'tiktok' ? 'TikTok' : 'Instagram';
    const numBatches    = Math.ceil(scriptsPerPlatform / BATCH_SIZE);

    for (let b = 0; b < numBatches; b++) {
      const remaining = scriptsPerPlatform - b * BATCH_SIZE;
      const batchCount = Math.min(BATCH_SIZE, remaining);
      const batchNum   = b + 1;

      onStatus(
        `Generating ${platformLabel} scripts — batch ${batchNum}/${numBatches} (${batchCount} scripts)...`
      );

      const scripts = await generateBatch(
        platform, batchCount, b, numBatches,
        persona, config, research, apiKey,
      );

      allScripts.push(...scripts);
      completedBatches++;
      if (onProgress) onProgress(completedBatches, totalBatches);
    }
  }

  // ── Assign days and slots ────────────────────────────────────────────────────
  onStatus('Organising weekly schedule...');
  assignDaysAndSlots(allScripts, days);

  onStatus('Saving to library...');
  return { research, scripts: allScripts };
}
