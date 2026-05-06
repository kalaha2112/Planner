import { View, Text, StyleSheet } from 'react-native';

interface CardProps {
  customName?: string;
  customCountry?: string;
  titleFont?: string;
}

export default function KyotoCard({
  customName,
  customCountry,
  titleFont = 'PlayfairDisplay-Black',
}: CardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.ghost}>{'KY\nOTO'}</Text>
      <View style={styles.dot} />
      <Text style={[styles.name, { fontFamily: titleFont }]}>
        {customName ?? 'Kyoto'}
      </Text>
      <Text style={styles.country}>{customCountry ?? 'Japan'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', width: 340, height: 228, backgroundColor: '#fff', overflow: 'hidden' },
  ghost: {
    position: 'absolute', top: -15, left: -7, zIndex: 1,
    fontFamily: 'BebasNeue',
    fontSize: 155, lineHeight: 127,
    letterSpacing: -2,
    color: 'rgba(0,0,0,0.033)',
  },
  dot: {
    position: 'absolute', top: 22, right: 24, zIndex: 5,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#23140C',
  },
  name: {
    position: 'absolute', top: 27, left: 29, zIndex: 4,
    fontSize: 65, lineHeight: 58,
    letterSpacing: -1.5,
    color: '#1a1a1a',
  },
  country: {
    position: 'absolute', bottom: 22, right: 29, zIndex: 4,
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 34, lineHeight: 34,
    letterSpacing: 0.5,
    color: '#1a1a1a',
  },
});
