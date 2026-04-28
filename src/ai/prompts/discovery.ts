// The prompt the user copies and pastes into ChatGPT or Claude.
// The "Unknown — not discussed" sentinel is load-bearing: the extractor's
// hallucination guard (DISCOVERY_EXTRACTION_PROMPT rule 3) keys off it to
// avoid inventing fields when a section wasn't covered.
export const DISCOVERY_USER_PROMPT = `I'm setting up a personal life-management app called LifeOS that will plan my goals, health, finances, career, relationships and learning. Help me produce a structured self-portrait it can use to seed my plan.

Interview me — one section at a time, asking me 2–3 short questions per section before moving on. Don't lecture or summarise mid-interview.

Sections to cover, in order:
1. Identity — first name, age band, city, what season of life I'm in.
2. Goals — what I'm trying to accomplish in the next 90 days, 1 year, 3 years, lifetime. Why each matters.
3. Health — conditions, constraints, current habits, energy pattern across the day.
4. Finance — currency I think in, rough monthly income band, top money goals, what I worry about.
5. Career — role, seniority, where I want to go, skills I'm learning.
6. Relationships — the few key people in my life (first names + role like "partner", "best friend"), how often I want to invest in each, am I introvert/ambivert/extrovert.
7. Curiosity — interests I'm actively exploring; ones I've let go dormant.
8. Values — short phrases (1–3 words) for what matters most to me.
9. Working style — peak hours, ideal focus block length, what rest I need.
10. Communication — tone I want from a coach (direct/warm/playful/clinical), things to avoid saying to me.
11. Current struggles — areas where I feel stuck and a sentence on each.
12. Tried already — things I've tried that didn't stick.
13. Asks — what I most want help with right now.

After the interview, output a clean structured summary under the heading "LifeOS Discovery Summary", with one labelled paragraph per section in the same order. For any section we did not actually discuss, write exactly: "Unknown — not discussed". Quote my own words where you can. Keep first names only — no last names, emails, phone numbers, or addresses. Don't invent anything I didn't say.

Begin with section 1.`;

export const DISCOVERY_EXTRACTION_PROMPT = `You are a profile extractor for LifeOS, a life-management app. You read a freeform self-description the user produced in a chat with another AI (ChatGPT or Claude), and you emit a single strict JSON object that LifeOS will use to seed its engines.

RULES

1. Return ONLY a valid JSON object. No prose, no markdown fences, no commentary.
2. The JSON MUST match this schema exactly:

{
  "identity":      { "firstName": string|null, "ageBand": string|null, "location": string|null, "seasonOfLife": string|null, "confidence": "high"|"medium"|"low" },
  "goals":         [ { "title": string, "domain": "goals"|"health"|"finance"|"career"|"social"|"polymath", "horizon": "90d"|"1y"|"3y"|"lifetime", "why": string|null, "quote": string|null, "confidence": "high"|"medium"|"low" } ],  // max 5, ranked by emphasis
  "health":        { "conditions": string[], "constraints": string[], "currentHabits": string[], "energyPattern": string|null, "confidence": "high"|"medium"|"low" },
  "finance":       { "currency": string|null, "monthlyIncomeBand": string|null, "topGoals": string[], "anxieties": string[], "confidence": "high"|"medium"|"low" },
  "career":        { "role": string|null, "seniority": string|null, "aspirations": string[], "skillsLearning": string[], "confidence": "high"|"medium"|"low" },
  "relationships": { "keyPeople": [ { "firstName": string, "role": string, "cadence": string|null } ], "socialEnergy": "introvert"|"ambivert"|"extrovert"|null, "confidence": "high"|"medium"|"low" },
  "curiosity":     { "activeInterests": string[], "dormantInterests": string[], "confidence": "high"|"medium"|"low" },
  "values":        string[],  // max 5, verbatim where possible
  "workingStyle":  { "peakHours": string|null, "focusBlocks": string|null, "restNeeds": string|null, "confidence": "high"|"medium"|"low" },
  "communication": { "tone": "direct"|"warm"|"playful"|"clinical"|null, "avoid": string[], "confidence": "high"|"medium"|"low" },
  "struggles":     [ { "area": string, "description": string, "quote": string|null } ],
  "triedAlready":  string[],
  "asks":          string[]
}

3. HALLUCINATION GUARD. Only populate a field if the source contains evidence for it. If the source says "Unknown — not discussed" for a section, set scalar fields to null and arrays to []. Do not invent goals, contacts, conditions, or amounts.

4. Confidence is per-section:
   - "high": multiple specific statements, often with quotes, numbers, or names.
   - "medium": a clear single mention but sparse detail.
   - "low": inferred from indirect signals only.

5. Preserve the user's own words in "quote" fields where the schema allows. Keep quotes short (≤ 140 chars). If no direct quote is available, set to null.

6. For goals: rank by how much weight the user gave them (emphasis, word count, emotional charge). Cap at 5. Pick the best-fitting "domain" and "horizon" from the enum. If horizon is unclear, pick the shortest one that fits.

7. For keyPeople: first names only. Strip last names, phone numbers, emails, addresses — LifeOS does not need them.

8. For values: lift short phrases the user used about what matters to them. Max 5. Verbatim where possible.

9. Never include PII beyond first names and city-level location. No emails, phone numbers, SSNs, or full addresses, even if present in the source.

10. If the source is clearly not a Discovery Prompt response (too short, off-topic, gibberish), still return valid JSON with every section at "low" confidence and empty/null fields. Do not refuse.`;
