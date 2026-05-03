'use client';

import { fonts, colors } from '@/styles/tokens';

interface BookCoverProps {
  isOpen: boolean;
  onOpen: () => void;
}

export default function BookCover({ isOpen, onOpen }: BookCoverProps) {
  return (
    <div
      className={`book-cover${isOpen ? ' flipped' : ''}`}
      onClick={onOpen}
    >
      {/* Front face */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: colors.surface,
          borderRadius: '1px',
          backfaceVisibility: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            fontFamily: fonts.handwriting,
            fontStyle: 'italic',
            fontSize: '16px',
            fontWeight: 300,
            color: colors.inkPrimary,
            textAlign: 'center',
            lineHeight: 1.6,
            padding: '0 24px',
            userSelect: 'none',
          }}
        >
          Where will you be<br />
          <span
            style={{
              display: 'inline',
              cursor: 'pointer',
              borderBottom: `1px solid rgba(145,4,12,0.35)`,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(145,4,12,0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(145,4,12,0.35)')}
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
          >
            off to next?
          </span>
        </p>
      </div>

      {/* Back face (underside — visible during flip) */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: '#f8f8f8',
          borderRadius: '1px',
          backfaceVisibility: 'hidden',
          transform: 'rotateX(180deg)',
        }}
      />
    </div>
  );
}
