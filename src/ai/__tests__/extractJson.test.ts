import { extractJson } from '../extractJson';

describe('extractJson', () => {
  it('parses raw JSON object', () => {
    expect(extractJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses raw JSON array', () => {
    expect(extractJson<number[]>('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('strips ```json fences', () => {
    const res = 'Here is the plan:\n```json\n{"ok":true}\n```\nLet me know.';
    expect(extractJson<{ ok: boolean }>(res)).toEqual({ ok: true });
  });

  it('strips bare ``` fences', () => {
    expect(extractJson<{ n: number }>('```\n{"n":2}\n```')).toEqual({ n: 2 });
  });

  it('extracts object from surrounding prose', () => {
    const res = 'Sure! Here you go: {"x":"y","nested":{"a":1}} — hope that helps.';
    expect(extractJson(res)).toEqual({ x: 'y', nested: { a: 1 } });
  });

  it('handles nested braces and strings with braces', () => {
    const res = 'prelude {"note":"use {brackets}","v":{"a":[1,2,3]}} postlude';
    expect(extractJson(res)).toEqual({ note: 'use {brackets}', v: { a: [1, 2, 3] } });
  });

  it('throws on empty input', () => {
    expect(() => extractJson('')).toThrow(/No JSON/);
  });

  it('throws on unbalanced JSON', () => {
    expect(() => extractJson('the plan is {"a": 1')).toThrow();
  });
});
