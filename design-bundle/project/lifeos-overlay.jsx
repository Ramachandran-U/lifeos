// ─── Level-Up Overlay ─────────────────────────────────────────────────────────
// Spring-in from scale 0.85, 800ms — Reanimated equiv: withSpring(1, { stiffness: 120, damping: 14 })

function LevelUpOverlay({ c, onClose }) {
  const newLevel = LIFEOS.xpProgressInLevel(LIFEOS.MOCK.totalXP).level;
  const perks = LIFEOS.MOCK.levelPerks[newLevel] || ['New features unlocked', 'Keep going!'];
  const [visible, setVisible] = React.useState(false);
  const [claiming, setClaiming] = React.useState(false);

  React.useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(t); window.removeEventListener('keydown', onKey); };
  }, []);

  const handleClaim = () => {
    setClaiming(true);
    setTimeout(onClose, 600);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: c.card, border: `1px solid ${c.primary}44`,
          borderRadius: 28, padding: '48px 40px 40px',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          transform: visible ? 'scale(1)' : 'scale(0.85)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
          boxShadow: `0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px ${c.primary}33`,
        }}>

        {/* Conic burst background */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 28,
          background: `conic-gradient(from 0deg at 50% 40%, ${c.primary}00 0%, ${c.primary}18 10%, ${c.primary}00 20%, ${c.career}18 30%, ${c.career}00 40%, ${c.badge}18 50%, ${c.badge}00 60%, ${c.primary}18 70%, ${c.primary}00 80%, ${c.career}18 90%, ${c.career}00 100%)`,
          pointerEvents: 'none', opacity: visible ? 1 : 0, transition: 'opacity 1s',
        }} />

        {/* Confetti dots */}
        {visible && [c.primary, c.badge, c.xp, c.health, c.goal, c.social].map((col, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: `${10 + (i * 12) % 60}%`,
            left: `${5 + (i * 17) % 90}%`,
            width: 6, height: 6, borderRadius: '50%', background: col,
            opacity: 0.6,
            animation: `confettiFall ${1 + i * 0.2}s ease-out forwards`,
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}

        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: c.textMuted, fontSize: 18, cursor: 'pointer', padding: 4, borderRadius: 8, lineHeight: 1 }}>✕</button>

        {/* Level number */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{
            fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 120, lineHeight: 1,
            background: `linear-gradient(135deg, ${c.primary}, ${c.badge})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: visible ? 'levelNumPop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' : 'none',
          }}>{newLevel}</div>
        </div>

        <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, color: c.textMuted, letterSpacing: 2, marginBottom: 8 }}>LEVEL UP</div>
        <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 28, color: c.textPrimary, marginBottom: 6 }}>Congratulations, {LIFEOS.MOCK.user.name.split(' ')[0]}!</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 1.5 }}>
          You've reached Level {newLevel}. Here's what you've unlocked:
        </div>

        {/* Perks list */}
        <div style={{ background: c.surface, borderRadius: 16, padding: '20px 24px', marginBottom: 32, textAlign: 'left' }}>
          {perks.map((perk, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < perks.length - 1 ? `1px solid ${c.border}` : 'none', animation: `fadeInUp 0.4s ease-out ${0.5 + i * 0.1}s both` }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: c.primary + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✨</div>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: c.textPrimary, fontWeight: 500 }}>{perk}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleClaim()}
          onClick={handleClaim}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14,
            background: claiming ? c.success : `linear-gradient(135deg, ${c.primary}, ${c.badge})`,
            border: 'none', color: '#fff',
            fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 18,
            cursor: 'pointer', transition: 'background 0.4s ease, transform 0.15s',
            boxShadow: `0 4px 20px ${c.primary}44`,
            letterSpacing: 0.5,
          }}>
          {claiming ? '✓ Claimed!' : 'Claim +200 XP'}
        </button>

        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: c.textMuted, marginTop: 12 }}>
          Press <kbd style={{ background: c.border, borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>Esc</kbd> or click outside to dismiss
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LevelUpOverlay });
