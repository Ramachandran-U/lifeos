-- LifeOS — P1-T6 sync pull cursor.
--
-- Pull needs a GAP-FREE, monotonic cursor. The mutation `lamport` is a logical
-- clock that can collide or arrive out of order across devices, so filtering
-- `lamport > cursor` can silently skip a concurrent write from another device.
-- A server-assigned bigserial in INSERTION order is monotonic and never
-- collides, so `seq > cursor` is safe: the client advances its cursor to the
-- max seq it has pulled and never misses or re-fetches a row.
--
-- (Convergence ordering still uses (lamport, deviceId) — see resolve.ts. `seq`
-- is purely the transport cursor.)
--
-- 0007 created `mutations` empty, so adding the column now backfills nothing.

alter table mutations add column if not exists seq bigserial;

-- Pull scans this user's rows with seq > cursor, in seq order.
create index if not exists mutations_user_seq_idx on mutations (user_id, seq);
