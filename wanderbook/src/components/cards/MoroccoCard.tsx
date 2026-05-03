export default function MoroccoCard() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      {/* Ghost M — bleeds top-left */}
      <div style={{
        position: 'absolute', top: '-22px', left: '-8px', zIndex: 1,
        fontFamily: "'Playfair Display', serif", fontWeight: 900,
        fontSize: '170px', lineHeight: 1,
        color: 'rgba(0,0,0,0.03)', userSelect: 'none', pointerEvents: 'none',
      }}>
        M
      </div>

      {/* MO — display bold top-left */}
      <div style={{
        position: 'absolute', top: '22px', left: '24px', zIndex: 4,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '54px', lineHeight: 0.9, letterSpacing: '1px',
        color: '#1a1a1a',
      }}>
        MO
      </div>

      {/* rocco — italic serif, offset right, creates visual collision */}
      <div style={{
        position: 'absolute', top: '64px', left: '32px', zIndex: 4,
        fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
        fontWeight: 400, fontSize: '48px', lineHeight: 0.9,
        letterSpacing: '-0.5px', color: '#1a1a1a',
      }}>
        rocco
      </div>

      {/* Diagonal ink slash */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}
        viewBox="0 0 280 188"
        fill="none"
      >
        <line x1="8" y1="120" x2="200" y2="50" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round" opacity="0.18" />
      </svg>

      {/* Amber circle outline — top right, interactive accent */}
      <div style={{
        position: 'absolute', top: '20px', right: '22px', zIndex: 5,
        width: '24px', height: '24px', borderRadius: '50%',
        border: '1.5px solid #91040C', background: 'transparent',
      }} />

      {/* Marrakech — tiny spaced caps bottom-left */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '24px', zIndex: 4,
        fontFamily: "'DM Sans', sans-serif", fontSize: '7px',
        letterSpacing: '3px', color: '#bbb', textTransform: 'uppercase',
      }}>
        Marrakech
      </div>
    </div>
  );
}
