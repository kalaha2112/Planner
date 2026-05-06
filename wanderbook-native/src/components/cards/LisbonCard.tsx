import { View, Text, StyleSheet } from 'react-native';

interface CardProps {
  customName?: string;
  customCountry?: string;
  titleFont?: string;
}

export default function LisbonCard({
  customName,
  customCountry,
  titleFont = 'BebasNeue',
}: CardProps) {
  return (
    <View style={styles.card}>
      {customName ? (
        <Text style={[styles.customName, { fontFamily: titleFont }]}>
          {customName}
        </Text>
      ) : (
        <>
          <Text style={styles.lis}>LIS</Text>
          <Text style={styles.bon}>bon</Text>
        </>
      )}

      <View style={styles.rule} />

      <View style={styles.circle}>
        <Text style={styles.circleLabel}>{customCountry ?? 'Por\ntugal'}</Text>
      </View>

      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', width: 340, height: 228, backgroundColor: '#fff', overflow: 'hidden' },
  lis: {
    position: 'absolute', top: 19, right: 29, zIndex: 3,
    fontFamily: 'BebasNeue',
    fontSize: 95, lineHeight: 95,
    letterSpacing: 2,
    color: '#1a1a1a',
    textAlign: 'right',
  },
  rule: {
    position: 'absolute', top: 114, left: 0, right: 0,
    height: 2, backgroundColor: '#23140C', zIndex: 5,
  },
  bon: {
    position: 'absolute', bottom: 19, left: 29, zIndex: 3,
    fontFamily: 'PlayfairDisplay-BoldItalic',
    fontSize: 87, lineHeight: 87,
    letterSpacing: -1,
    color: '#1a1a1a',
  },
  customName: {
    position: 'absolute', top: 19, left: 29, zIndex: 3,
    fontSize: 82, lineHeight: 79,
    letterSpacing: -1,
    color: '#1a1a1a',
  },
  circle: {
    position: 'absolute', top: 68, zIndex: 6,
    left: (340 - 95) / 2,
    width: 95, height: 95, borderRadius: 47.5,
    borderWidth: 2, borderColor: '#23140C',
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  circleLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 8, letterSpacing: 2,
    color: '#aaa',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 13,
  },
  dot: {
    position: 'absolute', bottom: 24, right: 29, zIndex: 4,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#91040C',
  },
});
