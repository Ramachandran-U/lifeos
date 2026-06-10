// Minimal `react-native` stub for the Node-only eval/test harness. Only the
// surfaces actually touched by src/ai/**, src/utils/** and the pure token
// consumers (src/celebration/** via @/theme/motion) are stubbed.
export const Platform = { OS: 'node' as 'node' | 'web' | 'ios' | 'android' };
export const Linking = { openURL: async (_url: string) => undefined };

// @/theme/motion builds its EASING/TIMING_CFG tables at module load. The node
// suite only reads the numeric tokens, so identity curves are enough.
type Curve = (t: number) => number;
const identity: Curve = (t) => t;
export const Easing = {
  linear: identity,
  quad: identity,
  cubic: identity,
  in: (_f: Curve): Curve => identity,
  out: (_f: Curve): Curve => identity,
  inOut: (_f: Curve): Curve => identity,
  bezier: (_x1: number, _y1: number, _x2: number, _y2: number): Curve => identity,
};

// useReduceMotion subscribes at hook time (not import time), but keep a safe
// stub so any future module-load access can't crash the node suite.
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: (_event: string, _handler: (v: boolean) => void) => ({ remove: () => undefined }),
};
