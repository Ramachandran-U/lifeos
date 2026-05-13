// ─── Rewards Page ─────────────────────────────────────────────────────────────

function LevelLadder({ currentLevel, c }) {
  const { xpForLevel, MOCK } = LIFEOS;
  const steps = [currentLevel, currentLevel + 1, currentLevel + 2, currentLevel + 3, currentLevel + 4];
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content', padding: '8px 0' }}>
        {steps.map((lvl, i) => {
          const isCurrent = lvl === currentLevel;
          const perks = MOCK.levelPerks[lvl] || [];
          return (
            <React.Fragment key={lvl}>
              {/* Connector line */}
              {i > 0 && (
                <div style={{ width: 48, height: 2, background: isCurrent ? c.primary : c.border, flexShrink: 0, marginTop: -40 }} />
              )}
              {/* Step */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div style={{
                  width: isCurrent ? 72 : 56, height: isCurrent ? 72 : 56,
                  borderRadius: '50%',
                  background: isCurrent ? `radial-gradient(circle, ${c.primary}cc, ${c.primary}88)` : c.card,
                  border: `2px solid ${isCurrent ? c.primary : c.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isCurrent ? `0 0 24px ${c.primary}55` : 'none',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: isCurrent ? 22 : 17, color: isCurrent ? '#fff' : c.textMuted, lineHeight: 1 }}>{lvl}</span>
                  {isCurrent && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, marginTop: 1 }}>YOU</span>}
                </div>
                <div style={{ width: 160, padding: '12px 14px', background: c.card, border: `1px solid ${isCurrent ? c.primary + '44' : c.border}`, borderRadius: 14, flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, color: c.textMuted, marginBottom: 6, letterSpacing: 0.5 }}>
                    LVL {lvl} PERKS
                  </div>
                  {perks.length > 0 ? perks.map((p, pi) => (
                    <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: isCurrent ? c.primary : c.textMuted, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: isCurrent ? c.textPrimary : c.textSecondary }}>{p}</span>
                    </div>
                  )) : (
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted }}>Perks unlocking soon</span>
                  )}
                  <div style={{ marginTop: 8, fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: c.textMuted }}>
                    {xpForLevel(lvl).toLocaleString()} XP required
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {/* Arrow indicating more */}
        <div style={{ width: 48, height: 2, background: c.border, flexShrink: 0, marginTop: -40 }} />
        <div style={{ display: 'flex', alignItems: 'center', marginTop: -40 }}>
          <span style={{ fontSize: 20, color: c.textMuted }}>→</span>
        </div>
      </div>
    </div>
  );
}

function StreakShowcase({ streaks, c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(streaks).map(([key, streak]) => {
        const sm = LIFEOS.STREAK_META[key];
        const color = c[sm.colorKey];
        const pct = Math.min(1, streak.count / 30);
        const bestPct = Math.min(1, streak.best / 30);
        return (
          <Card key={key} c={c} accent={color} style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Flame + streak */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 56, flexShrink: 0 }}>
                <StreakFlame count={streak.count} graceUsed={streak.graceUsed} size={streak.count >= 20 ? 'lg' : streak.count >= 10 ? 'md' : 'sm'} c={c} />
              </div>
              {/* Label + bars */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{sm.emoji}</span>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 15, color: c.textPrimary }}>{sm.label}</span>
                    {streak.graceUsed && (
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 600, color: c.warning, background: c.warning + '22', borderRadius: 999, padding: '1px 7px' }}>GRACE</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted }}>Best: <strong style={{ color: color }}>{streak.best}</strong></span>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted }}>Current: <strong style={{ color: c.textPrimary }}>{streak.count}</strong></span>
                  </div>
                </div>
                {/* Progress toward 30-day */}
                <div style={{ position: 'relative' }}>
                  <div style={{ background: c.border, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: color, borderRadius: 999, width: `${pct * 100}%`, transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)' }} />
                  </div>
                  {/* Best marker */}
                  <div style={{ position: 'absolute', top: -3, left: `${bestPct * 100}%`, width: 2, height: 12, background: color + '88', borderRadius: 1, transform: 'translateX(-50%)' }} />
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: c.textMuted, marginTop: 4 }}>{30 - streak.count} days to 30-day badge</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function RewardsPage({ c }) {
  const { MOCK, xpProgressInLevel, BADGE_META } = LIFEOS;
  const prog = xpProgressInLevel(MOCK.totalXP);
  const allBadgeIds = Object.keys(BADGE_META);
  const [section, setSection] = React.useState('overview');
  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'badges',   label: 'Badges'   },
    { id: 'streaks',  label: 'Streaks'  },
    { id: 'quests',   label: 'Quests'   },
  ];

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 960, margin: '0 auto' }}>

      {/* Hero Band */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
        {/* Giant level ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <LevelRing xp={MOCK.totalXP} size={180} c={c} />
          {/* Glow halo */}
          <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', background: `radial-gradient(circle, ${c.primary}22 0%, transparent 70%)`, pointerEvents: 'none' }} />
        </div>
        {/* XP stats */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 44, color: c.textPrimary, lineHeight: 1 }}>
            {MOCK.totalXP.toLocaleString()}
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 18, color: c.xp, marginLeft: 8 }}>XP</span>
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: c.textSecondary, marginTop: 4, marginBottom: 16 }}>
            Level {prog.level} · {prog.current.toLocaleString()} / {prog.needed.toLocaleString()} XP to next level
          </div>
          <XPBar pct={prog.pct} color={c.xp} height={12} c={c} />
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: '10px 16px' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, letterSpacing: 0.5 }}>THIS WEEK</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 22, color: c.xp }}>+{MOCK.weeklyXP}</div>
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: '10px 16px' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, letterSpacing: 0.5 }}>BADGES</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 22, color: c.badge }}>{MOCK.badges.length}/{allBadgeIds.length}</div>
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: '10px 16px' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, letterSpacing: 0.5 }}>BEST STREAK</div>
              <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 22, color: c.streak }}>23🔥</div>
            </div>
          </div>
        </div>
        {/* XP sparkline */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 20, padding: '20px 24px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, letterSpacing: 0.5, marginBottom: 10 }}>7-DAY XP</div>
          <Sparkline data={MOCK.xpHistory} color={c.xp} width={160} height={60} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: c.textMuted }}>Mon</span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: c.textMuted }}>Sun</span>
          </div>
        </div>
      </div>

      {/* Level Ladder */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, marginBottom: 16, letterSpacing: 0.5 }}>LEVEL LADDER</div>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 20, padding: '24px' }}>
          <LevelLadder currentLevel={prog.level} c={c} />
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: `1px solid ${c.border}`, paddingBottom: 0 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14,
            color: section === s.id ? c.primary : c.textMuted,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', borderBottom: `2px solid ${section === s.id ? c.primary : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
          }}>{s.label}</button>
        ))}
      </div>

      {/* Overview: Domain Mini-Cards */}
      {section === 'overview' && (
        <div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, marginBottom: 16, letterSpacing: 0.5 }}>DOMAIN SCORES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {LIFEOS.DOMAIN_META.map(dm => {
              const score = MOCK.domainScores[dm.key] || 0;
              const last = MOCK.lastWeekScores[dm.key] || 0;
              return (
                <DomainMiniCard key={dm.key} domainKey={dm.key} score={score} delta={score - last} xpHistory={MOCK.xpHistory} c={c} onClick={() => setSection('streaks')} />
              );
            })}
          </div>
        </div>
      )}

      {/* Badge Gallery */}
      {section === 'badges' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, letterSpacing: 0.5 }}>BADGE GALLERY</div>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: c.textMuted }}>{MOCK.badges.length} of {allBadgeIds.length} earned</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {allBadgeIds.map(id => (
              <BadgeCard key={id} badgeId={id} earned={MOCK.badges.includes(id)} c={c} />
            ))}
          </div>
        </div>
      )}

      {/* Streak Showcase */}
      {section === 'streaks' && (
        <div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, marginBottom: 16, letterSpacing: 0.5 }}>STREAK SHOWCASE</div>
          <StreakShowcase streaks={MOCK.streaks} c={c} />
        </div>
      )}

      {/* Quests */}
      {section === 'quests' && (
        <div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, marginBottom: 12, letterSpacing: 0.5 }}>DAILY QUESTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {MOCK.quests.filter(q => q.type === 'daily').map(q => <QuestCard key={q.id} quest={q} c={c} />)}
          </div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 16, color: c.textSecondary, marginBottom: 12, letterSpacing: 0.5 }}>WEEKLY QUEST</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK.quests.filter(q => q.type === 'weekly').map(q => (
              <div key={q.id} style={{ position: 'relative' }}>
                <QuestCard quest={q} c={c} />
                <span style={{ position: 'absolute', top: -10, left: 20, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: c.xp, background: c.xp + '22', border: `1px solid ${c.xp}55`, borderRadius: 999, padding: '2px 10px', letterSpacing: 0.5 }}>WEEKLY</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { RewardsPage, LevelLadder, StreakShowcase });
