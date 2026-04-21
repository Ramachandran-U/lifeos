// ─── Today Dashboard ─────────────────────────────────────────────────────────

function RoutineBlockCard({ block, c, onComplete }) {
  const meta = LIFEOS.MODULE_META[block.module] || {};
  const color = c[meta.colorKey] || c.primary;
  const statusColors = { completed: c.success, active: color, pending: c.textMuted };
  const statusColor = statusColors[block.status] || c.textMuted;
  const [done, setDone] = React.useState(block.status === 'completed');

  return (
    <Card c={c} accent={block.status === 'active' ? color : undefined}
      style={{ padding: '14px 16px', borderLeft: `3px solid ${block.status === 'pending' ? c.border : statusColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Time */}
        <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: c.textMuted }}>{block.time}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: c.textMuted }}>{block.duration}m</div>
        </div>
        {/* Module badge */}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {meta.emoji}
        </div>
        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 14, color: done ? c.textMuted : c.textPrimary, textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: color, marginTop: 2, fontWeight: 500 }}>
            {meta.label} {block.status === 'active' && '· In progress'}
          </div>
        </div>
        {/* Complete btn */}
        <button
          onClick={() => { setDone(true); onComplete?.(block.id); }}
          style={{
            width: 28, height: 28, borderRadius: 8, border: `2px solid ${done ? c.success : c.border}`,
            background: done ? c.success : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: done ? 'default' : 'pointer', transition: 'all 0.25s ease', flexShrink: 0,
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}>
          {done ? '✓' : ''}
        </button>
      </div>
    </Card>
  );
}

function DomainPanel({ domainKey, scores, c, onClose }) {
  const dm = LIFEOS.DOMAIN_META.find(d => d.key === domainKey);
  if (!dm) return null;
  const color = c[dm.colorKey];
  const score = scores[domainKey] || 0;
  const lastWeek = LIFEOS.MOCK.lastWeekScores[domainKey] || 0;
  const delta = score - lastWeek;

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 280,
      background: c.card, borderLeft: `1px solid ${c.border}`, borderRadius: '0 20px 20px 0',
      padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.2)', zIndex: 10,
      animation: 'slideInRight 0.25s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{dm.emoji}</span>
          <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 18, color: c.textPrimary }}>{dm.label}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.textMuted, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 48, color: color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: delta >= 0 ? c.success : c.error, fontWeight: 600 }}>{delta >= 0 ? '↑' : '↓'}{Math.abs(delta)} vs last week</span>
      </div>
      <XPBar pct={score / 100} color={color} height={8} c={c} />
      <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted, marginBottom: 8, letterSpacing: 0.5 }}>7-DAY TREND</div>
        <Sparkline data={LIFEOS.MOCK.xpHistory} color={color} width={220} height={48} />
      </div>
      <div style={{ marginTop: 'auto' }}>
        <button style={{ width: '100%', padding: '10px 0', borderRadius: 14, background: color + '22', border: `1px solid ${color}44`, color: color, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          View {dm.label} Module →
        </button>
      </div>
    </div>
  );
}

function TodayPage({ c, setPage }) {
  const { MOCK } = LIFEOS;
  const { xpProgressInLevel } = LIFEOS;
  const prog = xpProgressInLevel(MOCK.totalXP);
  const [blocks, setBlocks] = React.useState(MOCK.routineBlocks);
  const [activeDomain, setActiveDomain] = React.useState(null);
  const completedCount = blocks.filter(b => b.status === 'completed').length;

  const handleComplete = (id) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, status: 'completed' } : b));
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const topStreaks = Object.entries(MOCK.streaks)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  return (
    <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>
      {/* Main content */}
      <div style={{ flex: 1, padding: '32px 32px 48px', overflowY: 'auto', minWidth: 0 }}>

        {/* Greeting Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          <AvatarRing xp={MOCK.totalXP} initials={MOCK.user.avatar} size={72} c={c} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 28, color: c.textPrimary, lineHeight: 1.1 }}>
              {greeting}, {MOCK.user.name.split(' ')[0]} 👋
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: c.textSecondary, marginTop: 4 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <XPBar pct={prog.pct} color={c.primary} height={6} c={c} bg={c.border} />
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted, flexShrink: 0 }}>{prog.current}/{prog.needed} XP</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: c.streak, background: c.streak + '22', borderRadius: 999, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              🔥 {MOCK.streaks.workout.count}d
            </span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: c.xp, background: c.xp + '22', borderRadius: 999, padding: '5px 12px' }}>
              ⚡ {MOCK.totalXP.toLocaleString()} XP
            </span>
          </div>
        </div>

        {/* Hex Radar */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, marginBottom: 16, letterSpacing: 0.5 }}>LIFE BALANCE</div>
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ maxWidth: 420, width: '100%' }}>
              <HexRadar scores={MOCK.domainScores} size={420} c={c}
                onDomainClick={k => setActiveDomain(k === activeDomain ? null : k)}
                activeDomain={activeDomain} />
            </div>
            {activeDomain && (
              <DomainPanel domainKey={activeDomain} scores={MOCK.domainScores} c={c} onClose={() => setActiveDomain(null)} />
            )}
          </div>
        </div>

        {/* Routine blocks */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, letterSpacing: 0.5 }}>TODAY'S ROUTINE</div>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: c.textMuted }}>{completedCount}/{blocks.length} done</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {blocks.map(block => (
              <RoutineBlockCard key={block.id} block={block} c={c} onComplete={handleComplete} />
            ))}
          </div>
        </div>

        {/* Daily briefing */}
        <Card c={c} accent={c.primary} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: c.primary + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✨</div>
            <div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 15, color: c.primary, marginBottom: 6, letterSpacing: 0.5 }}>DAILY BRIEFING</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: c.textSecondary, lineHeight: 1.6 }}>
                You're {completedCount} of {blocks.length} blocks in. Your career score is your strongest at <strong style={{ color: c.career }}>81</strong> — keep that deep work streak going. Social is your biggest growth opportunity this week.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Rail */}
      <div style={{ width: 300, flexShrink: 0, padding: '32px 24px 48px 0', display: 'flex', flexDirection: 'column', gap: 24 }} className="right-rail">

        {/* Top Streaks */}
        <div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, color: c.textSecondary, marginBottom: 12, letterSpacing: 0.5 }}>TOP STREAKS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topStreaks.map(([key, streak]) => {
              const sm = LIFEOS.STREAK_META[key];
              const color = c[sm.colorKey];
              return (
                <Card key={key} c={c} style={{ padding: '12px 16px' }} accent={color}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{sm.emoji}</span>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: c.textSecondary }}>{sm.label}</span>
                    </div>
                    <StreakFlame count={streak.count} graceUsed={streak.graceUsed} size="sm" c={c} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Active Quests */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, color: c.textSecondary, letterSpacing: 0.5 }}>ACTIVE QUESTS</div>
            <button onClick={() => setPage('rewards')} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.primary, cursor: 'pointer', padding: 0 }}>View all</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK.quests.filter(q => q.type === 'daily').map(q => (
              <QuestCard key={q.id} quest={q} c={c} compact />
            ))}
          </div>
        </div>

        {/* Weekly Quest */}
        <div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, color: c.textSecondary, marginBottom: 12, letterSpacing: 0.5 }}>WEEKLY QUEST</div>
          {MOCK.quests.filter(q => q.type === 'weekly').map(q => (
            <div key={q.id} style={{ position: 'relative' }}>
              <QuestCard quest={q} c={c} compact />
              <span style={{ position: 'absolute', top: -8, right: 12, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: c.xp, background: c.xp + '22', border: `1px solid ${c.xp}55`, borderRadius: 999, padding: '2px 8px', letterSpacing: 0.5 }}>WEEKLY</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TodayPage, RoutineBlockCard, DomainPanel });
