import { create } from 'zustand';

export type PageState = 'waiting' | 'active' | 'flipping-up' | 'past' | 'incoming';

export interface CardElement {
  id: string;
  type: 'image' | 'text' | 'path';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex?: number;
  // image
  uri?: string;
  width?: number;
  height?: number;
  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  // path
  pathD?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  draggable?: boolean;
}

export interface StickerTemplate {
  id: string;
  uri: string;
}

export interface Trip {
  id: string;
  name: string;
  country: string;
  status: 'past' | 'now' | 'upcoming';
  cardDesign: 0 | 1 | 2 | 3 | 4;
  titleFont: string;
  customName?: string;
  customCountry?: string;
  notes?: string;
  dateRange?: string;
  daysAway?: string;
  budgetTotal?: number;
  budgetSpent?: number;
  hotelLocation?: string;
  hotelNights?: number;
  itinerary?: string[][];
  flightFrom?: string;
  flightTo?: string;
  flightDate?: string;
  flightNumber?: string;
  countries?: string[];
  cities?: string[][];
  elements: CardElement[];
}

interface AppState {
  isOpen: boolean;
  activeIdx: number;
  isAnimating: boolean;
  pageStates: PageState[];
  trips: Trip[];
  stickerTemplates: StickerTemplate[];

  setOpen: (v: boolean) => void;
  setActiveIdx: (i: number) => void;
  setAnimating: (v: boolean) => void;
  setPageState: (i: number, state: PageState) => void;
  setAllPageStates: (states: PageState[]) => void;
  updateTrip: (id: string, patch: Partial<Pick<Trip,
    'customName' | 'customCountry' | 'titleFont' | 'notes' |
    'dateRange' | 'daysAway' | 'budgetTotal' | 'budgetSpent' |
    'hotelLocation' | 'hotelNights' | 'itinerary' |
    'flightFrom' | 'flightTo' | 'flightDate' | 'flightNumber' |
    'countries' | 'cities'
  >>) => void;
  addElement: (tripId: string, el: CardElement) => void;
  updateElement: (tripId: string, id: string, patch: Partial<CardElement>) => void;
  removeElement: (tripId: string, id: string) => void;
  setElements: (tripId: string, elements: CardElement[]) => void;
  addStickerTemplate: (t: StickerTemplate) => void;
  removeStickerTemplate: (id: string) => void;
  addTrip: (trip: Trip) => void;
  removeTrip: (id: string) => void;
}

// Parse a dateRange string like "May 15 – 22, 2026" into a sortable number.
// Returns 0 if unparseable (sorts to front of its status group).
function parseDateKey(dateRange?: string): number {
  if (!dateRange) return 0;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const m = dateRange.match(/(\w+)\s+(\d+)/i);
  const y = dateRange.match(/(\d{4})/);
  if (!m || !y) return 0;
  const mi = months.indexOf(m[1].toLowerCase().slice(0, 3));
  if (mi === -1) return 0;
  return parseInt(y[1]) * 10000 + (mi + 1) * 100 + parseInt(m[2]);
}

// Sort order: past first (most recent past first), then now, then upcoming (nearest first).
function sortTrips(trips: Trip[]): Trip[] {
  const statusRank = { past: 0, now: 1, upcoming: 2 };
  return [...trips].sort((a, b) => {
    const sr = statusRank[a.status] - statusRank[b.status];
    if (sr !== 0) return sr;
    const da = parseDateKey(a.dateRange);
    const db = parseDateKey(b.dateRange);
    // Past trips: most recent first (descending). Now/upcoming: nearest first (ascending).
    return a.status === 'past' ? db - da : da - db;
  });
}

export const useTripStore = create<AppState>((set) => ({
  isOpen:           false,
  activeIdx:        0,
  isAnimating:      false,
  pageStates:       [],
  trips:            [],
  stickerTemplates: [],

  setOpen:      (v) => set({ isOpen: v }),
  setActiveIdx: (i) => set({ activeIdx: i }),
  setAnimating: (v) => set({ isAnimating: v }),

  setPageState: (i, state) =>
    set((s) => {
      const next = [...s.pageStates] as PageState[];
      next[i] = state;
      return { pageStates: next };
    }),

  setAllPageStates: (states) => set({ pageStates: states }),

  updateTrip: (id, patch) =>
    set((s) => ({
      trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  addElement: (tripId, el) =>
    set((s) => ({
      trips: s.trips.map((t) =>
        t.id === tripId ? { ...t, elements: [...t.elements, el] } : t
      ),
    })),

  updateElement: (tripId, id, patch) =>
    set((s) => ({
      trips: s.trips.map((t) =>
        t.id === tripId
          ? { ...t, elements: t.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
          : t
      ),
    })),

  removeElement: (tripId, id) =>
    set((s) => ({
      trips: s.trips.map((t) =>
        t.id === tripId ? { ...t, elements: t.elements.filter((e) => e.id !== id) } : t
      ),
    })),

  setElements: (tripId, elements) =>
    set((s) => ({
      trips: s.trips.map((t) => (t.id === tripId ? { ...t, elements } : t)),
    })),

  addStickerTemplate: (t) =>
    set((s) => ({ stickerTemplates: [...s.stickerTemplates, t] })),

  removeStickerTemplate: (id) =>
    set((s) => ({ stickerTemplates: s.stickerTemplates.filter((t) => t.id !== id) })),

  addTrip: (trip) =>
    set((s) => {
      const trips = sortTrips([...s.trips, trip]);
      return {
        trips,
        pageStates: trips.map(() => 'waiting' as PageState),
      };
    }),

  removeTrip: (id) =>
    set((s) => {
      const trips = sortTrips(s.trips.filter((t) => t.id !== id));
      const activeIdx = Math.min(s.activeIdx, Math.max(trips.length - 1, 0));
      return {
        trips,
        pageStates: trips.map(() => 'waiting' as PageState),
        activeIdx,
      };
    }),
}));
