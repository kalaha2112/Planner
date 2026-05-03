export default function LisbonCard() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      {/* LIS — top, right-aligned, display bold */}
      <div style={{
        position: 'absolute', top: '16px', right: '24px', zIndex: 3,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '78px', lineHeight: 1, letterSpacing: '2px',
        color: '#1a1a1a', textAlign: 'right',
      }}>
        LIS
      </div>

      {/* Bold horizontal rule — bisects the card */}
      <div style={{
        position: 'absolute', top: '94px', left: 0, right: 0, height: '2px',
        background: '#23140C', zIndex: 5,
      }} />

      {/* bon — bottom, left-aligned, italic serif */}
      <div style={{
        position: 'absolute', bottom: '16px', left: '24px', zIndex: 3,
        fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
        fontWeight: 700, fontSize: '72px', lineHeight: 1, letterSpacing: '-1px',
        color: '#1a1a1a',
      }}>
        bon
      </div>

      {/* Circle — straddles the rule, bridges both halves */}
      <div style={{
        position: 'absolute', top: '56px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 6,
        width: '78px', height: '78px', borderRadius: '50%',
        border: '2px solid #23140C', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: '7px',
          letterSpacing: '2px', color: '#aaa', textTransform: 'uppercase',
          textAlign: 'center', lineHeight: 1.4,
        }}>
          Por<br />tugal
        </div>
      </div>

      {/* Upcoming dot — bottom right */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '24px', zIndex: 4,
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#91040C',
      }} />
    </div>
  );
}
