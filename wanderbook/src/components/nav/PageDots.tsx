'use client';

interface PageDotsProps {
  count: number;
  activeIdx: number;
  onDotClick: (i: number) => void;
}

export default function PageDots({ count, activeIdx, onDotClick }: PageDotsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`page-dot${i === activeIdx ? ' active' : ''}`}
          onClick={() => onDotClick(i)}
        />
      ))}
    </div>
  );
}
