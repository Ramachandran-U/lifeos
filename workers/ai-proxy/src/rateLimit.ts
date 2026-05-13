function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndIncrement(
  kv: KVNamespace,
  subject: string,
  limit: number,
): Promise<boolean> {
  const key = `${subject}:${todayUtc()}`;
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= limit) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}
