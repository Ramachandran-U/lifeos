import { describe, it, expect } from '@jest/globals';
import { parseAgentNode } from '../exploreThread';
import type { RabbitHoleInput } from '@/explore/rabbitHole';

const input: RabbitHoleInput = {
  parent: { title: 'Feedback loops', body: 'A system whose output feeds back into its input.' },
  anchor: { title: 'Systems thinking', seedInterest: 'Systems thinking', adjacentField: 'biology' },
  direction: 'deeper',
};

const validNode = {
  title: 'Homeostasis as a thermostat',
  body: 'Biological feedback keeps body temperature steady the same way a thermostat does — sensing a deviation and acting to cancel it. The control law is identical even though the substrate is not.',
  goDeeperHint: 'gain and lag in control loops',
  goSidewaysHint: 'feedback in economics',
};

describe('parseAgentNode', () => {
  it('parses a well-formed JSON node from the agent answer', () => {
    const out = parseAgentNode(JSON.stringify(validNode), input);
    expect(out.title).toBe(validNode.title);
    expect(out.goDeeperHint).toBe(validNode.goDeeperHint);
  });

  it('extracts JSON even when wrapped in prose/fences', () => {
    const wrapped = 'Here is the node:\n```json\n' + JSON.stringify(validNode) + '\n```';
    expect(parseAgentNode(wrapped, input).title).toBe(validNode.title);
  });

  // The 'deeper' mock node now derives from the PARENT (so deeper levels differ),
  // e.g. "The mechanism beneath Feedback loops", and keeps the anchor in the body.
  it('falls back to the curated mock node on unparseable text', () => {
    const out = parseAgentNode('I could not decide, sorry.', input);
    expect(out.title).toContain('Feedback loops'); // parent-derived, not anchor-derived
    expect(out.body).toContain('Systems thinking'); // still tethered to the anchor
    expect(out.body.length).toBeGreaterThan(40);
  });

  it('falls back to the mock node when the parsed node is filler', () => {
    const filler = { ...validNode, body: 'Remember that everything is connected, so stay curious and keep going.' };
    const out = parseAgentNode(JSON.stringify(filler), input);
    expect(out.title).not.toBe(validNode.title);
    expect(out.title).toContain('Feedback loops');
  });

  it('falls back to the mock node when the schema is violated', () => {
    const out = parseAgentNode(JSON.stringify({ title: 'x' }), input);
    expect(out.title).not.toBe(validNode.title);
    expect(out.title).toContain('Feedback loops');
  });
});
