export interface GraderResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export type Grader<O> = (output: O, input: unknown) => GraderResult | Promise<GraderResult>;

export interface EvalCase<I, O> {
  name: string;
  input: I;
  graders: Grader<O>[];
}

export interface EvalSuite<I, O> {
  name: string;
  threshold: number;
  run: (input: I) => Promise<O>;
  cases: EvalCase<I, O>[];
}
