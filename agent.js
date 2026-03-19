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

// ─── PHASE 1: DEEP NICHE RESEARCH ─────────────────────────────────────────────
async function researchNiche(persona, apiKey, onStatus) {
  onStatus('Researching current best practices for: ' + persona.niche + '...');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const system = `You are a senior short-form video content strategist who has analysed thousands of viral TikTok and Instagram Reels accounts across every niche. You have direct, current knowledge of what separates content that gets 10k views from content that gets 10M views.

Today is ${today}.

Your analysis must be SPECIFIC and ACTIONABLE — not generic best practices but actual patterns that are working RIGHT NOW in the specific niche you are given. Every insight you provide must be something a creator could act on immediately to make better-performing content.`;

  const user = `Conduct a deep, current content strategy analysis for this niche and client.

NICHE: ${persona.niche}

ICP PROFILE:
${persona.icpDoc || '(Infer from niche — describe the exact person this content is for)'}

OFFER / SERVICES:
${persona.offerDoc || '(Infer from niche — what problem is being solved)'}

Analyse the following dimensions deeply and specifically:

1. WHAT IS WORKING RIGHT NOW (top 6–8 topic categories getting real traction in this niche on TikTok/Reels at this moment — be specific, not generic)

2. HOOK STRUCTURES THAT STOP THE SCROLL (4–6 proven hook patterns with specific language examples — the exact opening moves that are getting clicks right now in this niche)

3. CONTENT FORMATS DOMINATING THIS NICHE (4–6 specific formats with explanation of why they outperform — include format mechanics, not just names)

4. PAIN POINTS BEING ACTIVELY VOICED (6–8 frustrations, fears, or failures the ICP is searching, commenting, and creating content about right now — specific language they use)

5. CONTENT ANGLES THAT POSITION THE OFFER (4–6 angles that create genuine demand for the service without sounding like an ad)

6. WHAT IS OVERSATURATED / WHAT TO AVOID (3–4 content types or topics that are overdone and will underperform — what top creators have moved away from)

7. PLATFORM-SPECIFIC SIGNALS (what is the TikTok algorithm rewarding right now for this niche vs Instagram Reels — specific signals, completion triggers, format preferences)

8. CONTENT GAPS AND OPPORTUNITIES (2–3 underserved angles that the ICP wants but isn't getting — these become differentiated content)

9. WEEKLY STRATEGY SUMMARY (2–3 sentences: what is the single most important strategic direction for this week's content based on all the above)

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
async function generateBatch(platform, count, batchIndex, totalBatches, persona, research, apiKey) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const platformLabel = platform === 'tiktok' ? 'TikTok' : 'Instagram Reels';

  // Distribute content types across batches
  const typeDistribution = buildTypeDistribution(count);

  // Tell subsequent batches to use different topics to avoid repetition
  const batchNote = totalBatches > 1
    ? `\nIMPORTANT: This is batch ${batchIndex + 1} of ${totalBatches} for ${platformLabel}. Use DIFFERENT topics and formats from earlier batches — no repeated angles.`
    : '';

  const system = `You are an elite short-form video scriptwriter specialised in ${persona.niche} for ${platformLabel}.

STRICT LENGTH RULE: Every script body must be exactly 110–140 words. Count carefully.
At a natural energetic pace (3 words per second), 110–140 words = 37–47 seconds — safely under 60 seconds.

VOICE RULES:
- Hook lands in the FIRST word or first phrase — not "In this video" or "Hey guys"
- Write exactly what is spoken — no emojis, no bullet symbols, no markdown, no stage directions
- Zero filler openers: never start with "So", "Today", "Welcome", "I wanted to", "In this video"
- Every script is complete and standalone — full value delivered in under 50 seconds
- CTAs are earned and natural, never salesy
- Use the client's exact tone and vocabulary — not generic creator speak

CONTENT QUALITY:
- Every script must be 100% grounded in the current best practices and content patterns for this niche
- Scripts should feel like they come from the most credible, authoritative voice in this niche
- Deliver one clear, memorable idea per script — no rambling, no padding`;

  const user = `Generate ${count} ${platformLabel} scripts for ${persona.name || 'this client'}. Week of ${today}.${batchNote}

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
- Formats to use (vary them): Problem-Solution, Contrarian Take, Unfiltered Rant, Step-by-Step Walkthrough, 3 Mistakes List, Authority Callout, Quiet Flex / Calm Authority, Transformation Before-After, Hot Take, Pattern Interrupt
- Each script needs TWO hook variants (hookA and hookB) — different angles, same body
- Script body: EXACTLY 110–140 words. Count every word before finalising.
- No two scripts should share the same topic or format

Return ONLY a JSON array of exactly ${count} objects. No markdown, no preamble:
[
  {
    "platform": "${platform}",
    "topic": "specific topic, 5–10 words",
    "type": "Value" | "Education" | "Entertainment" | "Soft Sell",
    "format": "exact format name from the list above",
    "hookA": "first hook — the full opening line exactly as spoken",
    "hookB": "second hook — different opening angle, same body",
    "script": "full script body, EXACTLY 110–140 words, natural spoken language",
    "ctaA": "primary CTA as spoken (1 sentence)",
    "ctaB": "secondary / softer CTA as spoken (1 sentence)"
  }
]`;

  const raw = await callClaude(system, user, apiKey);
  return extractJson(raw);
}

// ─── HELPER: TYPE DISTRIBUTION ─────────────────────────────────────────────────
function buildTypeDistribution(count) {
  const softSell    = Math.max(1, Math.round(count * 0.15));
  const value       = Math.round(count * 0.37);
  const education   = Math.round(count * 0.25);
  const entertainment = Math.max(0, count - value - education - softSell);
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
  const research = await researchNiche(persona, apiKey, onStatus);
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
        persona, research, apiKey,
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
