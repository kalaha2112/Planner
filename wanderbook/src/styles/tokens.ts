export const colors = {
  bgBody:      '#e8e4dc',
  surface:     '#ffffff',
  inkPrimary:  '#1a1a1a',
  inkMid:      '#3d3826',
  inkSoft:     '#7a7260',
  inkFaint:    '#c8c2ae',
  accentBrown: '#23140C',
  accentRed:   '#91040C',
} as const;

export const fonts = {
  serif:       "'Playfair Display', serif",
  display:     "'Bebas Neue', sans-serif",
  ui:          "'DM Sans', sans-serif",
  handwriting: "'Cormorant Garamond', serif",
} as const;

export const book = {
  width:       280,
  height:      188,
  perspective: 1400,
} as const;

export const timings = {
  coverFlip:  900,
  pageFlip:   720,
  animLock:   740,
  openSettle: 700,
} as const;
