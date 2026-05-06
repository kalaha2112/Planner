import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function BookOutline() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <Svg width={344} height={232} viewBox="0 0 344 232" fill="none">
        <Path
          d="M 27 5 C 73 2, 170 2, 266 4 C 300 4, 317 4, 337 5 L 338 7 C 339 58, 339 145, 338 220 L 337 224 C 291 225, 194 226, 97 225 C 63 224, 34 225, 7 224 L 6 220 C 5 169, 5 73, 6 12 L 7 7 C 15 5, 22 4, 27 5 Z"
          stroke="#1a1a1a"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M 315 5 L 342 5"  stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.45} />
        <Path d="M 339 5 L 339 31" stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.45} />
        <Path d="M 5 224 L 34 224" stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.35} />
        <Path d="M 5 200 L 5 224"  stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.35} />
      </Svg>
    </View>
  );
}
