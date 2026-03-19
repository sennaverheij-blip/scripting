/**
 * agent.js
 * Claude API integration — research phase + content generation phase.
 */

const CLAUDE_API   = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

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
    try {
      const err = await res.json();
      msg = err?.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ─── JSON EXTRACT ──────────────────────────────────────────────────────────────
// Strips markdown fences and parses JSON from Claude's response.
function extractJson(raw) {
  let clean = raw.trim();
  // Remove ```json ... ``` or ``` ... ``` fences
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(clean);
}

// ─── PHASE 1: NICHE RESEARCH ──────────────────────────────────────────────────
async function researchNiche(persona, apiKey, onStatus) {
  onStatus('Researching trends in: ' + persona.niche + '...');

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const system = `You are an expert social media content strategist and analyst who specialises in short-form video on TikTok and Instagram Reels. You have deep knowledge of what content formats, hooks, topics and angles drive real results across every niche.

Today's date: ${today}.

Your research is grounded in observable content patterns: what hooks stop people from scrolling, what formats drive saves and shares, what pain points resonate right now, and what angles position a service compellingly.`;

  const user = `Research the current content landscape for the following client and niche. Identify the best opportunities for this week's short-form video content.

CLIENT NICHE: ${persona.niche}

ICP PROFILE:
${persona.icpDoc || '(Not provided — infer from the niche.)'}

OFFER:
${persona.offerDoc || '(Not provided — infer from the niche.)'}

Based on proven content patterns and current trends for this niche on TikTok and Instagram Reels, identify:

1. The 5–7 topic categories getting the most traction right now
2. The 4–6 best-performing content formats with a brief note on why each works
3. The top 5–6 pain points or frustrations the ICP is actively voicing
4. 4–6 strong content angles that position the offer compellingly
5. Platform-specific insights: what works on TikTok vs Instagram Reels for this niche
6. A short strategic summary (2–3 sentences) for this week's content direction

Return ONLY a JSON object in exactly this shape — no markdown, no extra keys:
{
  "trendingTopics": ["...", "..."],
  "bestFormats": [
    { "name": "...", "why": "...", "exampleHook": "..." }
  ],
  "painPoints": ["...", "..."],
  "contentAngles": ["...", "..."],
  "platformInsights": {
    "tiktok": ["...", "..."],
    "instagram": ["...", "..."]
  },
  "summary": "..."
}`;

  const raw = await callClaude(system, user, apiKey);
  return extractJson(raw);
}

// ─── PHASE 2: SCRIPT GENERATION ───────────────────────────────────────────────
async function generateScripts(persona, research, count, apiKey, onStatus) {
  onStatus('Generating ' + count + ' scripts...');

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Build platform split from persona preferences
  const platforms = [];
  if (persona.platforms?.tiktok !== false) platforms.push('tiktok');
  if (persona.platforms?.instagram !== false) platforms.push('instagram');
  if (!platforms.length) platforms.push('tiktok', 'instagram');

  const half = Math.floor(count / 2);
  const tiktokCount = platforms.includes('tiktok') && platforms.includes('instagram')
    ? half
    : platforms.includes('tiktok') ? count : 0;
  const igCount = count - tiktokCount;

  // Content type distribution (roughly 35% value, 25% education, 25% entertainment, 15% soft sell)
  const typeDistribution = buildTypeDistribution(count);

  const system = `You are an expert short-form video scriptwriter who specialises in ${persona.niche}. You write punchy, natural-sounding spoken-word scripts that drive real business results.

Core writing rules:
- The hook must land in the FIRST word or first few words — not "In this video I'll show you" but the real opening line
- Scripts are spoken out loud — no emojis, no bullet symbols, no markdown. Write exactly what the creator will say.
- 150–260 words per script body (approximately 60–90 seconds spoken at a natural pace)
- Never use filler openers: "In today's video", "Hey guys", "Welcome back", "So I wanted to talk about"
- Each script must feel complete and standalone — a viewer who sees only this video must get full value
- CTAs should feel natural and earned, not salesy or forced
- Match the client's exact tone of voice and vocabulary`;

  const user = `Generate ${count} short-form video scripts for the following client. Date: ${today}.

CLIENT: ${persona.name || 'Client'}
NICHE: ${persona.niche}

ICP PROFILE:
${persona.icpDoc || 'Focus on the target audience typical for this niche.'}

OFFER / SERVICES:
${persona.offerDoc || 'Focus on helping the ICP solve their core problem.'}

TONE OF VOICE:
${persona.toneDoc || 'Direct, no-fluff, confident but not arrogant. Speaks to practitioners, not beginners. No buzzwords.'}

─── RESEARCH FOR THIS WEEK ───
Trending Topics: ${research.trendingTopics?.join(' | ')}
Best Formats: ${research.bestFormats?.map(f => f.name).join(' | ')}
Key Pain Points: ${research.painPoints?.join(' | ')}
Content Angles: ${research.contentAngles?.join(' | ')}
TikTok Insights: ${research.platformInsights?.tiktok?.join(' | ')}
Instagram Insights: ${research.platformInsights?.instagram?.join(' | ')}
Strategy Summary: ${research.summary}
─────────────────────────────

SCRIPT MIX:
- ${tiktokCount > 0 ? tiktokCount + ' TikTok scripts' : ''}${tiktokCount > 0 && igCount > 0 ? ' + ' : ''}${igCount > 0 ? igCount + ' Instagram Reels scripts' : ''}
- Type distribution: ${typeDistribution.join(', ')}
- Formats to use (mix them up): Problem-Solution, Contrarian Take, Unfiltered Rant, Step-by-Step Walkthrough, 3 Mistakes List, Authority Callout, Quiet Flex / Calm Authority, Transformation Before-After
- Each script needs TWO hook variants (hookA and hookB) — different opening angles for the same script body, so the creator can A/B test

Return ONLY a JSON array of exactly ${count} objects. No markdown, no extra text. Each object:
{
  "platform": "tiktok" or "instagram",
  "topic": "specific topic of this script in plain language",
  "type": "Value" or "Education" or "Entertainment" or "Soft Sell",
  "format": "exact format name",
  "hookA": "first hook variant — full opening line as spoken",
  "hookB": "second hook variant — different angle, same script body",
  "script": "full script body (150–260 words, natural spoken language, no emojis)",
  "ctaA": "primary call to action as spoken",
  "ctaB": "secondary / softer call to action as spoken"
}`;

  const raw = await callClaude(system, user, apiKey);
  return extractJson(raw);
}

// ─── HELPER: TYPE DISTRIBUTION ─────────────────────────────────────────────────
function buildTypeDistribution(count) {
  // ~35% value, ~25% education, ~25% entertainment, ~15% soft sell
  const dist = [];
  const softSell = Math.max(1, Math.round(count * 0.15));
  const value = Math.round(count * 0.35);
  const education = Math.round(count * 0.25);
  const entertainment = count - value - education - softSell;
  if (value > 0) dist.push(`${value}x Value`);
  if (education > 0) dist.push(`${education}x Education`);
  if (entertainment > 0) dist.push(`${entertainment}x Entertainment`);
  if (softSell > 0) dist.push(`${softSell}x Soft Sell`);
  return dist;
}

// ─── MAIN AGENT RUNNER ────────────────────────────────────────────────────────
/**
 * Run the full two-phase content agent.
 *
 * @param {Object}   persona   - Persona object from localStorage
 * @param {number}   count     - Number of scripts to generate
 * @param {string}   apiKey    - Anthropic API key
 * @param {Function} onStatus  - Status callback (string)
 * @param {Function} onResearch - Called with research JSON after phase 1
 *
 * @returns {{ research, scripts }}
 */
async function runContentAgent(persona, count, apiKey, onStatus, onResearch) {
  // Phase 1
  const research = await researchNiche(persona, apiKey, onStatus);
  if (onResearch) onResearch(research);

  // Phase 2
  const scripts = await generateScripts(persona, research, count, apiKey, onStatus);

  onStatus('Saving to library...');
  return { research, scripts };
}
