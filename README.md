# Su Travel Book

A personal travel journal app built with **React Native + Expo**. Open a sketchbook-style book cover to reveal your trip cards, flip through pages, and build detailed trip overviews — itinerary, budget, hotel, flight, and outfit planning — with a draggable sticker and text layer on every card.

---

## Features

### Travel Book
- Sketchbook-style book cover with hand-drawn SVG outline
- Flip pages up/down by swiping vertically
- Five editorial trip card designs (Paris, Kyoto, Bali, Morocco, Lisbon)
- Page dot navigation, "close book" action

### Trip Overview
Tap a card's city name title to open a full-screen detail view. Each section is its own tab:

| Tab | Content |
|-----|---------|
| **Itinerary** | Day-by-day plans — add/remove activities per day, add days |
| **OOTD** | Outfit mood board from the card's image stickers |
| **Budget** | Spend vs. total, progress bar, remaining amount |
| **Hotel** | Location and nights |
| **Flight** | Route (from → to), date, flight number |

### Card Editor (Edit Sheet)
- **TEXT tab** — city name, country, font picker, inline text labels
- **TRIP tab** — date range, days away, budget, hotel, flight details
- **STICKERS tab** — add photos from library (auto-converts to PNG), paste from clipboard

### Sticker & Label System
- Drag any sticker or text label freely on the card
- Tap to select → shows delete badge and bottom control bar
- Image selected: scale presets (0.5× / 1× / 1.5× / 2×)
- Text selected: size presets (10 / 14 / 20 / 28) + scrollable font picker
- Selected text element becomes a live `TextInput` — type to edit in place

### World Map *(placeholder)*
A "My World Map" preview card is visible on the home screen when the book is closed. Interactive map coming in a future release.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Expo SDK](https://expo.dev) (managed workflow) |
| UI | React Native |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Fonts | `@expo-google-fonts/playfair-display`, `dm-sans`, `bebas-neue`, `cormorant-garamond` |
| Images | `expo-image-picker`, `expo-image-manipulator` |
| Clipboard | `expo-clipboard`, `expo-file-system` |
| Language | TypeScript |

---

## Project Structure

```
Project1/
├── README.md
├── wanderbook-native/          ← Su Travel Book (Expo app)
│   ├── App.tsx                 ← Root: SuTravelBook component, fonts, main layout
│   ├── app.json                ← Expo config (name: "Su Travel Book")
│   ├── package.json
│   ├── tsconfig.json
│   ├── assets/
│   └── src/
│       ├── components/
│       │   ├── BookCover.tsx       ← Animated cover with open tap
│       │   ├── BookOutline.tsx     ← Hand-drawn SVG sketch border
│       │   ├── TripPage.tsx        ← Animated flip page with front/back faces
│       │   ├── PageDots.tsx        ← Navigation dots
│       │   ├── StickerLayer.tsx    ← Draggable images + text labels on card
│       │   ├── EditSheet.tsx       ← Bottom sheet: TEXT / TRIP / STICKERS tabs
│       │   ├── TripOverview.tsx    ← Full-screen trip detail with 5 section tabs
│       │   └── cards/
│       │       ├── ParisCard.tsx
│       │       ├── KyotoCard.tsx
│       │       ├── BaliCard.tsx
│       │       ├── MoroccoCard.tsx
│       │       └── LisbonCard.tsx
│       ├── hooks/
│       │   └── usePageFlip.ts      ← Book open/close, page flip state machine
│       └── store/
│           └── tripStore.ts        ← Zustand store — trips, page states, elements
└── wanderbook/                 ← Legacy web prototype (archived)
    └── CLAUDE.md
```

---

## Data Model

```ts
interface Trip {
  id: string;
  name: string;
  country: string;
  status: 'past' | 'now' | 'upcoming';
  cardDesign: 0 | 1 | 2 | 3 | 4;
  titleFont: string;

  // Editable via TEXT tab
  customName?: string;
  customCountry?: string;

  // Editable via TRIP tab
  dateRange?: string;       // "May 15 – 22, 2026"
  daysAway?: string;        // "13 days away"
  budgetTotal?: number;
  budgetSpent?: number;
  hotelLocation?: string;
  hotelNights?: number;
  flightFrom?: string;
  flightTo?: string;
  flightDate?: string;
  flightNumber?: string;
  itinerary?: string[][];   // [day0items[], day1items[], ...]

  // Stickers and text labels placed on card
  elements: CardElement[];
}

interface CardElement {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  // image
  uri?: string;
  width?: number;
  height?: number;
  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
}
```

---

## Page State Machine

Each trip page moves through five states as the book is navigated:

```
waiting ──► incoming ──► active ──► flipping-up ──► past
  │                                                   │
  └───────────────── (reset on close) ────────────────┘
```

| State | Z-index | Description |
|-------|---------|-------------|
| `waiting` | — | Not rendered (returns null) |
| `incoming` | 14 | About to become active, sliding in |
| `active` | 15 | Currently visible page |
| `flipping-up` | 16 | Animating away |
| `past` | 5 | Flipped page resting below current |

---

## Design Tokens

```
Background:          #ffffff
Surface warm:        #faf9f7 / #f7f5f2
Ink:                 #1a1a1a
Accent red (CTA):    #91040C
Accent brown:        #23140C
Muted label:         #c4a472
Light border:        #e8e8e8
```

**Fonts**

| Token | Family | Use |
|-------|--------|-----|
| `PlayfairDisplay-Black` | Playfair Display 900 | Paris card title |
| `PlayfairDisplay-Bold` | Playfair Display 700 | Budget amounts, section titles |
| `PlayfairDisplay-BoldItalic` | Playfair Display 700i | Overview section headers |
| `BebasNeue` | Bebas Neue | Bali/Morocco/Lisbon cards, OOTD header |
| `DMSans-Regular` | DM Sans 400 | UI labels, hints, buttons |
| `DMSans-Medium` | DM Sans 500 | Sub-labels, tab names |
| `CormorantGaramond-LightItalic` | Cormorant Garamond 300i | Dates, captions, budget left |

---

## Running the App

```bash
cd wanderbook-native
npm install
npx expo start --clear
```

Scan the QR code with **Expo Go** on iOS or Android.

---

## Navigation

| Gesture / Action | Result |
|-----------------|--------|
| Tap book cover | Open book |
| Swipe up on open book | Next trip card |
| Swipe down on open book | Previous trip card |
| Tap page dot | Jump to that card |
| Tap city name on card | Open Trip Overview |
| Tap section title (Itinerary ›, etc.) | Open section detail tab |
| ← overview button | Back to Trip Overview |
| Tap "edit card" | Open Edit Sheet |
| Tap "close book" | Close book |

---

## Roadmap

- [ ] Interactive world map with pinned trip destinations
- [ ] Photo polaroids on hero card from gallery
- [ ] Itinerary sharing / export
- [ ] Cloud sync / persistence
- [ ] Dark mode
