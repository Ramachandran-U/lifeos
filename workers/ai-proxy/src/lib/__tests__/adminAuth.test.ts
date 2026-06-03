import { requireAdmin, type AdminClaims } from '../adminAuth';
import type { SupabaseEnv } from '../supabase';

// Mock the Supabase REST boundary. requireAdmin reaches pgSelect to look up the
// admins table; we assert on the query arg it builds and stub the rows it gets.
const pgSelect = jest.fn<Promise<unknown[]>, [unknown, string, string]>();

jest.mock('../supabase', () => ({
  pgSelect: (env: unknown, table: string, query: string) => pgSelect(env, table, query),
}));

const ENV = {} as Partial<SupabaseEnv> as SupabaseEnv;

beforeEach(() => {
  pgSelect.mockReset();
});

describe('requireAdmin', () => {
  it('throws when the email claim is missing', async () => {
    await expect(requireAdmin(ENV, {})).rejects.toThrow('admin: missing email claim');
    expect(pgSelect).not.toHaveBeenCalled();
  });

  it('throws when the email claim is an empty string', async () => {
    await expect(requireAdmin(ENV, { email: '' })).rejects.toThrow('admin: missing email claim');
    expect(pgSelect).not.toHaveBeenCalled();
  });

  it('throws when the email is whitespace-only (trims to empty)', async () => {
    await expect(requireAdmin(ENV, { email: '   ' })).rejects.toThrow('admin: missing email claim');
    expect(pgSelect).not.toHaveBeenCalled();
  });

  it('throws "not authorized" when the admins lookup returns no rows', async () => {
    pgSelect.mockResolvedValueOnce([]);
    await expect(requireAdmin(ENV, { email: 'ghost@example.com' })).rejects.toThrow(
      'admin: not authorized',
    );
    expect(pgSelect).toHaveBeenCalledTimes(1);
  });

  it('returns the { email, role } from the matched admin row', async () => {
    pgSelect.mockResolvedValueOnce([{ email: 'admin@example.com', role: 'owner' }]);
    const claims: AdminClaims = await requireAdmin(ENV, { email: 'admin@example.com' });
    expect(claims).toEqual({ email: 'admin@example.com', role: 'owner' });
  });

  it('lowercases + trims the email before building the eq.<email> query', async () => {
    pgSelect.mockResolvedValueOnce([{ email: 'admin@example.com', role: 'editor' }]);
    await requireAdmin(ENV, { email: '  Admin@Example.COM  ' });

    expect(pgSelect).toHaveBeenCalledTimes(1);
    const [, table, query] = pgSelect.mock.calls[0];
    expect(table).toBe('admins');
    // The query must carry the normalised (lowercased, trimmed) email.
    expect(query).toContain(`email=eq.${encodeURIComponent('admin@example.com')}`);
    expect(query).not.toContain('Admin@Example.COM');
    expect(query).toContain('select=email,role');
  });
});
