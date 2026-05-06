import { create } from 'zustand';

export type PageState = 'waiting' | 'active' | 'flipping-up' | 'past' | 'incoming';

export interface CardElement {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  uri?: string;
  width?: number;
  height?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
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
  elements: CardElement[];
}

interface AppState {
  isOpen: boolean;
  activeIdx: number;
  isAnimating: boolean;
  pageStates: PageState[];
  trips: Trip[];

  setOpen: (v: boolean) => void;
  setActiveIdx: (i: number) => void;
  setAnimating: (v: boolean) => void;
  setPageState: (i: number, state: PageState) => void;
  setAllPageStates: (states: PageState[]) => void;
  updateTrip: (id: string, patch: Partial<Pick<Trip, 'customName' | 'customCountry' | 'titleFont' | 'notes'>>) => void;
  addElement: (tripId: string, el: CardElement) => void;
  updateElement: (tripId: string, id: string, patch: Partial<CardElement>) => void;
  removeElement: (tripId: string, id: string) => void;
}

const TRIPS: Trip[] = [
  { id: 'paris',   name: 'Paris',   country: 'France',    status: 'past',     cardDesign: 0, titleFont: 'PlayfairDisplay-Black', elements: [] },
  { id: 'kyoto',   name: 'Kyoto',   country: 'Japan',     status: 'now',      cardDesign: 1, titleFont: 'PlayfairDisplay-Black', elements: [] },
  { id: 'bali',    name: 'Bali',    country: 'Indonesia', status: 'upcoming', cardDesign: 2, titleFont: 'BebasNeue',             elements: [] },
  { id: 'morocco', name: 'Morocco', country: 'Morocco',   status: 'upcoming', cardDesign: 3, titleFont: 'BebasNeue',             elements: [] },
  { id: 'lisbon',  name: 'Lisbon',  country: 'Portugal',  status: 'upcoming', cardDesign: 4, titleFont: 'BebasNeue',             elements: [] },
];

export const useTripStore = create<AppState>((set) => ({
  isOpen:      false,
  activeIdx:   1,
  isAnimating: false,
  pageStates:  ['waiting', 'waiting', 'waiting', 'waiting', 'waiting'],
  trips:       TRIPS,

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
}));
