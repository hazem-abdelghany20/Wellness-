import { useEffect, useState } from 'react';

export function Confetti({ theme, run }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!run) return;
    const colors = [theme.accent, theme.positive, theme.info, theme.text];
    const n = 36;
    const p = Array.from({ length: n }, (_, i) => ({
      id: i + '-' + Date.now(),
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50 + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 140,
      vy: -80 - Math.random() * 120,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 360,
      color: colors[i % colors.length],
      shape: i % 3,
      size: 5 + Math.random() * 7,
    }));
    setParticles(p);
    const t = setTimeout(() => setParticles([]), 2200);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.shape === 1 ? p.size * 0.5 : p.size,
          background: p.color, borderRadius: p.shape === 2 ? '50%' : 2,
          animation: `confetti-${p.id} 1.8s cubic-bezier(.2,.6,.4,1) forwards`,
          transform: `translate(-50%,-50%) rotate(${p.rot}deg)`,
        }}>
          <style>{`
            @keyframes confetti-${p.id} {
              0% { transform: translate(-50%, -50%) rotate(${p.rot}deg); opacity: 1; }
              100% { transform: translate(calc(-50% + ${p.vx * 2}px), calc(-50% + ${p.vy * 3}px + 220px)) rotate(${p.rot + p.vr}deg); opacity: 0; }
            }
          `}</style>
        </div>
      ))}
    </div>
  );
}
