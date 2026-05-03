# WANDERBOOK — Travel Planner

A mobile-first travel journal app with an editorial design aesthetic. Users open a sketchbook-style book cover to reveal trip cards, flip through them like pages, and customize each card with draggable text and stickers.

---

## Project Overview

**App name:** Wanderbook  
**Platform:** Mobile web (375×812 viewport)  
**Stack:** Vanilla HTML/CSS/JS (prototype); target React Native or Next.js for production  
**Design language:** Editorial print — Playfair Display, Bebas Neue, Cormorant Garamond. White backgrounds, minimal chrome, typography as composition.

---

## Design Tokens

### Colors
```
Background:      #ffffff
Surface:         #ffffff
Ink primary:     #1a1a1a
Ink mid:         #3d3826
Ink soft:        #7a7260
Ink faint:       #c8c2ae

Accent brown:    #23140C   — structural marks, rules, outlines
Accent red:      #91040C   — interactive states, active dots, CTAs

Body bg:         #e8e4dc   — outer shell / page background
```

### Typography
```
Display serif:   Playfair Display — 400 / 700 / 900, normal + italic
Display bold:    Bebas Neue — all-caps editorial headers
Body / UI:       DM Sans — 300 / 400 / 500 / 600
Handwriting:     Cormorant Garamond — 300, normal + italic (cover title, labels)
```

### Font Import
```
https://fonts.googleapis.com/css2?
  family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700
  &family=DM+Sans:wght@300;400;500;600
  &family=Cormorant+Garamond:ital,wght@0,300;1,300;1,600
  &family=Bebas+Neue
  &display=swap
```

### Book / Card Dimensions
```
Book cover:   280 × 188 px  (landscape 3:2)
Perspective:  1400px
Card inset:   min 22–24px from all edges (no text touching borders)
```

---

## App Screens

### 1. Cover Screen

- Pure white phone background
- Centered landscape rectangle (280×188) with hand-drawn SVG sketch outline
- Cover is plain white — no texture, no branding text
- Cover text: *"Where will you be / off to next?"* — Cormorant Garamond italic, 16px, weight 300
- "off to next?" has a thin bottom border that acts as the tap target
- Tapping anywhere on the cover triggers the flip animation

**SVG outline spec:**
- Drawn as a `<path>` (not `<rect>`) with wobble baked into coordinates + SVG displacement filter
- Filter: `feTurbulence` baseFrequency `0.006 0.010`, `numOctaves` 2, displacement `scale` 2.1
- Stroke: `#1a1a1a`, `stroke-width` 2.2, `stroke-linecap` round, `stroke-linejoin` round
- Corner overshoots at top-right and bottom-left (marker bleed effect, opacity 0.45)
- No spine line, no binding stitches

---

### 2. Trip Cards (Book Pages)

- Same 280×188 slot as the cover — cards do **not** go full screen
- White background — no color blocks anywhere
- Typography IS the design — the destination name fills the card as a composition
- Text inset: minimum 22px from every edge
- No decorative lines on top or left edges of cards

**Flip animation:**
- Cover: `rotateX(-180deg)` on `transform-origin: top center`, 0.9s `cubic-bezier(0.4,0,0.2,1)`
- Pages: `rotateX` from `88deg` (waiting) → `0deg` (active) → `-180deg` (past)
- `perspective: 1400px` on parent wrap
- Page states: `waiting` | `active` | `flipping-up` | `past` | `incoming`
- Navigation: swipe up/down, scroll wheel, arrow keys, dot tap

**Vertical dot track:** 5 dots to the right of the book. Active dot: `#91040C`.

---

### 3. Trip Card Designs

Each card has a completely distinct editorial layout. Only the destination name is shown — no labels, dates, or metadata.

#### PARIS (index 0) — Past trip
- Background: `#ffffff`
- Eiffel Tower sticker: base64 PNG, right edge overflowing top (`right:-6px; top:-24px; height:206px`)
- "PARIS": Playfair Display 900, 78px, `bottom:4px; left:22px`
- Sticker filter: `drop-shadow(0 4px 20px rgba(0,0,0,0.08))`

#### KYOTO (index 1) — Current / Now
- Background: `#ffffff`
- Ghost watermark: "KYOTO" Bebas Neue 128px at `rgba(0,0,0,0.033)`, top-left offset
- Accent dot: 7×7px circle `#23140C`, `top:18px; right:20px`
- "Kyoto": Playfair Display 700, 54px, `letter-spacing:-1.5px`, `top:22px; left:24px`
- "Japan": Playfair Display italic 300, 28px, `bottom:18px; right:24px`
- No horizontal rules

