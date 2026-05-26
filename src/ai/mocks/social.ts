import type { ConversationStarters, ConversationStartersInput } from '../types';

const BY_RELATIONSHIP: Record<string, string[][]> = {
  inner_circle: [
    [
      "Been a minute — got 20 minutes for a proper call this week?",
      "What's been the highlight (or low) of the last couple of weeks for you?",
      "Free for a walk + catchup on Saturday morning?",
    ],
  ],
  close_friend: [
    [
      "Hey — realised I haven't checked in properly. How's everything been?",
      "What's been keeping you busy lately?",
      "Coffee or call sometime next week?",
    ],
  ],
  family: [
    [
      "How are you doing? Wanted to actually catch up, not just send a quick text.",
      "Anything going on this week I should know about?",
      "When's a good time for a proper call?",
    ],
  ],
  mentor: [
    [
      "Wanted to share a quick update on where things are — and ask one specific question if you have 15 minutes this month.",
      "I've been working through a decision and would value your read on it — open to a short call?",
      "Reading anything good lately? I'm looking for one solid recommendation in your space.",
    ],
  ],
  colleague: [
    [
      "Quick hello — how's your side of the world been?",
      "Are you still working on what we last spoke about?",
      "Free for a coffee sometime in the next couple of weeks?",
    ],
  ],
  acquaintance: [
    [
      "Crossed my mind earlier — how have you been?",
      "What are you up to these days?",
      "Hope you're well — if you're ever around let me know.",
    ],
  ],
};

export function buildMockConversationStarters(input: ConversationStartersInput): ConversationStarters {
  const pool = BY_RELATIONSHIP[input.relationshipType] ?? BY_RELATIONSHIP.close_friend;
  const openers = pool[0];

  // Sprinkle the "been a while" framing when overdue is significant.
  if (input.daysSinceContact >= 30) {
    return {
      openers: [
        "It's been longer than I'd like — wanted to say hi properly rather than just react to a story.",
        ...openers.slice(1),
      ],
    };
  }
  return { openers };
}
