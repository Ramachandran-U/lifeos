// Static narration scripts for onboarding screens.
//
// These are written once, rendered to MP3 at dev time via
// `npm run gen:onboarding-audio`, and shipped as bundled assets — so there
// is zero runtime API cost and no per-user quota concern.
//
// Keep each script under ~250 characters: short, warm, never repeats what
// the screen already says. The voice's job is to set tone, not narrate UI.

export interface NarrationScript {
  id: string;
  text: string;
}

export const ONBOARDING_SCRIPTS: NarrationScript[] = [
  {
    id: 'day1-vision',
    text: "Welcome to LifeOS. Let's start with the most important question — what kind of life do you actually want? Be ambitious. We'll work backwards from there.",
  },
  {
    id: 'day1-career',
    text: "Your career shapes a lot more than your bank balance. Tell us where you are and where you're headed — we'll figure out the skills that close the gap.",
  },
  {
    id: 'day1-routine',
    text: "This is where vision meets reality. We'll build a daily rhythm around your real schedule, not a fantasy one. Small blocks. Sustainable wins.",
  },
];
