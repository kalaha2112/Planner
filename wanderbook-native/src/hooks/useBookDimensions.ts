import { useWindowDimensions } from 'react-native';

export function useBookDimensions() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const bookW = isTablet ? Math.min(Math.round(width * 0.72), 680) : 340;
  const bookH = Math.round(bookW * 228 / 340);
  const bookScale = bookW / 340;
  return { bookW, bookH, bookScale, isTablet };
}
