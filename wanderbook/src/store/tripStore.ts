import { create } from 'zustand';

export type PageState = 'waiting' | 'active' | 'flipping-up' | 'past' | 'incoming';

export interface EditElement {
  id: string;
  type: 'word' | 'emoji-sticker' | 'image-sticker';
  content: string;
  x: number;
  y: number;
  fontSize?: number;
  width?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: '400' | '700';
}

export interface Trip {
  id: string;
  name: string;
  country: string;
  status: 'past' | 'now' | 'upcoming';
  cardDesign: 0 | 1 | 2 | 3 | 4;
  editElements: EditElement[];
}

interface AppState {
  isOpen: boolean;
  activeIdx: number;
  isAnimating: boolean;
  isEditing: boolean;
  selectedElementId: string | null;
  pageStates: PageState[];
  pageTransitions: boolean[];
  trips: Trip[];
  customStickers: string[];

  setOpen: (v: boolean) => void;
  setActiveIdx: (i: number) => void;
  setAnimating: (v: boolean) => void;
  setEditing: (v: boolean) => void;
  setSelectedElement: (id: string | null) => void;
  setPageState: (i: number, state: PageState) => void;
  setPageTransition: (i: number, enabled: boolean) => void;
  addCustomSticker: (dataUrl: string) => void;
  removeCustomSticker: (dataUrl: string) => void;
  addElement: (tripIdx: number, el: EditElement) => void;
  updateElement: (tripIdx: number, id: string, patch: Partial<EditElement>) => void;
  removeElement: (tripIdx: number, id: string) => void;
}

const INITIAL_TRIPS: Trip[] = [
  { id: 'paris',   name: 'Paris',   country: 'France',    status: 'past',     cardDesign: 0, editElements: [] },
  { id: 'kyoto',   name: 'Kyoto',   country: 'Japan',     status: 'now',      cardDesign: 1, editElements: [] },
  { id: 'bali',    name: 'Bali',    country: 'Indonesia', status: 'upcoming', cardDesign: 2, editElements: [] },
  { id: 'morocco', name: 'Morocco', country: 'Morocco',   status: 'upcoming', cardDesign: 3, editElements: [] },
  { id: 'lisbon',  name: 'Lisbon',  country: 'Portugal',  status: 'upcoming', cardDesign: 4, editElements: [] },
];

const INITIAL_PAGE_STATES: PageState[] = ['waiting', 'waiting', 'waiting', 'waiting', 'waiting'];

export const useTripStore = create<AppState>((set) => ({
  isOpen:            false,
  activeIdx:         1,
  isAnimating:       false,
  isEditing:         false,
  selectedElementId: null,
  pageStates:        INITIAL_PAGE_STATES,
  pageTransitions:   [true, true, true, true, true],
  trips:             INITIAL_TRIPS,
  customStickers:    [],

  setOpen:            (v) => set({ isOpen: v }),
  setActiveIdx:       (i) => set({ activeIdx: i }),
  setAnimating:       (v) => set({ isAnimating: v }),
  setEditing:         (v) => set({ isEditing: v }),
  setSelectedElement: (id) => set({ selectedElementId: id }),

  setPageState: (i, state) =>
    set((s) => {
      const next = [...s.pageStates];
      next[i] = state;
      return { pageStates: next };
    }),

  setPageTransition: (i, enabled) =>
    set((s) => {
      const next = [...s.pageTransitions];
      next[i] = enabled;
      return { pageTransitions: next };
    }),

  addCustomSticker:    (dataUrl) => set((s) => ({ customStickers: [...s.customStickers, dataUrl] })),
  removeCustomSticker: (dataUrl) => set((s) => ({ customStickers: s.customStickers.filter((u) => u !== dataUrl) })),

  addElement: (tripIdx, el) =>
    set((s) => {
      const trips = [...s.trips];
      trips[tripIdx] = { ...trips[tripIdx], editElements: [...trips[tripIdx].editElements, el] };
      return { trips };
    }),

  updateElement: (tripIdx, id, patch) =>
    set((s) => {
      const trips = [...s.trips];
      trips[tripIdx] = {
        ...trips[tripIdx],
        editElements: trips[tripIdx].editElements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      };
      return { trips };
    }),

  removeElement: (tripIdx, id) =>
    set((s) => {
      const trips = [...s.trips];
      trips[tripIdx] = {
        ...trips[tripIdx],
        editElements: trips[tripIdx].editElements.filter((el) => el.id !== id),
      };
      return { trips };
    }),
}));
