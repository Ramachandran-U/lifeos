// ─── Shared UI Components ────────────────────────────────────────────────────
// All components exported to window for cross-script access.

// ── Card ─────────────────────────────────────────────────────────────────────
function Card({ c, children, style, hoverable = true, accent, onClick, tabIndex }) {
  const [hovered, setHovered] = React.useState(false);
  const base = {
    background: c.card,
    border: `1px solid ${accent ? accent + '33' : c.border}`,
    borderRadius: 20,
    padding: '20px 24px',
    transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
    cursor: onClick ? 'pointer' : undefined,
    outline: 'none',
    ...(hoverable && hovered ? {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px ${accent ? accent + '44' : c.border}`,
    } : {
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }),
    ...style,
  };
  return (
    <div style={base} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick?.()} tabIndex={tabIndex}>
      {children}
    </div>
  );
}

// ── XPBar — spring-fill on mount (CSS transition) ─────────────────────────────
// Reanimated equiv: withSpring(pct, { stiffness: 120, damping: 14 })
function XPBar({ pct, color, height = 8, bg, label, c }) {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted }}>{label}</span>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: color, fontWeight: 600 }}>{Math.round(pct * 100)}%</span>
        </div>
      )}
      <div style={{ background: bg || c.border, borderRadius: 999, height, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          width: `${width * 100}%`,
          transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
    </div>
  );
}

// ── LevelRing — SVG arc + conic gradient on level-up (1.2s) ──────────────────
// Reanimated equiv: conic gradient sweep with withTiming(360, { duration: 1200 })
function LevelRing({ xp, size = 80, c, showLabel = true }) {
  const { level, pct } = LIFEOS.xpProgressInLevel(xp);
  const sw = size * 0.085;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const [animPct, setAnimPct] = React.useState(0);
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setAnimPct(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  const dash = circ * animPct;
  const fontSize = size * 0.28;
  const subSize = size * 0.13;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.border} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={c.primary} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
      </svg>
      {showLabel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize, color: c.textPrimary, lineHeight: 1 }}>{level}</span>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: subSize, color: c.textMuted, letterSpacing: 1 }}>LVL</span>
        </div>
      )}
    </div>
  );
}

// ── AvatarRing — level ring with initials inside ──────────────────────────────
function AvatarRing({ xp, initials, size = 80, c }) {
  const { level, pct } = LIFEOS.xpProgressInLevel(xp);
  const sw = size * 0.075;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const [animPct, setAnimPct] = React.useState(0);
  React.useEffect(() => { const t = requestAnimationFrame(() => setAnimPct(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  const dash = circ * animPct;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.border} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.primary} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: sw, borderRadius: '50%', background: c.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: size * 0.22, color: '#fff', lineHeight: 1 }}>{initials}</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: size * 0.11, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>Lv{level}</span>
      </div>
    </div>
  );
}

// ── StreakFlame — scale pulse on increment (300ms) ────────────────────────────
// Reanimated equiv: withSequence(withTiming(1.15, {dur:150}), withTiming(1.0, {dur:150}))
function StreakFlame({ count, graceUsed, size = 'md', c }) {
  const sizes = { sm: { flame: 20, text: 13 }, md: { flame: 28, text: 16 }, lg: { flame: 40, text: 22 } };
  const s = sizes[size] || sizes.md;
  const opacity = graceUsed ? 0.45 : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity }}>
      <span style={{ fontSize: s.flame, lineHeight: 1, animation: 'flamePulse 2s ease-in-out infinite' }}>🔥</span>
      <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: s.text, color: c.streak, lineHeight: 1 }}>{count}</span>
      {graceUsed && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, marginLeft: 2 }}>grace</span>}
    </div>
  );
}

// ── XP Chip ───────────────────────────────────────────────────────────────────
function XPChip({ amount, c }) {
  return (
    <span style={{
      fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 12,
      color: c.xp, background: c.xp + '22', border: `1px solid ${c.xp}44`,
      borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>+{amount} XP</span>
  );
}

// ── QuestCard — progress + checkmark morph on complete (600ms) ────────────────
function QuestCard({ quest, c, compact = false }) {
  const { MODULE_META } = LIFEOS;
  const meta = MODULE_META[quest.module] || {};
  const color = c[meta.colorKey] || c.primary;
  const pct = quest.progress / quest.total;
  const done = pct >= 1;
  const [completed, setCompleted] = React.useState(done);
  return (
    <Card c={c} accent={color} style={{ padding: compact ? '14px 16px' : '16px 20px' }}
      onClick={() => !completed && setCompleted(true)} tabIndex={0}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {meta.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: compact ? 13 : 14, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quest.title}</span>
            <XPChip amount={quest.xp} c={c} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: c.border, borderRadius: 999, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: color, borderRadius: 999, width: `${pct * 100}%`, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, flexShrink: 0 }}>{quest.progress}/{quest.total}</span>
          </div>
        </div>
        <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${completed ? color : c.border}`, background: completed ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s ease', marginTop: 6 }}>
          {completed && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
        </div>
      </div>
    </Card>
  );
}

// ── BadgeCard ─────────────────────────────────────────────────────────────────
function BadgeCard({ badgeId, earned, c }) {
  const meta = LIFEOS.BADGE_META[badgeId] || {};
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      tabIndex={0} role="button"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: c.card, border: `1px solid ${earned ? c.badge + '44' : c.border}`,
        borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        cursor: 'pointer', transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
        ...(hovered ? { transform: 'translateY(-2px)', boxShadow: `0 8px 24px rgba(0,0,0,0.2)` } : {}),
        opacity: earned ? 1 : 0.45, position: 'relative',
      }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: earned ? `radial-gradient(circle, ${c.badge}33, ${c.badge}11)` : c.border + '44',
        border: `2px solid ${earned ? c.badge + '66' : c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
        boxShadow: earned && hovered ? `0 0 20px ${c.badge}55` : 'none',
        transition: 'box-shadow 0.2s',
      }}>
        {earned ? meta.emoji : '🔒'}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13, color: c.textPrimary, marginBottom: 4 }}>{meta.label}</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: c.textMuted, lineHeight: 1.4 }}>{meta.desc}</div>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r={3} fill={color} />
    </svg>
  );
}

// ── DomainMiniCard ─────────────────────────────────────────────────────────────
// ~280×140px — embeddable on module pages
function DomainMiniCard({ domainKey, score, delta, xpHistory, c, onClick }) {
  const dm = LIFEOS.DOMAIN_META.find(d => d.key === domainKey) || {};
  const color = c[dm.colorKey] || c.primary;
  const deltaPositive = delta >= 0;
  return (
    <Card c={c} accent={color} style={{ width: 280, minHeight: 140, padding: '16px 20px', cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick} tabIndex={onClick ? 0 : undefined}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{dm.emoji}</div>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13, color: c.textSecondary }}>{dm.label}</div>
            <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 22, color: c.textPrimary, lineHeight: 1 }}>{score}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: deltaPositive ? c.success : c.error, background: (deltaPositive ? c.success : c.error) + '22', borderRadius: 999, padding: '2px 7px' }}>
            {deltaPositive ? '↑' : '↓'}{Math.abs(delta)}
          </span>
          <Sparkline data={xpHistory} color={color} />
        </div>
      </div>
      <XPBar pct={score / 100} color={color} height={5} c={c} />
    </Card>
  );
}

// ── HexRadar ──────────────────────────────────────────────────────────────────
// 420px square at desktop, scales via CSS; SVG-only, no external deps
function HexRadar({ scores, size = 420, c, onDomainClick, activeDomain }) {
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.34;
  const labelR = maxR + size * 0.1;
  const rings = [0.25, 0.5, 0.75, 1.0];
  const domains = LIFEOS.DOMAIN_META;
  const toRad = deg => (deg * Math.PI) / 180;
  const pt = (angleDeg, r) => ({ x: cx + r * Math.cos(toRad(angleDeg)), y: cy + r * Math.sin(toRad(angleDeg)) });
  const hexPath = (pct) => domains.map((d, i) => { const p = pt(d.angle, maxR * pct); return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(' ') + 'Z';
  const dataPath = domains.map((d, i) => { const s = (scores[d.key] || 0) / 100; const p = pt(d.angle, maxR * Math.max(0.02, s)); return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(' ') + 'Z';
  const avg = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length);
  const dotSize = score => 4 + (score / 100) * 5;

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Ring labels */}
      {[25, 50, 75].map(v => {
        const p = pt(-90, maxR * v / 100);
        return <text key={v} x={p.x + 4} y={p.y} fontFamily="DM Sans,sans-serif" fontSize={10} fill={c.textMuted} dominantBaseline="middle">{v}</text>;
      })}

      {/* Background rings */}
      {rings.map((pct, i) => (
        <path key={i} d={hexPath(pct)} fill={i === 3 ? c.primary + '06' : 'none'} stroke={c.border} strokeWidth={i === 3 ? 1.5 : 1} opacity={0.5 + i * 0.1} />
      ))}

      {/* Axis lines */}
      {domains.map(d => {
        const outer = pt(d.angle, maxR);
        return <line key={d.key} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke={c.border} strokeWidth={1} opacity={0.35} />;
      })}

      {/* Data polygon fill + stroke */}
      <path d={dataPath} fill={c.primary} fillOpacity={0.18} stroke={c.primary} strokeWidth={2} />

      {/* Domain dots + glow ring */}
      {domains.map(d => {
        const score = scores[d.key] || 0;
        const pos = pt(d.angle, maxR * Math.max(0.02, score / 100));
        const color = c[d.colorKey];
        const isActive = activeDomain === d.key;
        const ds = dotSize(score);
        return (
          <g key={d.key} onClick={() => onDomainClick?.(d.key)} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onDomainClick?.(d.key)}>
            <circle cx={pos.x} cy={pos.y} r={ds + 8} fill={color} opacity={0.15 + (isActive ? 0.15 : 0)} />
            <circle cx={pos.x} cy={pos.y} r={ds} fill={color} stroke={isActive ? '#fff' : color} strokeWidth={isActive ? 2 : 0} />
          </g>
        );
      })}

      {/* Domain labels */}
      {domains.map(d => {
        const pos = pt(d.angle, labelR);
        const score = scores[d.key] || 0;
        const color = c[d.colorKey];
        return (
          <g key={d.key + '_lbl'}>
            <text x={pos.x} y={pos.y - 7} textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize={13} fill={color} fontWeight={600}>{d.emoji} {d.label}</text>
            <text x={pos.x} y={pos.y + 9} textAnchor="middle" fontFamily="Nunito,sans-serif" fontSize={14} fill={c.textSecondary} fontWeight={700}>{score}</text>
          </g>
        );
      })}

      {/* Center score */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="Nunito,sans-serif" fontWeight={800} fontSize={60} fill={c.textPrimary}>{avg}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize={13} fill={c.textMuted} letterSpacing={1}>LIFE SCORE</text>
    </svg>
  );
}

Object.assign(window, { Card, XPBar, LevelRing, AvatarRing, StreakFlame, XPChip, QuestCard, BadgeCard, Sparkline, DomainMiniCard, HexRadar });
