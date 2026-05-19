import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useTripStore, PageState } from '../store/tripStore';

const ANIM_LOCK_MS  = 740;
const OPEN_SETTLE_MS = 700;
const CLOSE_MS      = 900;

const DEG: Record<PageState, number> = {
  waiting:       88,
  incoming:      42,
  active:         0,
  'flipping-up': -180,
  past:          -180,
};

export function usePageFlip() {
  const {
    isOpen, isAnimating, activeIdx, pageStates, trips,
    setOpen, setAnimating, setActiveIdx, setPageState, setAllPageStates,
  } = useTripStore();

  const n = trips.length;

  // Keep pageAnims exactly in sync with trip count (grow AND shrink)
  const pageAnims = useRef<Animated.Value[]>([]).current;
  while (pageAnims.length < n) pageAnims.push(new Animated.Value(DEG.waiting));
  while (pageAnims.length > n) pageAnims.pop();

  const coverAnim = useRef(new Animated.Value(0)).current;

  const animatePage = useCallback(
    (i: number, state: PageState, delay = 0, springy = false) => {
      if (i < 0 || i >= pageAnims.length) return;
      const toValue = DEG[state];
      const anim = springy
        ? Animated.spring(pageAnims[i], {
            toValue,
            damping: 20,
            stiffness: 140,
            useNativeDriver: true,
          })
        : Animated.timing(pageAnims[i], {
            toValue,
            duration: 720,
            delay,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          });
      anim.start();
      setPageState(i, state);
    },
    [pageAnims, setPageState]
  );

  const openBook = useCallback(() => {
    if (isOpen || isAnimating || n === 0) return;
    setAnimating(true);
    setOpen(true);

    // Show the most relevant page: first 'now', then first 'upcoming', then last
    const nowIdx      = trips.findIndex((t) => t.status === 'now');
    const upcomingIdx = trips.findIndex((t) => t.status === 'upcoming');
    const startIdx    = nowIdx !== -1 ? nowIdx
                      : upcomingIdx !== -1 ? upcomingIdx
                      : n - 1;
    setActiveIdx(startIdx);

    Animated.timing(coverAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      for (let i = 0; i < n; i++) {
        if (i < startIdx)      animatePage(i, 'past');
        else if (i === startIdx) animatePage(i, 'active');
        else                   animatePage(i, 'waiting');
      }
    }, 200);

    setTimeout(() => setAnimating(false), OPEN_SETTLE_MS);
  }, [isOpen, isAnimating, n, trips, coverAnim, animatePage, setOpen, setActiveIdx, setAnimating]);

  const closeBook = useCallback(() => {
    if (!isOpen || isAnimating) return;
    setAnimating(true);
    setOpen(false);

    for (let i = 0; i < n; i++) animatePage(i, 'waiting');

    setTimeout(() => {
      Animated.timing(coverAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start();
    }, 80);

    setTimeout(() => {
      setActiveIdx(0);
      pageAnims.forEach((a) => a.setValue(DEG.waiting));
      // pageAnims.length === n (kept in sync), so this matches trips.length exactly
      setAllPageStates(Array(pageAnims.length).fill('waiting') as PageState[]);
      setAnimating(false);
    }, CLOSE_MS);
  }, [isOpen, isAnimating, n, coverAnim, pageAnims, animatePage, setOpen, setActiveIdx, setAllPageStates, setAnimating]);

  const goNext = useCallback(() => {
    if (!isOpen || isAnimating || activeIdx >= n - 1) return;
    setAnimating(true);

    const cur  = activeIdx;
    const next = activeIdx + 1;

    animatePage(cur, 'flipping-up');

    pageAnims[next].setValue(DEG.incoming);
    setPageState(next, 'incoming');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      animatePage(next, 'active');
    }));

    setTimeout(() => {
      setPageState(cur, 'past');
      setActiveIdx(next);
      setAnimating(false);
    }, ANIM_LOCK_MS);
  }, [isOpen, isAnimating, activeIdx, n, pageAnims, animatePage, setActiveIdx, setAnimating, setPageState]);

  const goPrev = useCallback(() => {
    if (!isOpen || isAnimating || activeIdx <= 0) return;
    setAnimating(true);

    const cur  = activeIdx;
    const prev = activeIdx - 1;

    animatePage(cur, 'waiting');

    pageAnims[prev].setValue(DEG['flipping-up']);
    setPageState(prev, 'flipping-up');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      animatePage(prev, 'active', 0, true);
    }));

    setTimeout(() => {
      setActiveIdx(prev);
      setAnimating(false);
    }, ANIM_LOCK_MS);
  }, [isOpen, isAnimating, activeIdx, pageAnims, animatePage, setActiveIdx, setAnimating, setPageState]);

  const jumpTo = useCallback((idx: number) => {
    if (!isOpen || isAnimating || idx === activeIdx) return;
    if (idx > activeIdx) goNext();
    else goPrev();
  }, [isOpen, isAnimating, activeIdx, goNext, goPrev]);

  return {
    isOpen, isAnimating, activeIdx, pageStates,
    coverAnim, pageAnims,
    openBook, closeBook, goNext, goPrev, jumpTo,
  };
}