#### BALI (index 2) — Upcoming
- Background: `#ffffff`
- "BALI": Bebas Neue 100px, `letter-spacing:4px`, vertically centred (`top:50%; transform:translateY(-54%)`)
- "Indonesia": DM Sans 7px, `letter-spacing:3px`, `text-transform:uppercase`, `writing-mode:vertical-rl`, `right:22px`, color `#91040C`

#### MOROCCO (index 3) — Upcoming
- Background: `#ffffff`
- Ghost "M": Playfair Display 900, 170px, `rgba(0,0,0,0.03)`, bleeds top-left
- "MO": Bebas Neue 54px, `top:22px; left:24px`
- "rocco": Playfair Display italic 400, 48px, `top:64px; left:32px`
- Diagonal SVG ink line: `x1=8 y1=120 x2=200 y2=50`, `stroke-width:0.8`, `opacity:0.18`
- Amber circle outline: 24×24px, `border:1.5px solid #91040C`, `top:20px; right:22px`
- "Marrakech": DM Sans 7px, spaced caps, `bottom:20px; left:24px`, color `#bbb`

#### LISBON (index 4) — Upcoming
- Background: `#ffffff`
- "LIS": Bebas Neue 78px, right-aligned, `top:16px; right:24px`
- "bon": Playfair Display italic 700, 72px, left-aligned, `bottom:16px; left:24px`
- Horizontal rule: 2px `#23140C`, `top:94px`, full width
- Circle bridge: 78×78px, `border:2px solid #23140C`, centred at `top:56px`, contains "Portugal" label
- Upcoming dot: 6×6px `#91040C`, `bottom:20px; right:24px`

---

## Edit Mode

Activated via **"✏ edit card"** button. Overlays the active trip page with an edit canvas.

### Draggable Words

- Absolutely positioned, `cursor:grab`, `touch-action:none`
- Dashed outline on hover → solid `#91040C` when selected/dragging
- Tap to select (drag threshold 4px before it becomes a drag)
- Controls on selection: size slider 12–90px, Bold toggle, Italic toggle, × delete handle

**Word presets:**

| Text | Font | Style | Default size |
|------|------|-------|-------------|
| dream | Playfair Display | italic | 22px |
| 2024 | Bebas Neue | normal | 32px |
| wanderlust | Cormorant Garamond | italic | 18px |
| voyage | Bebas Neue | normal | 28px |
| escape | Playfair Display | normal | 24px |
| finally | Cormorant Garamond | italic | 20px |
| ✦ | DM Sans | normal | 30px |
| — | DM Sans | normal | 28px |

### Draggable Stickers (Emoji)

- Same drag mechanics as words
- Resize handle (↔) at bottom-right corner — drag diagonally to scale `fontSize` 16–90px
- Long-press 650ms → delete with ring animation + scale-out

**Default emoji set:** ✈️ 🌸 ⭐ 🗺️ 📍 🏔️ 🌊 🌙 ☀️ 🎫 📷 🍜 🛫 ♥ ★

### Image Stickers (Custom PNG/JPG)

Three input methods:

1. **+ button** — dashed tile at start of sticker row → native file picker, accepts `image/*`, supports multiple
2. **Drag & drop** — drag image file onto edit canvas → `dragover`/`drop` events, shows drop-zone hint overlay
3. **Clipboard paste** — `Ctrl+V` / `⌘V` while edit mode is open → filters `image/*` clipboard items

Image stickers use an `<img>` tag. They resize by `width` (height follows `auto`).  
Custom stickers appear as thumbnail tiles in the picker with a hover `×` to remove them from the collection.

### Long-press Delete

- Trigger: hold for 650ms without moving more than 4px
- Feedback: circular pulse ring at hold position (`@keyframes holdPulse`), element squeezes to 92%
- On trigger: element scales to 85% + slight rotate → fades to 0 → `element.remove()`
- Cancels cleanly on any pointer move or early release

---

## Navigation Reference

| Gesture | Action |
|---------|--------|
| Tap cover | Open book (flip + pages rise) |
| Tap "close book" | Close book (reverse flip) |
| Swipe up on book | Next trip card |
| Swipe down on book | Previous trip card |
| Scroll wheel | Next / prev card |
| Arrow keys ↓ → | Next card |
| Arrow keys ↑ ← | Prev card |
| Tap page dot | Jump to that card |
| Tap "✏ edit card" | Open edit mode |
| Tap "Done" | Close edit mode |
| Escape | Close edit mode |
| Delete key | Remove selected element |
| Hold element 650ms | Delete with animation |

