import { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView, Image,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Trip, useTripStore } from '../store/tripStore';
import ParisCard   from './cards/ParisCard';
import KyotoCard   from './cards/KyotoCard';
import BaliCard    from './cards/BaliCard';
import MoroccoCard from './cards/MoroccoCard';
import LisbonCard  from './cards/LisbonCard';

const CARDS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard];

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
}

export default function TripOverview({ trip, visible, onClose }: Props) {
  const { updateTrip } = useTripStore();

  const [dateRange,    setDateRange]    = useState('');
  const [daysAway,     setDaysAway]     = useState('');
  const [budgetTotal,  setBudgetTotal]  = useState('');
  const [budgetSpent,  setBudgetSpent]  = useState('');
  const [hotelLoc,     setHotelLoc]     = useState('');
  const [hotelNights,  setHotelNights]  = useState('');
  const [itinerary,    setItinerary]    = useState<string[][]>([[], [], []]);
  const [selectedDay,  setSelectedDay]  = useState(0);

  useEffect(() => {
    if (trip) {
      setDateRange(trip.dateRange   ?? '');
      setDaysAway(trip.daysAway     ?? '');
      setBudgetTotal(trip.budgetTotal?.toString() ?? '');
      setBudgetSpent(trip.budgetSpent?.toString() ?? '');
      setHotelLoc(trip.hotelLocation ?? '');
      setHotelNights(trip.hotelNights?.toString() ?? '');
      setItinerary(trip.itinerary ?? [[], [], []]);
      setSelectedDay(0);
    }
  }, [trip?.id]);

  const save = useCallback((patch: Parameters<typeof updateTrip>[1]) => {
    if (trip) updateTrip(trip.id, patch);
  }, [trip, updateTrip]);

  function updateActivity(day: number, idx: number, text: string) {
    const next = itinerary.map((d, di) =>
      di === day ? d.map((a, ai) => (ai === idx ? text : a)) : d
    );
    setItinerary(next);
    save({ itinerary: next });
  }

  function addActivity() {
    const next = itinerary.map((d, di) => di === selectedDay ? [...d, ''] : d);
    setItinerary(next);
    save({ itinerary: next });
  }

  function removeActivity(day: number, idx: number) {
    const next = itinerary.map((d, di) =>
      di === day ? d.filter((_, ai) => ai !== idx) : d
    );
    setItinerary(next);
    save({ itinerary: next });
  }

  function addDay() {
    if (itinerary.length >= 14) return;
    const next = [...itinerary, []];
    setItinerary(next);
    save({ itinerary: next });
  }

  if (!trip) return null;

  const Card         = CARDS[trip.cardDesign];
  const displayName  = trip.customName    ?? trip.name;
  const displayCountry = trip.customCountry ?? trip.country;
  const photos       = trip.elements.filter((e) => e.type === 'image');
  const totalNum     = parseFloat(budgetTotal)  || 0;
  const spentNum     = parseFloat(budgetSpent)  || 0;
  const remaining    = totalNum - spentNum;
  const progress     = totalNum > 0 ? Math.min(spentNum / totalNum, 1) : 0;
  const nightsNum    = parseInt(hotelNights) || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ← Back */}
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Hero ── */}
            <View style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroCountry}>{displayCountry.toUpperCase()}</Text>
                <Text style={[styles.heroCity, { fontFamily: trip.titleFont }]}>
                  {displayName}
                </Text>

                <TextInput
                  style={styles.heroDate}
                  value={dateRange}
                  onChangeText={setDateRange}
                  onBlur={() => save({ dateRange: dateRange.trim() || undefined })}
                  placeholder="May 15 – 22, 2026"
                  placeholderTextColor="#ccc"
                />

                {/* Countdown pill */}
                <View style={styles.countdownPill}>
                  <View style={styles.redDot} />
                  <TextInput
                    style={styles.countdownText}
                    value={daysAway}
                    onChangeText={setDaysAway}
                    onBlur={() => save({ daysAway: daysAway.trim() || undefined })}
                    placeholder="13 days away"
                    placeholderTextColor="#ddd"
                  />
                </View>
              </View>

              {/* Polaroid stack */}
              <View style={styles.polaroidStack}>
                {photos.length > 0 ? (
                  photos.slice(0, 2).map((el, i) => (
                    <View
                      key={el.id}
                      style={[
                        styles.polaroid,
                        i === 0
                          ? { transform: [{ rotate: '5deg' }] }
                          : { transform: [{ rotate: '-4deg' }], marginTop: -60, marginLeft: -20 },
                      ]}
                    >
                      <Image source={{ uri: el.uri! }} style={styles.polaroidImg} resizeMode="cover" />
                      <Text style={styles.polaroidLabel} numberOfLines={1}>
                        {displayName.toLowerCase()}
                      </Text>
                    </View>
                  ))
                ) : (
                  <>
                    <View style={[styles.polaroid, styles.polaroidEmpty, { transform: [{ rotate: '5deg' }] }]}>
                      <View style={styles.polaroidImgEmpty} />
                      <Text style={styles.polaroidLabel}>{displayName.toLowerCase()}</Text>
                    </View>
                    <View style={[styles.polaroid, styles.polaroidEmpty, { transform: [{ rotate: '-4deg' }], marginTop: -60, marginLeft: -20 }]}>
                      <View style={styles.polaroidImgEmpty} />
                      <Text style={styles.polaroidLabel}>may '26</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* ── Itinerary ── */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>DAY BY DAY</Text>
              <Text style={styles.sectionTitle}>Itinerary</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabScroll}>
                <View style={styles.dayTabs}>
                  {itinerary.map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dayTab, selectedDay === i && styles.dayTabActive]}
                      onPress={() => setSelectedDay(i)}
                    >
                      <Text style={[styles.dayTabText, selectedDay === i && styles.dayTabTextActive]}>
                        Day {i + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.addDayBtn} onPress={addDay}>
                    <Text style={styles.addDayText}>+ day</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.activitiesList}>
                {(itinerary[selectedDay] ?? []).map((activity, i) => (
                  <View key={i} style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <TextInput
                      style={styles.activityInput}
                      value={activity}
                      onChangeText={(t) => updateActivity(selectedDay, i, t)}
                      onBlur={() => save({ itinerary })}
                      placeholder="Add activity…"
                      placeholderTextColor="#ccc"
                      multiline
                    />
                    <TouchableOpacity onPress={() => removeActivity(selectedDay, i)} hitSlop={8}>
                      <Text style={styles.activityDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addActivityBtn} onPress={addActivity}>
                  <Text style={styles.addActivityText}>+ add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── OOTD + Budget row ── */}
            <View style={styles.twoColRow}>
              {/* OOTD card */}
              <View style={[styles.card, styles.ootdCard]}>
                <Text style={styles.sectionLabel}>TODAY'S LOOK</Text>
                <Text style={styles.sectionTitle}>OOTD</Text>
                <View style={styles.ootdEmojis}>
                  <Text style={styles.ootdEmoji}>👔</Text>
                  <Text style={styles.ootdEmoji}>👜</Text>
                </View>
                <Text style={styles.ootdEmoji}>👟</Text>
              </View>

              {/* Budget card */}
              <View style={[styles.card, styles.budgetCard]}>
                <Text style={styles.sectionLabel}>SPENDING</Text>
                <Text style={styles.sectionTitle}>Budget</Text>
                <View style={styles.budgetAmountRow}>
                  <Text style={styles.budgetCurrency}>$</Text>
                  <TextInput
                    style={styles.budgetSpentInput}
                    value={budgetSpent}
                    onChangeText={setBudgetSpent}
                    onBlur={() => save({ budgetSpent: spentNum || undefined })}
                    placeholder="0"
                    placeholderTextColor="#ccc"
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.budgetOf}>
                  of ${totalNum > 0 ? totalNum.toLocaleString() : (
                    <TextInput
                      style={styles.budgetTotalInline}
                      value={budgetTotal}
                      onChangeText={setBudgetTotal}
                      onBlur={() => save({ budgetTotal: totalNum || undefined })}
                      placeholder="3,000"
                      placeholderTextColor="#ccc"
                      keyboardType="numeric"
                    />
                  )}
                </Text>
                <TextInput
                  style={styles.budgetTotalEdit}
                  value={budgetTotal}
                  onChangeText={setBudgetTotal}
                  onBlur={() => save({ budgetTotal: parseFloat(budgetTotal) || undefined })}
                  placeholder="total budget"
                  placeholderTextColor="#ddd"
                  keyboardType="numeric"
                />
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { flex: progress }]} />
                  <View style={{ flex: 1 - progress }} />
                </View>
                <Text style={styles.budgetRemaining}>
                  {remaining > 0
                    ? `$${remaining.toLocaleString()} left`
                    : remaining < 0
                    ? `$${Math.abs(remaining).toLocaleString()} over`
                    : 'on budget'}
                </Text>
              </View>
            </View>

            {/* ── Hotel ── */}
            <View style={styles.card}>
              <View style={styles.hotelRow}>
                <View style={styles.hotelLeft}>
                  <TextInput
                    style={styles.sectionLabel}
                    value={hotelLoc}
                    onChangeText={setHotelLoc}
                    onBlur={() => save({ hotelLocation: hotelLoc.trim() || undefined })}
                    placeholder="LOCATION"
                    placeholderTextColor="#ccc"
                  />
                  {nightsNum > 0 && (
                    <Text style={styles.sectionLabelExtra}> · {nightsNum} NIGHTS</Text>
                  )}
                  <Text style={styles.sectionTitle}>Hotel</Text>
                  <TextInput
                    style={styles.hotelNightsInput}
                    value={hotelNights}
                    onChangeText={setHotelNights}
                    onBlur={() => save({ hotelNights: parseInt(hotelNights) || undefined })}
                    placeholder="nights"
                    placeholderTextColor="#ddd"
                    keyboardType="numeric"
                  />
                </View>
                {photos.length > 0 && (
                  <Image
                    source={{ uri: photos[photos.length - 1].uri! }}
                    style={styles.hotelPhoto}
                    resizeMode="cover"
                  />
                )}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf9f7' },

  backBtn: {
    position: 'absolute', top: 54, left: 20, zIndex: 10,
    padding: 8,
  },
  backArrow: {
    fontFamily: 'DMSans-Regular',
    fontSize: 22, color: '#1a1a1a',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 96, paddingHorizontal: 20, paddingBottom: 60 },

  // Hero
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  heroLeft: { flex: 1 },
  heroCountry: {
    fontFamily: 'DMSans-Medium',
    fontSize: 8, letterSpacing: 2.5, color: '#999',
    textTransform: 'uppercase', marginBottom: 4,
  },
  heroCity: {
    fontSize: 52, lineHeight: 48, letterSpacing: -1.5, color: '#1a1a1a', marginBottom: 6,
  },
  heroDate: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 17, color: '#555', marginBottom: 10,
    padding: 0,
  },
  countdownPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: '#1a1a1a', borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 5, gap: 6,
  },
  redDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#91040C' },
  countdownText: {
    fontFamily: 'DMSans-Regular', fontSize: 11, color: '#1a1a1a',
    padding: 0, minWidth: 80,
  },

  // Polaroids
  polaroidStack: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 24, width: 120 },
  polaroid: {
    backgroundColor: '#1a1a1a',
    padding: 4, paddingBottom: 18,
    width: 90, borderRadius: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  polaroidEmpty: { backgroundColor: '#333' },
  polaroidImg:   { width: 82, height: 72, borderRadius: 1 },
  polaroidImgEmpty: { width: 82, height: 72, backgroundColor: '#555', borderRadius: 1 },
  polaroidLabel: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 8, color: '#ccc', textAlign: 'center',
    marginTop: 4,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#1a1a1a', borderRadius: 8,
    padding: 16, marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 7, letterSpacing: 2, color: '#aaa',
    textTransform: 'uppercase', marginBottom: 2, padding: 0,
  },
  sectionLabelExtra: {
    fontFamily: 'DMSans-Medium',
    fontSize: 7, letterSpacing: 2, color: '#aaa',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 22, color: '#1a1a1a', letterSpacing: -0.3, marginBottom: 12,
  },

  // Day tabs
  dayTabScroll:  { marginBottom: 12 },
  dayTabs:       { flexDirection: 'row', gap: 6 },
  dayTab: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 50, borderWidth: 1.5, borderColor: '#1a1a1a',
  },
  dayTabActive:     { backgroundColor: '#1a1a1a' },
  dayTabText:       { fontFamily: 'DMSans-Regular', fontSize: 10, color: '#1a1a1a' },
  dayTabTextActive: { color: '#fff' },
  addDayBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 50, borderWidth: 1, borderColor: '#ddd',
  },
  addDayText: { fontFamily: 'DMSans-Regular', fontSize: 10, color: '#bbb' },

  // Activities
  activitiesList: { gap: 6 },
  activityRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  activityDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: '#91040C', marginTop: 8,
  },
  activityInput: {
    flex: 1,
    fontFamily: 'PlayfairDisplay-Regular', fontSize: 13,
    color: '#1a1a1a', lineHeight: 20,
    padding: 0,
  },
  activityDelete: { fontFamily: 'DMSans-Regular', fontSize: 11, color: '#ddd', paddingTop: 4 },
  addActivityBtn: { paddingVertical: 6, alignSelf: 'flex-start' },
  addActivityText: { fontFamily: 'DMSans-Regular', fontSize: 10, letterSpacing: 0.5, color: '#bbb' },

  // Two-col
  twoColRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  ootdCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#1a1a1a', borderRadius: 8, padding: 14,
  },
  ootdEmojis: { flexDirection: 'row', gap: 4, marginTop: 8 },
  ootdEmoji: { fontSize: 22 },
  budgetCard: { flex: 1.4 },

  // Budget
  budgetAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1, marginBottom: 0 },
  budgetCurrency: {
    fontFamily: 'PlayfairDisplay-Black', fontSize: 20, color: '#1a1a1a',
  },
  budgetSpentInput: {
    fontFamily: 'PlayfairDisplay-Black', fontSize: 28, color: '#1a1a1a',
    padding: 0, minWidth: 60,
  },
  budgetOf: {
    fontFamily: 'DMSans-Regular', fontSize: 9, color: '#bbb', marginBottom: 4,
  },
  budgetTotalEdit: {
    fontFamily: 'DMSans-Regular', fontSize: 9, color: '#bbb', padding: 0, marginBottom: 6,
  },
  budgetTotalInline: { fontFamily: 'DMSans-Regular', fontSize: 9, color: '#bbb', padding: 0 },
  progressTrack: {
    flexDirection: 'row', height: 3,
    backgroundColor: '#ece9e4', borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { backgroundColor: '#1a1a1a', borderRadius: 2 },
  budgetRemaining: {
    fontFamily: 'CormorantGaramond-LightItalic', fontSize: 13, color: '#91040C',
  },

  // Hotel
  hotelRow: { flexDirection: 'row', gap: 12 },
  hotelLeft: { flex: 1 },
  hotelNightsInput: {
    fontFamily: 'DMSans-Regular', fontSize: 9, color: '#bbb', padding: 0, marginTop: -8,
  },
  hotelPhoto: { width: 80, height: 80, borderRadius: 4, backgroundColor: '#f0f0f0' },
});
