import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface CardProps {
  customName?: string;
  customCountry?: string;
  titleFont?: string;
  onTitlePress?: () => void;
}

export default function LisbonCard({
  customName,
  customCountry,
  titleFont = 'BebasNeue',
  onTitlePress,
}: CardProps) {
  return (
    <View style={styles.card}>
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
        <>
          <TouchableOpacity
            style={styles.lisTouch}
            onPress={onTitlePress}
            activeOpacity={0.7}
            disabled={!onTitlePress}
          >
            <Text style={styles.lis}>LIS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bonTouch}
            onPress={onTitlePress}
            activeOpacity={0.7}
            disabled={!onTitlePress}
          >
            <Text style={styles.bon}>bon</Text>
          </TouchableOpacity>
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
  lisTouch: {
    position: 'absolute', top: 19, right: 29, zIndex: 3,
  },
  lis: {
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
  bonTouch: {
    position: 'absolute', bottom: 19, left: 29, zIndex: 3,
  },
  bon: {
    fontFamily: 'PlayfairDisplay-BoldItalic',
    fontSize: 87, lineHeight: 87,
    letterSpacing: -1,
    color: '#1a1a1a',
  },
  customNameTouch: {
    position: 'absolute', top: 19, left: 29, zIndex: 3,
  },
  customName: {
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
