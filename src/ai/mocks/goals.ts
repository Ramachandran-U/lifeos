import { GoalHierarchy, GoalDescription, GoalDescriptionInput } from '../types';

export function buildMockGoalDescription(input: GoalDescriptionInput): GoalDescription {
  const { title, goalType, level } = input;
  const scope = level ? `${level} goal` : 'goal';
  return {
    description: `This ${goalType} ${scope} anchors your day-to-day choices around "${title}". You'll know it's working when the next concrete action feels obvious and you see weekly progress without checking a tracker.`,
  };
}

export function buildMockGoalHierarchy(visionStatement: string, name?: string): GoalHierarchy {
  const vision = visionStatement.trim();
  const primaryTitle = vision.charAt(0).toUpperCase() + vision.slice(1).replace(/\.$/, '');
  const short = primaryTitle.length > 60 ? primaryTitle.slice(0, 57) + '…' : primaryTitle;

  return {
    primaryGoal: {
      title: primaryTitle,
      type: 'career',
    },
    yearly: {
      title: `One public artifact proving progress on: ${short}`,
      milestone: `By year-end, a URL or document that a stranger could evaluate as evidence you're closer to "${short}" than you were in month 1.`,
    },
    monthly: [
      {
        month: 1,
        title: `Published 1-page roadmap for "${short}"`,
        milestone: `A written doc listing the 3 skills, 3 artifacts, and 3 people that define success — shared with at least one accountability partner.`,
      },
      {
        month: 2,
        title: `Shipped first proof-of-competence artifact`,
        milestone: `One deployed, documented output relevant to the goal (repo, post, demo, design doc). Binary: it has a URL or it doesn't.`,
      },
      {
        month: 3,
        title: `Artifact reviewed by 1 practitioner + tightened V2`,
        milestone: `Written feedback logged from someone already doing this, and a V2 merged that addresses the top 2 critiques.`,
      },
    ],
    weekly: [
      {
        week: 1,
        focus: `Scope — turn "${short}" into a shippable target`,
        tasks: [
          `Write a 1-page doc defining what "done" looks like in 12 weeks (artifact, not feeling).`,
          `List 3 people who've reached a version of this — note what they shipped, not how they felt.`,
          `Pick ONE proof artifact to ship by week 8 and post it in your goal card.`,
        ],
      },
      {
        week: 2,
        focus: 'Start building — no more reading',
        tasks: [
          `Make the first commit / draft / page of your proof artifact and push it publicly.`,
          `Block 4 deep-work sessions on your calendar this week and defend them.`,
          `Write a 3-sentence progress note at the end of the week. No artifact = no note.`,
        ],
      },
      {
        week: 3,
        focus: 'Ship a visible checkpoint',
        tasks: [
          `Publish v0.1 of the artifact somewhere public (repo README, draft post, demo link).`,
          `Send it to 1 practitioner with a specific question. No "thoughts?" — ask a real one.`,
          `List the 2 biggest gaps their feedback surfaces and log them as next-week tasks.`,
        ],
      },
      {
        week: 4,
        focus: 'Tighten and commit',
        tasks: [
          `Merge the V2 changes that address last week's feedback. No scope creep.`,
          `Write a 1-paragraph retro: what shipped, what didn't, and why. Be honest.`,
          `Re-commit to one daily ritual that makes week 5 non-negotiable.`,
        ],
      },
    ],
    dailyTaskExamples: [
      `45 min deep work: move the proof artifact forward by one concrete commit/draft.`,
      `20 min: read one primary source (paper, docs, code) — take Feynman-style notes in your own words.`,
      `10 min end-of-day log: what shipped, what's blocking, what's next. No blank entries.`,
      `15 min: one outreach action tied to the artifact — question, share, or ask for review.`,
      `10 min weekly checkpoint: if this week produced no visible output, cut scope before adding hours.`,
    ],
  };
}
