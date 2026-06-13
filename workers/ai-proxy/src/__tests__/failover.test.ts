import { isFailoverStatus } from '../claude';

// Guards the provider-failover policy. The 401/403 cases are the resilience fix:
// a lapsed/invalid cheap-tier key (e.g. Groq) must fail over to the next provider
// in the chain (→ Gemini) instead of 502ing the user. This is the exact gap that
// took down "Generate my routine" when the Groq key expired.

describe('isFailoverStatus', () => {
  it('fails over on auth errors (the resilience fix)', () => {
    expect(isFailoverStatus(401)).toBe(true); // invalid/expired key
    expect(isFailoverStatus(403)).toBe(true); // forbidden / key lacks access
  });

  it('fails over on rate limit and transient 5xx', () => {
    expect(isFailoverStatus(429)).toBe(true);
    expect(isFailoverStatus(500)).toBe(true);
    expect(isFailoverStatus(502)).toBe(true);
    expect(isFailoverStatus(503)).toBe(true);
    expect(isFailoverStatus(599)).toBe(true);
  });

  it('does NOT fail over on request-shape errors (another provider won’t help)', () => {
    expect(isFailoverStatus(400)).toBe(false);
    expect(isFailoverStatus(404)).toBe(false);
    expect(isFailoverStatus(422)).toBe(false);
  });

  it('does NOT fail over on success', () => {
    expect(isFailoverStatus(200)).toBe(false);
  });
});
