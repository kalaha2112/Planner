import { View, Text, Image, StyleSheet } from 'react-native';

interface CardProps {
  customName?: string;
  customCountry?: string;
  titleFont?: string;
}

export default function ParisCard({
  customName,
  titleFont = 'PlayfairDisplay-Black',
}: CardProps) {
  return (
    <View style={styles.card}>
      <Image
        source={require('../../../assets/eiffel.png')}
        style={styles.eiffel}
        resizeMode="contain"
      />
      <Text style={[styles.name, { fontFamily: titleFont }]}>
        {customName ?? 'PARIS'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', top: 0, left: 0, width: 340, height: 228, backgroundColor: '#fff', overflow: 'hidden' },
  eiffel: {
    position: 'absolute', right: -7, top: -29,
    height: 250, width: 145,
    opacity: 0.9,
    zIndex: 2,
  },
  name: {
    position: 'absolute', bottom: 5, left: 27, zIndex: 3,
    fontSize: 95, lineHeight: 95,
    letterSpacing: -2,
    color: '#1a1a1a',
  },
});
