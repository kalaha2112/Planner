'use client';

import { useCallback, useEffect } from 'react';
import { useTripStore } from '@/store/tripStore';
import { timings } from '@/styles/tokens';

const TRIP_COUNT = 5;

export function usePageFlip() {
  const {
    isOpen, isAnimating, activeIdx,
    setOpen, setAnimating, setActiveIdx,
    setPageState, setPageTransition,
    pageStates,
  } = useTripStore();

  const openBook = useCallback(() => {
    if (isOpen || isAnimating) return;
    setAnimating(true);
    setOpen(true);

    // Pages rise after cover begins flipping
    setTimeout(() => {
      setPageState(activeIdx, 'active');
      for (let i = 0; i < TRIP_COUNT; i++) {
        if (i < activeIdx) setPageState(i, 'past');
        if (i > activeIdx) setPageState(i, 'waiting');
      }
    }, 200);

    setTimeout(() => {
      setAnimating(false);
    }, timings.openSettle);
  }, [isOpen, isAnimating, activeIdx, setOpen, setAnimating, setPageState]);

  const closeBook = useCallback(() => {
    if (!isOpen || isAnimating) return;
    setAnimating(true);
    setOpen(false);

    for (let i = 0; i < TRIP_COUNT; i++) setPageState(i, 'waiting');

    setTimeout(() => {
      // cover un-flips after pages drop
    }, 80);

    setTimeout(() => {
      setActiveIdx(1);
      setAnimating(false);
    }, timings.coverFlip);
  }, [isOpen, isAnimating, setOpen, setAnimating, setActiveIdx, setPageState]);

  const goNext = useCallback(() => {
    if (!isOpen || isAnimating || activeIdx >= TRIP_COUNT - 1) return;
    setAnimating(true);

    const cur  = activeIdx;
    const next = activeIdx + 1;

    setPageState(cur, 'flipping-up');
    setPageState(next, 'incoming');

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setPageState(next, 'active');
      })
    );

    setTimeout(() => {
      setPageState(cur, 'past');
      setActiveIdx(next);
      setAnimating(false);
    }, timings.animLock);
  }, [isOpen, isAnimating, activeIdx, setAnimating, setActiveIdx, setPageState]);

  const goPrev = useCallback(() => {
    if (!isOpen || isAnimating || activeIdx <= 0) return;
    setAnimating(true);

    const cur  = activeIdx;
    const prev = activeIdx - 1;

    setPageState(cur, 'waiting');

    // Instant-position the prev page at flipping-up, then animate forward
    setPageTransition(prev, false);
    setPageState(prev, 'flipping-up');

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setPageTransition(prev, true);
        setPageState(prev, 'active');
      })
    );

    setTimeout(() => {
      setActiveIdx(prev);
      setAnimating(false);
    }, timings.animLock);
  }, [isOpen, isAnimating, activeIdx, setAnimating, setActiveIdx, setPageState, setPageTransition]);

  const jumpTo = useCallback((idx: number) => {
    if (!isOpen || isAnimating || idx === activeIdx) return;
    if (idx > activeIdx) goNext();
    else goPrev();
  }, [isOpen, isAnimating, activeIdx, goNext, goPrev]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  return { isOpen, isAnimating, activeIdx, pageStates, openBook, closeBook, goNext, goPrev, jumpTo };
}
