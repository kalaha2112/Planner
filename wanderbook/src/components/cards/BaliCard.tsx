export default function BaliCard() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      {/* BALI — enormous, centred vertically, bleeds both sides */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0,
        transform: 'translateY(-54%)', zIndex: 3,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '100px', lineHeight: 1, letterSpacing: '4px',
        color: '#1a1a1a', textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        BALI
      </div>

      {/* Indonesia — vertical right edge, tiny spaced caps */}
      <div style={{
        position: 'absolute', top: 0, right: '22px', bottom: 0, zIndex: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          writingMode: 'vertical-rl',
          fontFamily: "'DM Sans', sans-serif", fontSize: '7px',
          letterSpacing: '3px', color: '#91040C', textTransform: 'uppercase',
          fontWeight: 400, transform: 'rotate(180deg)',
        }}>
          Indonesia
        </div>
      </div>
    </div>
  );
}
