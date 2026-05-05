import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  PanResponder, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_900Black,
} from '@expo-google-fonts/playfair-display';
import { DM_Sans_400Regular, DM_Sans_500Medium } from '@expo-google-fonts/dm-sans';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { CormorantGaramond_300Light_Italic } from '@expo-google-fonts/cormorant-garamond';

import { usePageFlip } from './src/hooks/usePageFlip';
import { useTripStore } from './src/store/tripStore';
import BookCover   from './src/components/BookCover';
import BookOutline from './src/components/BookOutline';
import TripPage    from './src/components/TripPage';
import PageDots    from './src/components/PageDots';
import EditSheet   from './src/components/EditSheet';

const SWIPE_THRESHOLD = 38;

function WanderbookApp() {
  const {
    isOpen, activeIdx, pageStates,
    coverAnim, pageAnims,
    openBook, closeBook, goNext, goPrev, jumpTo,
  } = usePageFlip();
  const { trips } = useTripStore();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Footer fades in when book opens
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const prevOpen = useRef(false);
  if (isOpen !== prevOpen.current) {
    prevOpen.current = isOpen;
    Animated.timing(footerOpacity, {
      toValue: isOpen ? 1 : 0,
      duration: 450,
      delay: isOpen ? 550 : 0,
      useNativeDriver: true,
    }).start();
  }

  // Swipe on the book area — don't claim on start so taps reach child components
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_, g) => {
        if      (g.dy < -SWIPE_THRESHOLD) goNext();
        else if (g.dy >  SWIPE_THRESHOLD) goPrev();
      },
    })
  ).current;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <Animated.Text
        style={[
          styles.coverLabel,
          { opacity: coverAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0] }) },
        ]}
      >
        your travel journal
      </Animated.Text>

      {/* Book */}
      <View style={styles.bookWrap} {...panResponder.panHandlers}>
        <BookOutline />

        {trips.map((trip, i) => (
          <TripPage
            key={trip.id}
            index={i}
            trip={trip}
            pageState={pageStates[i]}
            rotateAnim={pageAnims[i]}
          />
        ))}

        <BookCover coverAnim={coverAnim} onOpen={openBook} />
      </View>

      {/* Footer */}
      <Animated.View
        style={[styles.footer, { opacity: footerOpacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <PageDots count={trips.length} activeIdx={activeIdx} onPress={jumpTo} />

        <View style={styles.swipeRow}>
          <View style={styles.tick} />
          <Text style={styles.swipeLabel}>swipe to turn page</Text>
          <View style={styles.tick} />
        </View>

        <View style={styles.footerActions}>
          <TouchableOpacity onPress={() => setEditingIdx(activeIdx)} hitSlop={12}>
            <Text style={styles.editBtn}>edit card</Text>
          </TouchableOpacity>

          <View style={styles.footerDivider} />

          <TouchableOpacity onPress={closeBook} hitSlop={12}>
            <Text style={styles.closeBtn}>close book</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Edit sheet */}
      <EditSheet
        trip={editingIdx !== null ? trips[editingIdx] : null}
        visible={editingIdx !== null}
        onClose={() => setEditingIdx(null)}
      />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'PlayfairDisplay-Regular':       PlayfairDisplay_400Regular,
    'PlayfairDisplay-Italic':        PlayfairDisplay_400Regular_Italic,
    'PlayfairDisplay-Bold':          PlayfairDisplay_700Bold,
    'PlayfairDisplay-BoldItalic':    PlayfairDisplay_700Bold_Italic,
    'PlayfairDisplay-Black':         PlayfairDisplay_900Black,
    'BebasNeue':                     BebasNeue_400Regular,
    'DMSans-Regular':                DM_Sans_400Regular,
    'DMSans-Medium':                 DM_Sans_500Medium,
    'CormorantGaramond-LightItalic': CormorantGaramond_300Light_Italic,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.root}>
        <WanderbookApp />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  coverLabel: {
    marginBottom: 24,
    fontSize: 8, letterSpacing: 4,
    color: '#ccc', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
  },
  bookWrap: { width: 280, height: 188 },
  footer:   { marginTop: 28, alignItems: 'center', gap: 14 },
  swipeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tick:     { width: 18, height: 1, backgroundColor: '#ddd' },
  swipeLabel: {
    fontSize: 8, letterSpacing: 2.5,
    color: '#ccc', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerDivider: {
    width: 1, height: 10,
    backgroundColor: '#e0e0e0',
  },
  editBtn: {
    fontSize: 9, letterSpacing: 1.5,
    color: '#91040C', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
  },
  closeBtn: {
    fontSize: 9, letterSpacing: 1.5,
    color: '#bbb', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
  },
});
