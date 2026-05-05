import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function BookOutline() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -2, left: -2, zIndex: 50 }}>
    <Svg
      width={284}
      height={192}
      viewBox="0 0 284 192"
      fill="none"
    >
      {/* Main rectangle — hand-baked slightly irregular path */}
      <Path
        d="M 22 4 C 60 2, 140 2, 220 3 C 248 3.5, 262 3, 278 4 L 279 6 C 280 48, 280 120, 279 182 L 278 185 C 240 186, 160 187, 80 186 C 52 185.5, 28 186, 6 185 L 5 182 C 4 140, 4 60, 5 10 L 6 6 C 12 4, 18 3.5, 22 4 Z"
        stroke="#1a1a1a"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Corner overshoots — top-right */}
      <Path d="M 260 4 L 282 4"  stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.45} />
      <Path d="M 280 4 L 280 26" stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.45} />
      {/* Corner overshoots — bottom-left */}
      <Path d="M 4 185 L 28 185" stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.35} />
      <Path d="M 4 165 L 4  185" stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.35} />
    </Svg>
    </View>
  );
}
