'use client';

import { PageState } from '@/store/tripStore';
import ParisCard   from './cards/ParisCard';
import KyotoCard   from './cards/KyotoCard';
import BaliCard    from './cards/BaliCard';
import MoroccoCard from './cards/MoroccoCard';
import LisbonCard  from './cards/LisbonCard';

const CARD_COMPONENTS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard];

interface TripPageProps {
  index: number;
  cardDesign: 0 | 1 | 2 | 3 | 4;
  pageState: PageState;
  hasTransition: boolean;
}

export default function TripPage({ index, cardDesign, pageState, hasTransition }: TripPageProps) {
  const Card = CARD_COMPONENTS[cardDesign];

  const zIndex =
    pageState === 'active'      ? 15 :
    pageState === 'flipping-up' ? 16 :
    pageState === 'incoming'    ? 14 :
    pageState === 'past'        ? index + 1 :
    2;

  return (
    <div
      className={[
        'trip-page',
        `state-${pageState}`,
        !hasTransition ? 'no-transition' : '',
      ].filter(Boolean).join(' ')}
      style={{ zIndex }}
    >
      {/* Page inner — white card */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: '#ffffff',
          borderRadius: '1px',
          backfaceVisibility: 'hidden',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        {/* Top edge highlight */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '1px', background: 'rgba(0,0,0,0.06)', zIndex: 5,
        }} />

        <Card />

        {/* Page number */}
        <div style={{
          position: 'absolute', top: '8px', right: '12px',
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic', fontSize: '10px',
          color: '#ccc', zIndex: 4,
        }}>
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
