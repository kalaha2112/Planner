import Image from 'next/image';

export default function ParisCard() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      {/* Eiffel sticker — right edge, overflows top */}
      <Image
        src="/assets/eiffel.png"
        alt=""
        width={120}
        height={206}
        style={{
          position: 'absolute',
          right: '-6px', top: '-24px',
          height: '206px', width: 'auto',
          objectFit: 'contain',
          zIndex: 2,
          pointerEvents: 'none',
          opacity: 0.9,
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.08))',
        }}
      />

      {/* PARIS — giant serif, anchored bottom-left */}
      <div style={{
        position: 'absolute', bottom: '4px', left: '22px', zIndex: 3,
        fontFamily: "'Playfair Display', serif", fontWeight: 900,
        fontSize: '78px', lineHeight: 1, letterSpacing: '-2px',
        color: '#1a1a1a', whiteSpace: 'nowrap',
      }}>
        PARIS
      </div>
    </div>
  );
}
