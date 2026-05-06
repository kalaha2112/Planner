import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Trip, CardElement, useTripStore } from '../store/tripStore';

const FONTS = [
  { key: 'PlayfairDisplay-Black',         label: 'Playfair Blk' },
  { key: 'PlayfairDisplay-Bold',          label: 'Playfair Bd'  },
  { key: 'PlayfairDisplay-BoldItalic',    label: 'Playfair It'  },
  { key: 'PlayfairDisplay-Italic',        label: 'Playfair Li'  },
  { key: 'BebasNeue',                     label: 'Bebas Neue'   },
  { key: 'DMSans-Regular',               label: 'DM Sans'      },
  { key: 'DMSans-Medium',               label: 'DM Sans Md'   },
  { key: 'CormorantGaramond-LightItalic', label: 'Cormorant'    },
];

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
}

type Tab = 'text' | 'trip' | 'stickers';

export default function EditSheet({ trip, visible, onClose }: Props) {
  const { updateTrip, addElement, removeElement } = useTripStore();
  const [tab, setTab]         = useState<Tab>('text');
  const [name, setName]       = useState('');
  const [country, setCountry] = useState('');
  const [font, setFont]       = useState('PlayfairDisplay-Black');
  // Trip details tab
  const [dateRange, setDateRange]         = useState('');
  const [daysAway, setDaysAway]           = useState('');
  const [budgetTotal, setBudgetTotal]     = useState('');
  const [budgetSpent, setBudgetSpent]     = useState('');
  const [hotelLocation, setHotelLocation] = useState('');
  const [hotelNights, setHotelNights]     = useState('');
  const [flightFrom, setFlightFrom]       = useState('');
  const [flightTo, setFlightTo]           = useState('');
  const [flightDate, setFlightDate]       = useState('');
  const [flightNumber, setFlightNumber]   = useState('');

  useEffect(() => {
    if (trip) {
      setName(trip.customName ?? trip.name);
      setCountry(trip.customCountry ?? trip.country);
      setFont(trip.titleFont);
      setDateRange(trip.dateRange     ?? '');
      setDaysAway(trip.daysAway       ?? '');
      setBudgetTotal(trip.budgetTotal != null ? String(trip.budgetTotal) : '');
      setBudgetSpent(trip.budgetSpent != null ? String(trip.budgetSpent) : '');
      setHotelLocation(trip.hotelLocation ?? '');
      setHotelNights(trip.hotelNights != null ? String(trip.hotelNights) : '');
      setFlightFrom(trip.flightFrom   ?? '');
      setFlightTo(trip.flightTo       ?? '');
      setFlightDate(trip.flightDate   ?? '');
      setFlightNumber(trip.flightNumber ?? '');
    }
  }, [trip?.id]);

  function handleSave() {
    if (!trip) return;
    updateTrip(trip.id, {
      customName:    name.trim()    || undefined,
      customCountry: country.trim() || undefined,
      titleFont:     font,
    });
    onClose();
  }

  function handleSaveTrip() {
    if (!trip) return;
    updateTrip(trip.id, {
      dateRange:     dateRange.trim()     || undefined,
      daysAway:      daysAway.trim()      || undefined,
      budgetTotal:   budgetTotal          ? Number(budgetTotal)          : undefined,
      budgetSpent:   budgetSpent          ? Number(budgetSpent)          : undefined,
      hotelLocation: hotelLocation.trim() || undefined,
      hotelNights:   hotelNights          ? parseInt(hotelNights, 10)    : undefined,
      flightFrom:    flightFrom.trim()    || undefined,
      flightTo:      flightTo.trim()      || undefined,
      flightDate:    flightDate.trim()    || undefined,
      flightNumber:  flightNumber.trim()  || undefined,
    });
    onClose();
  }

  function handleReset() {
    if (!trip) return;
    updateTrip(trip.id, {
      customName: undefined, customCountry: undefined, titleFont: trip.titleFont,
    });
    setName(trip.name);
    setCountry(trip.country);
  }

  async function handleAddPhoto() {
    if (!trip) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add stickers.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      // Convert to PNG for consistent rendering
      const png = await manipulateAsync(result.assets[0].uri, [], {
        format: SaveFormat.PNG,
        compress: 1,
      });
      addElement(trip.id, {
        id: makeId(), type: 'image',
        x: 100, y: 60, scale: 1, rotation: 0,
        uri: png.uri, width: 80, height: 80,
      });
    }
  }

  async function handlePaste() {
    if (!trip) return;
    try {
      const img = await Clipboard.getImageAsync({ format: 'png' });
      if (!img?.data) {
        Alert.alert('No image', 'Copy an image first, then tap Paste.');
        return;
      }
      const path = (FileSystem.cacheDirectory ?? '') + `paste_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, img.data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      addElement(trip.id, {
        id: makeId(), type: 'image',
        x: 100, y: 60, scale: 1, rotation: 0,
        uri: path, width: 80, height: 80,
      });
    } catch {
      Alert.alert('Paste failed', 'Could not read image from clipboard.');
    }
  }

  function handleAddLabel() {
    if (!trip) return;
    addElement(trip.id, {
      id: makeId(), type: 'text',
      x: 40, y: 90, scale: 1, rotation: 0,
      text: 'Label',
      fontFamily: font,
      fontSize: 14,
      color: '#1a1a1a',
    });
  }

  const previewText    = name.trim() || trip?.name || 'City';
  const imageElements  = (trip?.elements ?? []).filter((e) => e.type === 'image');
  const textElements   = (trip?.elements ?? []).filter((e) => e.type === 'text');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Edit Card</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.cancelBtn}>cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'text' && styles.tabBtnActive]}
              onPress={() => setTab('text')}
            >
              <Text style={[styles.tabBtnText, tab === 'text' && styles.tabBtnTextActive]}>TEXT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'trip' && styles.tabBtnActive]}
              onPress={() => setTab('trip')}
            >
              <Text style={[styles.tabBtnText, tab === 'trip' && styles.tabBtnTextActive]}>TRIP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'stickers' && styles.tabBtnActive]}
              onPress={() => setTab('stickers')}
            >
              <Text style={[styles.tabBtnText, tab === 'stickers' && styles.tabBtnTextActive]}>STICKERS</Text>
            </TouchableOpacity>
          </View>

          {/* ── TEXT TAB ── */}
          {tab === 'text' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>CITY</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={trip?.name ?? 'City name'}
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>COUNTRY</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder={trip?.country ?? 'Country'}
                placeholderTextColor="#ccc"
                returnKeyType="done"
              />

              <Text style={styles.label}>FONT</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.fontScroll}
                contentContainerStyle={styles.fontRow}
              >
                {FONTS.map((f) => {
                  const active = f.key === font;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.fontPill, active && styles.fontPillActive]}
                      onPress={() => setFont(f.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.fontPreview, { fontFamily: f.key }, active && styles.fontPreviewActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {previewText}
                      </Text>
                      <Text style={[styles.fontLabel, active && styles.fontLabelActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.resetBtn} onPress={handleReset} hitSlop={8}>
                  <Text style={styles.resetBtnText}>reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>SAVE</Text>
                </TouchableOpacity>
              </View>

              {/* ── Optional labels sub-section ── */}
              <View style={styles.labelSection}>
                <View style={styles.labelSectionHeader}>
                  <Text style={styles.label}>LABELS ON CARD</Text>
                  <TouchableOpacity onPress={handleAddLabel} hitSlop={8}>
                    <Text style={styles.addLabelBtn}>+ add</Text>
                  </TouchableOpacity>
                </View>
                {textElements.length === 0 && (
                  <Text style={styles.emptyHint}>No labels. Tap + add to place text on the card.</Text>
                )}
                {textElements.map((el) => (
                  <View key={el.id} style={styles.elementRow}>
                    <View style={styles.elementThumbText}>
                      <Text style={[styles.elementThumbTextLabel, { fontFamily: el.fontFamily }]}>T</Text>
                    </View>
                    <Text style={styles.elementDesc} numberOfLines={1}>{el.text ?? 'Label'}</Text>
                    <TouchableOpacity
                      onPress={() => trip && removeElement(trip.id, el.id)}
                      hitSlop={10}
                      style={styles.elementDeleteBtn}
                    >
                      <Text style={styles.elementDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── TRIP TAB ── */}
          {tab === 'trip' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>DATE RANGE</Text>
              <TextInput
                style={styles.input}
                value={dateRange}
                onChangeText={setDateRange}
                placeholder="e.g. May 15 – 22, 2026"
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>DAYS AWAY</Text>
              <TextInput
                style={styles.input}
                value={daysAway}
                onChangeText={setDaysAway}
                placeholder="e.g. 13 days away"
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>BUDGET TOTAL ($)</Text>
              <TextInput
                style={styles.input}
                value={budgetTotal}
                onChangeText={setBudgetTotal}
                placeholder="e.g. 3000"
                placeholderTextColor="#ccc"
                keyboardType="numeric"
                returnKeyType="next"
              />

              <Text style={styles.label}>BUDGET SPENT ($)</Text>
              <TextInput
                style={styles.input}
                value={budgetSpent}
                onChangeText={setBudgetSpent}
                placeholder="e.g. 1420"
                placeholderTextColor="#ccc"
                keyboardType="numeric"
                returnKeyType="next"
              />

              <Text style={styles.label}>HOTEL LOCATION</Text>
              <TextInput
                style={styles.input}
                value={hotelLocation}
                onChangeText={setHotelLocation}
                placeholder="e.g. Ubud"
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>HOTEL NIGHTS</Text>
              <TextInput
                style={styles.input}
                value={hotelNights}
                onChangeText={setHotelNights}
                placeholder="e.g. 7"
                placeholderTextColor="#ccc"
                keyboardType="numeric"
                returnKeyType="done"
              />

              <Text style={styles.label}>FLIGHT FROM</Text>
              <TextInput
                style={styles.input}
                value={flightFrom}
                onChangeText={setFlightFrom}
                placeholder="e.g. SYD"
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>FLIGHT TO</Text>
              <TextInput
                style={styles.input}
                value={flightTo}
                onChangeText={setFlightTo}
                placeholder="e.g. DPS"
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>FLIGHT DATE</Text>
              <TextInput
                style={styles.input}
                value={flightDate}
                onChangeText={setFlightDate}
                placeholder="e.g. May 15, 2026"
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              <Text style={styles.label}>FLIGHT NUMBER</Text>
              <TextInput
                style={styles.input}
                value={flightNumber}
                onChangeText={setFlightNumber}
                placeholder="e.g. QF43"
                placeholderTextColor="#ccc"
                returnKeyType="done"
              />

              <View style={styles.actions}>
                <View />
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTrip}>
                  <Text style={styles.saveBtnText}>SAVE</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── STICKERS TAB ── */}
          {tab === 'stickers' && (
            <>
              <View style={styles.stickerAddRow}>
                <TouchableOpacity style={styles.stickerAddBtn} onPress={handleAddPhoto} activeOpacity={0.7}>
                  <Text style={styles.stickerAddIcon}>🖼</Text>
                  <Text style={styles.stickerAddLabel}>Add Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stickerAddBtn} onPress={handlePaste} activeOpacity={0.7}>
                  <Text style={styles.stickerAddIcon}>📋</Text>
                  <Text style={styles.stickerAddLabel}>Paste</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>ON THIS CARD</Text>

              <ScrollView style={styles.elementList} showsVerticalScrollIndicator={false}>
                {imageElements.length === 0 && (
                  <Text style={styles.emptyHint}>No stickers yet.</Text>
                )}
                {imageElements.map((el) => (
                  <View key={el.id} style={styles.elementRow}>
                    {el.uri ? (
                      <Image source={{ uri: el.uri }} style={styles.elementThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.elementThumb} />
                    )}
                    <Text style={styles.elementDesc} numberOfLines={1}>Photo</Text>
                    <TouchableOpacity
                      onPress={() => trip && removeElement(trip.id, el.id)}
                      hitSlop={10}
                      style={styles.elementDeleteBtn}
                    >
                      <Text style={styles.elementDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.stickerHint}>
                Tap a sticker on the card to select · drag to reposition
              </Text>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.32)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e0e0e0', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  title:     { fontFamily: 'PlayfairDisplay-Bold', fontSize: 18, color: '#1a1a1a', letterSpacing: 0.2 },
  cancelBtn: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#aaa', letterSpacing: 0.5 },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 4,
  },
  tabBtn: {
    paddingVertical: 8, paddingHorizontal: 4, marginRight: 20,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:     { borderBottomColor: '#91040C' },
  tabBtnText:       { fontFamily: 'DMSans-Medium', fontSize: 8, letterSpacing: 2, color: '#bbb' },
  tabBtnTextActive: { color: '#91040C' },
  label: {
    fontFamily: 'DMSans-Medium', fontSize: 8, letterSpacing: 2.5,
    color: '#bbb', marginBottom: 6, marginTop: 12,
  },
  input: {
    fontFamily: 'PlayfairDisplay-Regular', fontSize: 22, color: '#1a1a1a',
    borderBottomWidth: 1, borderBottomColor: '#e8e8e8', paddingVertical: 6, letterSpacing: 0.5,
  },
  fontScroll: { marginTop: 4 },
  fontRow:    { gap: 8, paddingRight: 8 },
  fontPill: {
    width: 80, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#e8e8e8', alignItems: 'center',
  },
  fontPillActive:    { borderColor: '#91040C', backgroundColor: 'rgba(145,4,12,0.04)' },
  fontPreview:       { fontSize: 18, color: '#1a1a1a', marginBottom: 4 },
  fontPreviewActive: { color: '#91040C' },
  fontLabel:         { fontFamily: 'DMSans-Regular', fontSize: 7, letterSpacing: 1, color: '#bbb', textTransform: 'uppercase', textAlign: 'center' },
  fontLabelActive:   { color: '#91040C' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  resetBtn:     { paddingVertical: 6 },
  resetBtnText: { fontFamily: 'DMSans-Regular', fontSize: 11, letterSpacing: 1, color: '#ccc', textTransform: 'uppercase' },
  saveBtn:      { backgroundColor: '#1a1a1a', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 4 },
  saveBtnText:  { fontFamily: 'DMSans-Medium', fontSize: 11, letterSpacing: 2.5, color: '#fff' },

  // Labels sub-section
  labelSection:       { marginTop: 20, paddingBottom: 8 },
  labelSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addLabelBtn:        { fontFamily: 'DMSans-Regular', fontSize: 10, color: '#91040C', letterSpacing: 1 },

  // Stickers tab
  stickerAddRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 4 },
  stickerAddBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e8e8e8', alignItems: 'center', gap: 6,
  },
  stickerAddIcon:  { fontSize: 22 },
  stickerAddLabel: { fontFamily: 'DMSans-Regular', fontSize: 10, letterSpacing: 0.5, color: '#888' },
  elementList:     { maxHeight: 160, marginTop: 4 },
  emptyHint: {
    fontFamily: 'DMSans-Regular', fontSize: 11, color: '#ccc',
    paddingVertical: 16, textAlign: 'center',
  },
  elementRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 10,
  },
  elementThumb: { width: 36, height: 36, borderRadius: 4, backgroundColor: '#f0f0f0' },
  elementThumbText: {
    width: 36, height: 36, borderRadius: 4,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  elementThumbTextLabel: { fontSize: 16, color: '#aaa' },
  elementDesc:       { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 12, color: '#555' },
  elementDeleteBtn:  { padding: 4 },
  elementDeleteText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#ccc' },
  stickerHint: {
    fontFamily: 'DMSans-Regular', fontSize: 9, letterSpacing: 0.3,
    color: '#ccc', textAlign: 'center', marginTop: 12,
  },
});
