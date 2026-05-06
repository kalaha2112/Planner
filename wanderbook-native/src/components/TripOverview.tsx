import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Trip, useTripStore } from '../store/tripStore';
import ParisCard   from './cards/ParisCard';
import KyotoCard   from './cards/KyotoCard';
import BaliCard    from './cards/BaliCard';
import MoroccoCard from './cards/MoroccoCard';
import LisbonCard  from './cards/LisbonCard';

const CARDS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard];

const STATUS_LABEL: Record<Trip['status'], string> = {
  past:     'PAST',
  now:      'NOW',
  upcoming: 'UPCOMING',
};

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
}

export default function TripOverview({ trip, visible, onClose }: Props) {
  const { updateTrip } = useTripStore();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (trip) setNotes(trip.notes ?? '');
  }, [trip]);

  function handleSaveNotes() {
    if (!trip) return;
    updateTrip(trip.id, { notes: notes.trim() || undefined });
  }

  if (!trip) return null;

  const Card = CARDS[trip.cardDesign];
  const displayName    = trip.customName    ?? trip.name;
  const displayCountry = trip.customCountry ?? trip.country;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero */}
            <Text style={[styles.heroCity, { fontFamily: trip.titleFont }]}>
              {displayName}
            </Text>
            <Text style={styles.heroCountry}>{displayCountry}</Text>

            {/* Status badge */}
            <View style={[styles.statusBadge, styles[`status_${trip.status}`]]}>
              <Text style={[styles.statusText, styles[`statusText_${trip.status}`]]}>
                {STATUS_LABEL[trip.status]}
              </Text>
            </View>

            {/* Card preview — read-only (no onTitlePress) */}
            <View style={styles.cardPreviewWrap}>
              <View style={styles.cardPreview} pointerEvents="none">
                <Card
                  customName={trip.customName}
                  customCountry={trip.customCountry}
                  titleFont={trip.titleFont}
                />
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.notesLabel}>NOTES</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              onBlur={handleSaveNotes}
              placeholder="Add a memory, note, or date…"
              placeholderTextColor="#ccc"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNotes}>
              <Text style={styles.saveBtnText}>SAVE NOTES</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  closeBtn: {
    position: 'absolute',
    top: 56, right: 28,
    zIndex: 10,
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 18,
    color: '#aaa',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
  heroCity: {
    fontSize: 64,
    lineHeight: 60,
    letterSpacing: -1.5,
    color: '#1a1a1a',
    marginBottom: 6,
  },
  heroCountry: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 22,
    color: '#999',
    marginBottom: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 32,
  },
  status_past:     { backgroundColor: '#ebebeb' },
  status_now:      { backgroundColor: 'rgba(145,4,12,0.09)' },
  status_upcoming: { backgroundColor: 'rgba(0,0,0,0.05)' },
  statusText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 8,
    letterSpacing: 2,
  },
  statusText_past:     { color: '#999' },
  statusText_now:      { color: '#91040C' },
  statusText_upcoming: { color: '#555' },
  cardPreviewWrap: {
    alignItems: 'center',
    marginBottom: 36,
  },
  cardPreview: {
    width: 340, height: 228,
    borderRadius: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 6,
  },
  notesLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 8,
    letterSpacing: 2.5,
    color: '#bbb',
    marginBottom: 10,
  },
  notesInput: {
    fontFamily: 'PlayfairDisplay-Regular',
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 26,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ece9e4',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  saveBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  saveBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 9,
    letterSpacing: 2,
    color: '#fff',
  },
} as any);
