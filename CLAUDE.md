# Su Travel Book — Session Handoff

## Project overview

**SuTravelBook** is a React Native / Expo travel scrapbook app. Users keep a small book of trip cards (max ~10), flip through them with a page-turn animation, and annotate each card with drawings, stickers, text labels, and trip details.

Repo: `kalaha2112/project1`
Active branch: `claude/create-wanderbook-project-NBHEC`

---

## Repo structure

```
Project1/
├── wanderbook-native/   ← active mobile app (Expo / React Native)
│   ├── App.tsx                          entry point + root layout
│   ├── index.ts                         Expo entry shim
│   ├── src/
│   │   ├── store/tripStore.ts           Zustand store (all app state)
│   │   ├── hooks/
│   │   │   ├── usePageFlip.ts           book open/close/next/prev animation logic
│   │   │   └── useBookDimensions.ts     responsive bookW/bookH/bookScale/isTablet
│   │   └── components/
│   │       ├── BookCover.tsx            cover flip (open/add-trip)
│   │       ├── BookOutline.tsx          SVG decorative border overlay
│   │       ├── TripPage.tsx             individual animated page (front + back face)
│   │       ├── PageDots.tsx             dot-navigation strip
│   │       ├── StickerLayer.tsx         draggable/resizable element layer (image, text, path)
│   │       ├── DrawingLayer.tsx         pen/brush/eraser canvas overlay
│   │       ├── StickerDrawer.tsx        sticker template picker (add photo / paste)
│   │       ├── CardEditor.tsx           full-screen editor modal (draw, text, sticker, trip tabs)
│   │       ├── TripOverview.tsx         trip detail modal (itinerary, OOTD, budget, hotel, flight)
│   │       └── cards/
│   │           ├── ParisCard.tsx        cardDesign 0
│   │           ├── KyotoCard.tsx        cardDesign 1
│   │           ├── BaliCard.tsx         cardDesign 2
│   │           ├── MoroccoCard.tsx      cardDesign 3
│   │           └── LisbonCard.tsx       cardDesign 4
└── wanderbook/          ← abandoned Next.js prototype (ignore)
```

---

## State shape (tripStore.ts)

```ts
AppState {
  isOpen:           boolean          // book is open
  activeIdx:        number           // which trip is showing
  isAnimating:      boolean          // animation lock
  pageStates:       PageState[]      // per-page: waiting|incoming|active|flipping-up|past
  trips:            Trip[]
  stickerTemplates: StickerTemplate[] // global drawer pool

  // actions: setOpen, setActiveIdx, setAnimating, setPageState, setAllPageStates
  // updateTrip, addElement, updateElement, removeElement, setElements
  // addStickerTemplate, removeStickerTemplate, addTrip, removeTrip
}

Trip {
  id, name, country, status ('past'|'now'|'upcoming')
  cardDesign: 0|1|2|3|4            // selects which Card component to render
  titleFont: string
  customName?, customCountry?      // user overrides shown on card
  notes?, dateRange?, daysAway?
  budgetTotal?, budgetSpent?
  hotelLocation?, hotelNights?
  itinerary?: string[][]           // [dayIndex][itemIndex]
  flightFrom?, flightTo?, flightDate?, flightNumber?
  countries?: string[]             // up to 4
  cities?: string[][]              // [countryIdx][cityIdx], up to 4×2
  elements: CardElement[]          // stickers/text/paths placed on card
}

CardElement { id, type ('image'|'text'|'path'), x, y, scale, rotation, zIndex?, ... }
```

---

## Key design decisions

| Decision | Rationale |
|----------|-----------|
| All card editing goes through `CardEditor` | `EditSheet` was an earlier approach — it was removed as dead code |
| Book coordinates are fixed at 340×228 | Scaled to screen via CSS `transform: scale(outerW/344)` in a 344×232 container |
| `pageStates` mirrors `trips.length` | Added/removed in sync with `addTrip`/`removeTrip` |
| `PanResponder` created once in a `useRef` | Avoids stale closures; live values accessed via `R.current` ref pattern |
| `useNativeDriver: true` on all animations | Keeps page flip and cover flip on the UI thread |
| `StickerLayer readOnly` on the book screen | Disables interaction handles; editing only happens inside `CardEditor` |

---

## Card design system

Each `cardDesign` (0–4) maps to a card component in `components/cards/`. Cards receive:
- `customName`, `customCountry`, `titleFont`, `onTitlePress` (optional)
- They are purely presentational — no store access

The `CARDS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard]` array is used in `TripPage.tsx` and `CardEditor.tsx` to select the right card by `trip.cardDesign`.

---

## Known issues / next steps

### 1. Missing npm packages (TS errors)
`expo-image-picker`, `expo-image-manipulator`, `expo-clipboard`, `expo-file-system` are listed in `package.json` but are **not installed** in `node_modules`. Run:
```bash
cd wanderbook-native && npx expo install expo-image-picker expo-image-manipulator expo-clipboard expo-file-system
```
These are used by `StickerDrawer.tsx` and `CardEditor.tsx` for photo/paste sticker workflows. The app will crash on those actions until installed.

### 2. `jumpTo` only steps one at a time
`PageDots` lets the user tap any dot, but `jumpTo` in `usePageFlip` only calls `goNext`/`goPrev` once. Tapping a non-adjacent dot navigates only one step. Could be fixed by looping, or by implementing a direct `jumpTo(idx)` animation.

### 3. No persistence
All trip data lives in Zustand in-memory. Closing the app resets everything. Adding `zustand/middleware` `persist` with AsyncStorage would fix this.

### 4. `wanderbook/` Next.js project
The `wanderbook/` folder at the repo root is an earlier web prototype. It is unused and can be deleted when convenient.

---

## Fonts registered in App.tsx

| Key used in styles | Expo font constant |
|---|---|
| `PlayfairDisplay-Regular` | `PlayfairDisplay_400Regular` |
| `PlayfairDisplay-Italic` | `PlayfairDisplay_400Regular_Italic` |
| `PlayfairDisplay-Bold` | `PlayfairDisplay_700Bold` |
| `PlayfairDisplay-BoldItalic` | `PlayfairDisplay_700Bold_Italic` |
| `PlayfairDisplay-Black` | `PlayfairDisplay_900Black` |
| `BebasNeue` | `BebasNeue_400Regular` |
| `DMSans-Regular` | `DMSans_400Regular` |
| `DMSans-Medium` | `DMSans_500Medium` |
| `CormorantGaramond-LightItalic` | `CormorantGaramond_300Light_Italic` |

---

## Running the app

```bash
cd wanderbook-native
npx expo start          # opens Expo dev server
# then press i (iOS simulator), a (Android), or w (web)
```

TypeScript check (no build needed):
```bash
npx tsc --noEmit
```
