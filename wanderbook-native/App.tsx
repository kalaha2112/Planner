import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  PanResponder, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_900Black,
} from '@expo-google-fonts/playfair-display';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { CormorantGaramond_300Light_Italic } from '@expo-google-fonts/cormorant-garamond';

import { usePageFlip } from './src/hooks/usePageFlip';
import { useTripStore } from './src/store/tripStore';
import { useBookDimensions } from './src/hooks/useBookDimensions';
import BookCover   from './src/components/BookCover';
import BookOutline from './src/components/BookOutline';
import TripPage    from './src/components/TripPage';
import PageDots    from './src/components/PageDots';
import TripOverview from './src/components/TripOverview';
import CardEditor   from './src/components/CardEditor';

const SWIPE_THRESHOLD = 38;

function SuTravelBook() {
  const {
    isOpen, activeIdx, pageStates,
    coverAnim, pageAnims,
    openBook, closeBook, goNext, goPrev, jumpTo,
  } = usePageFlip();
  const { trips, addTrip, removeTrip } = useTripStore();
  const { bookW, bookH } = useBookDimensions();
  const outerW = bookW + 4;
  const outerH = bookH + 4;
  const [editingIdx, setEditingIdx]   = useState<number | null>(null);
  const [overviewIdx, setOverviewIdx] = useState<number | null>(null);

  function handleAddTrip() {
    const design = (trips.length % 5) as 0 | 1 | 2 | 3 | 4;
    const titleFont = design < 2 ? 'PlayfairDisplay-Black' : 'BebasNeue';
    const newIdx = trips.length;
    addTrip({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: '',
      country: '',
      status: 'upcoming',
      cardDesign: design,
      titleFont,
      elements: [],
    });
    setEditingIdx(newIdx);
  }

  function handleDeleteTrip(tripId: string, tripName: string) {
    Alert.alert(
      'Delete trip',
      `Remove "${tripName}" from the book?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            closeBook();
            // Remove after close animation finishes (900ms) to avoid mid-flip glitch
            setTimeout(() => removeTrip(tripId), 1000);
          },
        },
      ]
    );
  }

  // Footer fades in when book opens; map preview fades in when book closes
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const mapOpacity    = useRef(new Animated.Value(1)).current;
  const prevOpen = useRef(false);
  if (isOpen !== prevOpen.current) {
    prevOpen.current = isOpen;
    Animated.timing(footerOpacity, {
      toValue: isOpen ? 1 : 0,
      duration: 450,
      delay: isOpen ? 550 : 0,
      useNativeDriver: true,
    }).start();
    Animated.timing(mapOpacity, {
      toValue: isOpen ? 0 : 1,
      duration: 300,
      delay: isOpen ? 0 : 600,
      useNativeDriver: true,
    }).start();
  }

  // Refs keep PanResponder callbacks up-to-date (avoids stale closure on first render)
  const isOpenRef = useRef(isOpen);
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  isOpenRef.current = isOpen;
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder:         (_, g) => isOpenRef.current && Math.abs(g.dy) > 10,
      onPanResponderRelease: (_, g) => {
        if      (g.dy < -SWIPE_THRESHOLD) goNextRef.current();
        else if (g.dy >  SWIPE_THRESHOLD) goPrevRef.current();
      },
    })
  ).current;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.appTitleGroup}>
        <Text style={styles.appTitleName}>Su</Text>
        <Text style={styles.appTitleSub}>travel book</Text>
      </View>

      {/*
        Outer container scales dynamically (outerW×outerH).
        Inner 344×232 View is scale-transformed to fill it.
        bookWrap and BookOutline stay in 340×228 / 344×232 coordinate space.
      */}
      <View style={{ width: outerW, height: outerH }}>
        <View style={{
          position: 'absolute', width: 344, height: 232, top: 0, left: 0,
          transform: [
            { translateX: (outerW - 344) / 2 },
            { translateY: (outerH - 232) / 2 },
            { scale: outerW / 344 },
          ],
        }}>
          <View style={styles.bookWrap} {...panResponder.panHandlers}>
            {trips.map((trip, i) => (
              <TripPage
                key={trip.id}
                index={i}
                trip={trip}
                pageState={pageStates[i]}
                rotateAnim={pageAnims[i]}
                onTitlePress={pageStates[i] === 'active' ? () => setOverviewIdx(i) : undefined}
                onDeletePress={pageStates[i] === 'active' && trips.length > 1
                  ? () => handleDeleteTrip(trip.id, trip.customName ?? trip.name)
                  : undefined}
              />
            ))}
            <View pointerEvents={isOpen ? 'none' : 'auto'}>
              <BookCover coverAnim={coverAnim} onOpen={openBook} onAddTrip={handleAddTrip} />
            </View>
          </View>
          <BookOutline />
        </View>
      </View>

      {/*
        Fixed-height area below the book.
        Footer (when open) and map preview (when closed) share this space via cross-fade.
      */}
      <View style={[styles.belowBook, { width: bookW }]}>
        {/* Footer */}
        <Animated.View
          style={[styles.footerInner, { opacity: footerOpacity }]}
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

        {/* Destination strip */}
        <Animated.View
          style={[styles.mapInner, { opacity: mapOpacity }]}
          pointerEvents={isOpen ? 'none' : 'auto'}
        >
          <Text style={styles.statusStrip} numberOfLines={2}>
            {trips.map((t, i) => (
              <Text key={t.id}>
                {i > 0 ? <Text style={styles.statusDot}> · </Text> : null}
                <Text style={[
                  styles.statusName,
                  t.status === 'past' && styles.statusPast,
                  t.status === 'now' && styles.statusNow,
                ]}>{(t.customName ?? t.name).toLowerCase()}</Text>
              </Text>
            ))}
          </Text>
        </Animated.View>
      </View>

      <CardEditor
        trip={editingIdx !== null ? trips[editingIdx] : null}
        visible={editingIdx !== null}
        onClose={() => setEditingIdx(null)}
      />

      <TripOverview
        trip={overviewIdx !== null ? trips[overviewIdx] : null}
        index={overviewIdx}
        visible={overviewIdx !== null}
        onClose={() => setOverviewIdx(null)}
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
    'DMSans-Regular':                DMSans_400Regular,
    'DMSans-Medium':                 DMSans_500Medium,
    'CormorantGaramond-LightItalic': CormorantGaramond_300Light_Italic,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={styles.root}>
      <SuTravelBook />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  appTitleGroup: {
    alignItems: 'center',
    marginBottom: 18,
  },
  appTitleName: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 22,
    color: '#1a1a1a',
    lineHeight: 26,
  },
  appTitleSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 7,
    letterSpacing: 4,
    color: '#bbb',
    marginTop: 1,
  },

  bookWrap: {
    position: 'absolute', top: 2, left: 2,
    width: 340, height: 228,
    overflow: 'hidden',
  },

  // Fixed-height container — footer and map share this space via cross-fade
  belowBook: {
    height: 96,
    marginTop: 24,
  },

  // Footer (absoluteFill inside belowBook)
  footerInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  swipeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tick:     { width: 18, height: 1, backgroundColor: '#ddd' },
  swipeLabel: {
    fontSize: 8, letterSpacing: 2.5,
    color: '#ccc', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
  },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  footerDivider: { width: 1, height: 10, backgroundColor: '#e0e0e0' },
  editBtn: {
    fontSize: 8, letterSpacing: 1.5,
    color: '#91040C', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
    opacity: 0.8,
  },
  closeBtn: {
    fontSize: 8, letterSpacing: 1.5,
    color: '#bbb', textTransform: 'uppercase',
    fontFamily: 'DMSans-Regular',
  },

  // Destination strip (absoluteFill inside belowBook)
  mapInner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusStrip: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 15,
    textAlign: 'center',
  },
  statusName:  { color: '#1a1a1a' },
  statusPast:  { color: '#ccc' },
  statusNow:   { color: '#91040C' },
  statusDot:   { color: '#ddd' },
});
