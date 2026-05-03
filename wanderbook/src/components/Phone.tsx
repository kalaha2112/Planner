'use client';

import { useCallback, useRef } from 'react';
import { usePageFlip } from '@/hooks/usePageFlip';
import { useTripStore } from '@/store/tripStore';
import BookCover   from './BookCover';
import BookOutline from './BookOutline';
import TripPage    from './TripPage';
import PageDots    from './nav/PageDots';
import NavBar      from './nav/NavBar';

const SWIPE_THRESHOLD = 38;

export default function Phone() {
  const { isOpen, isAnimating, activeIdx, pageStates, openBook, closeBook, goNext, goPrev, jumpTo } = usePageFlip();
  const { trips, pageTransitions } = useTripStore();

  const dragY = useRef<number | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => { dragY.current = e.clientY; }, []);
  const onMouseUp   = useCallback((e: React.MouseEvent) => {
    if (dragY.current === null) return;
    const d = dragY.current - e.clientY;
    if (d > SWIPE_THRESHOLD) goNext();
    else if (d < -SWIPE_THRESHOLD) goPrev();
    dragY.current = null;
  }, [goNext, goPrev]);

  const onTouchStart = useCallback((e: React.TouchEvent) => { dragY.current = e.touches[0].clientY; }, []);
  const onTouchEnd   = useCallback((e: React.TouchEvent) => {
    if (dragY.current === null) return;
    const d = dragY.current - e.changedTouches[0].clientY;
    if (d > SWIPE_THRESHOLD) goNext();
    else if (d < -SWIPE_THRESHOLD) goPrev();
    dragY.current = null;
  }, [goNext, goPrev]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 20) goNext();
    else if (e.deltaY < -20) goPrev();
  }, [goNext, goPrev]);

  return (
    /* Phone shell */
    <div style={{
      width: '375px', height: '812px',
      background: '#ffffff',
      borderRadius: '48px',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)',
    }}>
      {/* Phone chrome ring */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '48px',
        border: '1px solid rgba(0,0,0,0.05)',
        pointerEvents: 'none',
        zIndex: 999,
      }} />

      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 300,
        padding: '14px 28px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
          9:41
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[10, 14, 18].map((h, i) => (
            <div key={i} style={{ width: '3px', height: `${h}px`, background: '#1a1a1a', borderRadius: '1px' }} />
          ))}
        </div>
      </div>

      {/* Stage */}
      <div style={{
        position: 'absolute', inset: 0, background: '#ffffff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Cover label */}
        <div className={`cover-label${isOpen ? ' hidden' : ''}`}>
          your travel journal
        </div>

        {/* Book wrap — perspective host */}
        <div
          style={{ position: 'relative', width: '280px', height: '188px', perspective: '1400px', cursor: 'pointer' }}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
        >
          {/* SVG sketch outline */}
          <BookOutline />

          {/* Page stack — behind cover */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            {trips.map((trip, i) => (
              <TripPage
                key={trip.id}
                index={i}
                cardDesign={trip.cardDesign}
                pageState={pageStates[i]}
                hasTransition={pageTransitions[i]}
              />
            ))}
          </div>

          {/* Book cover — on top */}
          <BookCover isOpen={isOpen} onOpen={openBook} />
        </div>

        {/* Footer — dots + close */}
        <div className={`book-footer${isOpen ? ' visible' : ''}`}>
          <PageDots count={trips.length} activeIdx={activeIdx} onDotClick={jumpTo} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
                        fontSize: '8px', letterSpacing: '2.5px', color: '#ccc', textTransform: 'uppercase' }}>
            <div style={{ width: '18px', height: '1px', background: '#ddd' }} />
            swipe to turn page
            <div style={{ width: '18px', height: '1px', background: '#ddd' }} />
          </div>
          <button
            onClick={closeBook}
            style={{
              fontSize: '9px', letterSpacing: '1.5px', color: '#bbb', textTransform: 'uppercase',
              background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
          >
            close book
          </button>
        </div>
      </div>

      {/* Bottom nav bar */}
      <NavBar isVisible={isOpen} />
    </div>
  );
}