---

## State Shape

```ts
interface Trip {
  id: string
  name: string                     // e.g. "Kyoto"
  country: string                  // e.g. "Japan"
  status: 'past' | 'now' | 'upcoming'
  cardDesign: 0 | 1 | 2 | 3 | 4   // which design template
  editElements: EditElement[]
}

interface EditElement {
  id: string
  type: 'word' | 'emoji-sticker' | 'image-sticker'
  content: string       // text, emoji char, or dataURL
  x: number
  y: number
  fontSize?: number     // words and emoji stickers
  width?: number        // image stickers (height: auto)
  fontFamily?: string
  fontStyle?: 'normal' | 'italic'
  fontWeight?: '400' | '700'
}

interface AppState {
  isOpen: boolean
  activeIdx: number
  isEditing: boolean
  selectedElementId: string | null
  trips: Trip[]
  customStickers: string[]          // dataURLs, session-persisted
}
```

---

## Suggested File Structure

```
wanderbook/
├── CLAUDE.md
├── src/
│   ├── app/
│   │   └── page.tsx
│   ├── components/
│   │   ├── Phone.tsx
│   │   ├── BookCover.tsx
│   │   ├── BookOutline.tsx           ← SVG sketch stroke component
│   │   ├── TripPage.tsx
│   │   ├── cards/
│   │   │   ├── ParisCard.tsx
│   │   │   ├── KyotoCard.tsx
│   │   │   ├── BaliCard.tsx
│   │   │   ├── MoroccoCard.tsx
│   │   │   └── LisbonCard.tsx
│   │   ├── edit/
│   │   │   ├── EditOverlay.tsx
│   │   │   ├── EditCanvas.tsx
│   │   │   ├── EditToolbar.tsx
│   │   │   ├── StickerPicker.tsx
│   │   │   ├── WordAdder.tsx
│   │   │   ├── DraggableWord.tsx
│   │   │   ├── DraggableSticker.tsx
│   │   │   └── DraggableImageSticker.tsx
│   │   └── nav/
│   │       ├── NavBar.tsx
│   │       └── PageDots.tsx
│   ├── hooks/
│   │   ├── useDraggable.ts           ← drag + long-press delete logic
│   │   ├── usePageFlip.ts            ← book open/close + navigation
│   │   └── useImageUpload.ts         ← file, drop, paste handlers
│   ├── store/
│   │   └── tripStore.ts              ← Zustand or Context
│   └── styles/
│       └── tokens.ts                 ← design tokens
├── public/
│   └── assets/
│       └── eiffel.png                ← Paris card sticker
└── package.json
```

---

## Hook Contracts

### `useDraggable(elementRef, options)`
```ts
// options: { onTap?, onLongPress?, canvasBounds, minDragPx = 4, holdMs = 650 }
// returns: { isDragging, position, bind }  ← bind spreads onto element
//
// Logic:
// pointerdown → record startPos + origPos, start hold timer
// pointermove → if delta > minDragPx: cancel hold, set isDragging, clamp position
// pointerup   → if !isDragging: fire onTap(); clear hold timer
// hold timer  → fire onLongPress() → animate out → element.remove()
// Clamp: x ∈ [8, canvasW - elW - 8], y ∈ [8, canvasH - elH - 8]
```

### `usePageFlip(trips)`
```ts
// returns: { activeIdx, isOpen, isAnimating, openBook, closeBook, goNext, goPrev }
// Animation lock: isAnimating = true for 740ms during page transitions
// Page state machine: waiting → incoming → active → flipping-up → past
```

### `useImageUpload(onImage)`
```ts
// onImage: (dataURL: string, fileName: string) => void
// Handles:
//   - input[type=file] onChange
//   - canvas dragover / drop
//   - document paste (image/* clipboard items)
// Converts File → dataURL via FileReader.readAsDataURL
```

---

## Implementation Notes

- The prototype (`wanderbook.html`) is the source of truth for all animations, timings, and exact CSS values
- Card designs are intentionally asymmetric — do not normalize or centre text unless explicitly specified per card
- The SVG book outline uses a `<path>`, not a `<rect>` — preserve this for the hand-drawn quality
- Edit canvas background is a non-interactive clone of the trip page inner — apply `pointer-events:none` to all cloned children
- Long-press delete must cancel cleanly if pointer moves more than 4px before the 650ms fires
- Image stickers resize by `width` property; `height` stays `auto` — do not apply `fontSize` to image stickers
- Accent color rule: `#23140C` for structural / quiet elements, `#91040C` for interactive / active states
