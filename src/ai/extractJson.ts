/**
 * Extract the first valid JSON value (object or array) from an AI response.
 * The CLI proxy often wraps JSON in prose or ```json fences, so
 * `JSON.parse(response)` fails. This normalises that.
 */
export function extractJson<T = unknown>(response: string): T {
  const trimmed = response.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inner = fence[1].trim();
    return JSON.parse(inner) as T;
  }

  // Try as-is first
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }

  // Fallback: locate the first {...} or [...] block by matching braces
  const start = firstJsonStart(trimmed);
  if (start === -1) throw new Error('No JSON found in AI response');
  const end = matchingCloseIndex(trimmed, start);
  if (end === -1) throw new Error('Unbalanced JSON in AI response');
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

function firstJsonStart(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') return i;
  }
  return -1;
}

function matchingCloseIndex(s: string, start: number): number {
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
