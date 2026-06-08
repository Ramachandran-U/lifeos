// Static narration scripts for onboarding screens.
//
// These are written once and spoken live via expo-speech — zero runtime cost,
// no API quota. Each script also carries `introCards`: the visual cards that
// reveal in sync with the voice, explaining what each section does.
//
// `atMs` values are estimated from the script's word count at ~150 wpm with
// the iOS 0.48 rate setting. Run `npm run gen:onboarding-audio` (ElevenLabs)
// to produce real MP3s + word-boundary timestamps; update atMs from the
// generated .cues.json at that point.
//
// Keep each script under ~250 characters: short, warm, never repeats the UI.
// Card body copy should be one tight sentence — context, not instruction.

export interface IntroCard {
  id: string;
  icon: string;    // Ionicons name
  title: string;
  body: string;
  atMs: number;    // estimated reveal time in ms from narration start
}

export interface NarrationScript {
  id: string;
  text: string;
  introCards: IntroCard[];
}

export const ONBOARDING_SCRIPTS: NarrationScript[] = [
  {
    id: 'day1-vision',
    text: "Welcome to LifeOS. Let's start with the most important question — what kind of life do you actually want? Be ambitious. We'll work backwards from there.",
    introCards: [
      {
        id: 'vision-north-star',
        icon: 'telescope-outline',
        title: 'Your life vision',
        body: 'The single sentence everything in LifeOS works backwards from.',
        atMs: 0,
      },
      {
        id: 'vision-ai-breakdown',
        icon: 'git-branch-outline',
        title: 'AI goal breakdown',
        body: 'We turn your vision into a year plan, monthly milestones, and weekly focus areas.',
        atMs: 4000,
      },
      {
        id: 'vision-ambition',
        icon: 'flame-outline',
        title: 'Go big',
        body: "Don't filter yourself — bolder visions make more interesting plans.",
        atMs: 9000,
      },
    ],
  },
  {
    id: 'day1-career',
    text: "Your career shapes a lot more than your bank balance. Tell us where you are and where you're headed — we'll figure out the skills that close the gap.",
    introCards: [
      {
        id: 'career-engine',
        icon: 'briefcase-outline',
        title: 'Career Intelligence',
        body: 'LifeOS tracks your trajectory from where you are to where you want to be.',
        atMs: 0,
      },
      {
        id: 'career-gap',
        icon: 'analytics-outline',
        title: 'Skill gap analysis',
        body: "We'll surface exactly what you need to learn and a realistic timeline to get there.",
        atMs: 3500,
      },
      {
        id: 'career-blocks',
        icon: 'calendar-outline',
        title: 'Built into your week',
        body: 'Skills get protected time blocks in your daily routine — not just wishlist items.',
        atMs: 7500,
      },
    ],
  },
  {
    id: 'day1-routine',
    text: "This is where vision meets reality. We'll build a daily rhythm around your real schedule, not a fantasy one. Small blocks. Sustainable wins.",
    introCards: [
      {
        id: 'routine-blueprint',
        icon: 'grid-outline',
        title: 'Your daily blueprint',
        body: 'A full-day plan built around your actual wake, work, and sleep times.',
        atMs: 0,
      },
      {
        id: 'routine-balance',
        icon: 'pie-chart-outline',
        title: 'All six engines balanced',
        body: 'Health, goals, career, social — each engine gets the right slice of your day.',
        atMs: 2500,
      },
      {
        id: 'routine-flexible',
        icon: 'swap-vertical-outline',
        title: 'Drag to rearrange',
        body: 'After generating, drag any activity to a different slot — times stay fixed.',
        atMs: 7000,
      },
    ],
  },
];
