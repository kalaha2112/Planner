import { Animated, TouchableWithoutFeedback, View, Text, StyleSheet } from 'react-native';

interface BookCoverProps {
  coverAnim: Animated.Value;
  onOpen: () => void;
}

export default function BookCover({ coverAnim, onOpen }: BookCoverProps) {
  const frontRotateX = coverAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '-180deg'],
  });
  const frontOpacity = coverAnim.interpolate({
    inputRange:  [0, 0.48, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = coverAnim.interpolate({
    inputRange:  [0, 0.5, 0.52, 1],
    outputRange: [0, 0, 1, 1],
  });
  const backRotateX = coverAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['180deg', '0deg'],
  });

  return (
    <TouchableWithoutFeedback onPress={onOpen}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.face,
            {
              opacity: frontOpacity,
              transform: [
                { perspective: 1400 },
                { translateY: -114 },
                { rotateX: frontRotateX },
                { translateY: 114 },
              ],
            },
          ]}
        >
          <View style={styles.front}>
            <Text style={styles.coverText}>
              {'Where will you be\n'}
              <Text style={styles.tapWord}>off to next?</Text>
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.face,
            styles.back,
            {
              opacity: backOpacity,
              transform: [
                { perspective: 1400 },
                { translateY: -114 },
                { rotateX: backRotateX },
                { translateY: 114 },
              ],
            },
          ]}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 340, height: 228,
    position: 'absolute', top: 0, left: 0,
    zIndex: 20,
  },
  face: {
    position: 'absolute', width: 340, height: 228,
    top: 0, left: 0,
  },
  front: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    backgroundColor: '#f8f8f8',
    borderRadius: 1,
  },
  coverText: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 19,
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 28,
  },
  tapWord: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(145,4,12,0.35)',
  },
});
