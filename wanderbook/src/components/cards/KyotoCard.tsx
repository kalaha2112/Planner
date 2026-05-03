export default function KyotoCard() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      {/* Ghost watermark */}
      <div style={{
        position: 'absolute', top: '-12px', left: '-6px', zIndex: 1,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '128px', lineHeight: 0.82, letterSpacing: '-2px',
        color: 'rgba(0,0,0,0.033)', userSelect: 'none', pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        KY<br />OTO
      </div>

      {/* Accent dot — top right */}
      <div style={{
        position: 'absolute', top: '18px', right: '20px', zIndex: 5,
        width: '7px', height: '7px', borderRadius: '50%',
        background: '#23140C',
      }} />

      {/* Kyoto — bold serif top-left */}
      <div style={{
        position: 'absolute', top: '22px', left: '24px', zIndex: 4,
        fontFamily: "'Playfair Display', serif", fontWeight: 900,
        fontSize: '54px', lineHeight: 0.88, letterSpacing: '-1.5px',
        color: '#1a1a1a',
      }}>
        Kyoto
      </div>

      {/* Japan — italic light, bottom-right */}
      <div style={{
        position: 'absolute', bottom: '18px', right: '24px', zIndex: 4,
        fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
        fontWeight: 300, fontSize: '28px', lineHeight: 1,
        color: '#1a1a1a', letterSpacing: '0.5px',
      }}>
        Japan
      </div>
    </div>
  );
}
