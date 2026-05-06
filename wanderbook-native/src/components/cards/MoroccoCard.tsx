import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';

interface CardProps {
  customName?: string;
  customCountry?: string;
  titleFont?: string;
  onTitlePress?: () => void;
}

export default function MoroccoCard({
  customName,
  customCountry,
  titleFont = 'BebasNeue',
  onTitlePress,
}: CardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.ghostM}>M</Text>

      {customName ? (
        <TouchableOpacity
          style={styles.customNameTouch}
          onPress={onTitlePress}
          activeOpacity={0.7}
          disabled={!onTitlePress}
        >
          <Text style={[styles.customName, { fontFamily: titleFont }]}>
            {customName}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.defaultNameTouch}
          onPress={onTitlePress}
          activeOpacity={0.7}
          disabled={!onTitlePress}
        >
          <Text style={styles.mo}>MO</Text>
          <Text style={styles.rocco}>rocco</Text>
        </TouchableOpacity>
      )}

      <Svg style={StyleSheet.absoluteFillObject} width={340} height={228} viewBox="0 0 340 228">
        <Line x1="10" y1="145" x2="242" y2="61" stroke="#1a1a1a" strokeWidth={0.8} strokeLinecap="round" opacity={0.18} />
      </Svg>

      <View style={styles.circle} />
      <Text style={styles.sub}>{customCountry ?? 'Marrakech'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', width: 340, height: 228, backgroundColor: '#fff', overflow: 'hidden' },
  ghostM: {
    position: 'absolute', top: -27, left: -10, zIndex: 1,
    fontFamily: 'PlayfairDisplay-Black',
    fontSize: 206, lineHeight: 206,
    color: 'rgba(0,0,0,0.03)',
  },
  defaultNameTouch: {
    position: 'absolute', top: 27, left: 29, zIndex: 4,
  },
  mo: {
    fontFamily: 'BebasNeue',
    fontSize: 65, lineHeight: 59,
    letterSpacing: 1,
    color: '#1a1a1a',
  },
  rocco: {
    marginLeft: 10,
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 58, lineHeight: 52,
    letterSpacing: -0.5,
    color: '#1a1a1a',
  },
  customNameTouch: {
    position: 'absolute', top: 27, left: 29, zIndex: 4,
  },
  customName: {
    fontSize: 65, lineHeight: 61,
    letterSpacing: -1,
    color: '#1a1a1a',
  },
  circle: {
    position: 'absolute', top: 24, right: 27, zIndex: 5,
    width: 29, height: 29, borderRadius: 14.5,
    borderWidth: 1.5, borderColor: '#91040C',
    backgroundColor: 'transparent',
  },
  sub: {
    position: 'absolute', bottom: 24, left: 29, zIndex: 4,
    fontFamily: 'DMSans-Regular',
    fontSize: 8, letterSpacing: 3,
    color: '#bbb',
    textTransform: 'uppercase',
  },
});
