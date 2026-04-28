import type { ZodType } from 'zod';
import type { Grader } from './types';

export const schemaValid = <T>(schema: ZodType<T>): Grader<unknown> => (out) => {
  const r = schema.safeParse(out);
  return {
    name: 'schemaValid',
    passed: r.success,
    detail: r.success ? '' : r.error.message.slice(0, 200),
  };
};

export const check = <O>(name: string, fn: (out: O) => boolean, detailOnFail = ''): Grader<O> =>
  (out) => ({ name, passed: !!fn(out), detail: detailOnFail });

export const equals = <O>(name: string, accessor: (out: O) => unknown, expected: unknown): Grader<O> =>
  (out) => {
    const actual = accessor(out);
    return {
      name,
      passed: actual === expected,
      detail: actual === expected ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    };
  };
