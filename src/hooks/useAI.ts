import { useState, useCallback } from 'react';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async <T>(
    fn: () => Promise<T>,
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch {
      setError('Something went wrong. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
}
