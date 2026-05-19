import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PageState, Trip } from '../store/tripStore';
import ParisCard   from './cards/ParisCard';
import KyotoCard   from './cards/KyotoCard';
import BaliCard    from './cards/BaliCard';
import MoroccoCard from './cards/MoroccoCard';
import LisbonCard  from './cards/LisbonCard';
import StickerLayer from './StickerLayer';
import { useBookDimensions } from '../hooks/useBookDimensions';

const CARDS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard];

const HALF_H = 114;

const Z: Record<PageState, number> = {
  'waiting':     2,
  'incoming':    14,
  'active':      15,
  'flipping-up': 16,
  'past':        5,
};

interface Props {
  index: number;
  trip: Trip;
  pageState: PageState;
  rotateAnim: Animated.Value;
  onTitlePress?: () => void;
  onDeletePress?: () => void;
}

export default function TripPage({ index, trip, pageState, rotateAnim, onTitlePress, onDeletePress }: Props) {
  const { bookScale } = useBookDimensions();
  if (pageState === 'waiting') return null;

  const Card = CARDS[trip.cardDesign];

  const rotateX = rotateAnim.interpolate({
    inputRange:  [-180, 0, 88],
    outputRange: ['-180deg', '0deg', '88deg'],
  });

  const frontOpacity = rotateAnim.interpolate({
    inputRange:  [-180, -92, -88, 88],
    outputRange: [0, 0, 1, 1],
  });

  const backOpacity = rotateAnim.interpolate({
    inputRange:  [-180, -92, -88, 88],
    outputRange: [1, 1, 0, 0],
  });

  return (
    <Animated.View
      style={[
        styles.page,
        {
          zIndex: Z[pageState],
          transform: [
            { perspective: 1400 },
            { translateY: -HALF_H },
            { rotateX },
            { translateY: HALF_H },
          ],
        },
      ]}
    >
      {/* Front face */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: frontOpacity }]}>
        <View style={styles.inner}>
          <View style={styles.topEdge} />
          <Card
            customName={trip.customName}
            customCountry={trip.customCountry}
            titleFont={trip.titleFont}
            onTitlePress={onTitlePress}
          />
          <StickerLayer trip={trip} bookScale={bookScale} readOnly />
          <Text style={styles.pageNum}>{String(index + 1).padStart(2, '0')}</Text>
          {onDeletePress && pageState === 'active' && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={onDeletePress}
              hitSlop={8}
              activeOpacity={0.6}
            >
              <Text style={styles.deleteBtnText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Back face — off-white blank */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backFace, { opacity: backOpacity }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    position: 'absolute', width: 340, height: 228, top: 0, left: 0,
  },
  inner: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  backFace: {
    backgroundColor: '#f5f3ef',
    borderRadius: 1,
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1, backgroundColor: 'rgba(0,0,0,0.06)', zIndex: 5,
  },
  pageNum: {
    position: 'absolute', top: 8, right: 12, zIndex: 4,
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 10, color: '#ccc',
  },
  deleteBtn: {
    position: 'absolute', top: 7, left: 9, zIndex: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 10, color: '#bbb',
    lineHeight: 14, marginTop: -1,
  },
});
