import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

type Tab = 'text' | 'stickers';

export default function EditSheet({ trip, visible, onClose }: Props) {
  const { updateTrip, addElement, removeElement } = useTripStore();
  const [tab, setTab] = useState<Tab>('text');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [font, setFont] = useState('PlayfairDisplay-Black');

  useEffect(() => {
    if (trip) {
      setName(trip.customName ?? trip.name);
      setCountry(trip.customCountry ?? trip.country);
      setFont(trip.titleFont);
    }
  }, [trip]);

  function handleSave() {
    if (!trip) return;
    updateTrip(trip.id, {
      customName:    name.trim()    || undefined,
      customCountry: country.trim() || undefined,
      titleFont:     font,
    });
    onClose();
  }

  function handleReset() {
    if (!trip) return;
    updateTrip(trip.id, {
      customName:    undefined,
      customCountry: undefined,
      titleFont:     trip.titleFont,
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
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const el: CardElement = {
        id: makeId(),
        type: 'image',
        x: 100, y: 60,
        scale: 1,
        rotation: 0,
        uri: asset.uri,
        width: 80,
        height: 80,
      };
      addElement(trip.id, el);
    }
  }

  function handleAddText() {
    if (!trip) return;
    const el: CardElement = {
      id: makeId(),
      type: 'text',
      x: 40, y: 90,
      scale: 1,
      rotation: 0,
      text: 'Label',
      fontFamily: 'DMSans-Regular',
      fontSize: 14,
      color: '#1a1a1a',
    };
    addElement(trip.id, el);
  }

  const previewText = name.trim() || trip?.name || 'City';
  const elements = trip?.elements ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Edit Card</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.cancelBtn}>cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Tab row */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'text' && styles.tabBtnActive]}
              onPress={() => setTab('text')}
            >
              <Text style={[styles.tabBtnText, tab === 'text' && styles.tabBtnTextActive]}>TEXT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'stickers' && styles.tabBtnActive]}
              onPress={() => setTab('stickers')}
            >
              <Text style={[styles.tabBtnText, tab === 'stickers' && styles.tabBtnTextActive]}>STICKERS</Text>
            </TouchableOpacity>
          </View>

          {tab === 'text' && (
            <>
              {/* City name */}
              <Text style={styles.label}>CITY</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={trip?.name ?? 'City name'}
                placeholderTextColor="#ccc"
                returnKeyType="next"
              />

              {/* Country */}
              <Text style={styles.label}>COUNTRY</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder={trip?.country ?? 'Country'}
                placeholderTextColor="#ccc"
                returnKeyType="done"
              />

              {/* Font picker */}
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
                      <Text style={[styles.fontLabel, active && styles.fontLabelActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.resetBtn} onPress={handleReset} hitSlop={8}>
                  <Text style={styles.resetBtnText}>reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>SAVE</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {tab === 'stickers' && (
            <>
              {/* Add buttons */}
              <View style={styles.stickerAddRow}>
                <TouchableOpacity style={styles.stickerAddBtn} onPress={handleAddPhoto} activeOpacity={0.7}>
                  <Text style={styles.stickerAddIcon}>🖼</Text>
                  <Text style={styles.stickerAddLabel}>Add Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stickerAddBtn} onPress={handleAddText} activeOpacity={0.7}>
                  <Text style={styles.stickerAddIcon}>T</Text>
                  <Text style={styles.stickerAddLabel}>Add Text</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>ON THIS CARD</Text>

              <ScrollView style={styles.elementList} showsVerticalScrollIndicator={false}>
                {elements.length === 0 && (
                  <Text style={styles.emptyHint}>No stickers yet. Tap Add Photo or Add Text above.</Text>
                )}
                {elements.map((el) => (
                  <View key={el.id} style={styles.elementRow}>
                    {el.type === 'image' && el.uri ? (
                      <Image source={{ uri: el.uri }} style={styles.elementThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.elementThumbText}>
                        <Text style={styles.elementThumbTextLabel}>T</Text>
                      </View>
                    )}
                    <Text style={styles.elementDesc} numberOfLines={1}>
                      {el.type === 'text' ? (el.text ?? 'Text') : 'Photo'}
                    </Text>
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
                Tap a sticker on the card to select it. Drag to reposition.
              </Text>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 18,
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#aaa',
    letterSpacing: 0.5,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 4,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#91040C',
  },
  tabBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 8,
    letterSpacing: 2,
    color: '#bbb',
  },
  tabBtnTextActive: {
    color: '#91040C',
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 8,
    letterSpacing: 2.5,
    color: '#bbb',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    fontFamily: 'PlayfairDisplay-Regular',
    fontSize: 22,
    color: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    paddingVertical: 6,
    letterSpacing: 0.5,
  },
  fontScroll: {
    marginTop: 4,
  },
  fontRow: {
    gap: 8,
    paddingRight: 8,
  },
  fontPill: {
    width: 80,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
  },
  fontPillActive: {
    borderColor: '#91040C',
    backgroundColor: 'rgba(145,4,12,0.04)',
  },
  fontPreview: {
    fontSize: 18,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  fontPreviewActive: {
    color: '#91040C',
  },
  fontLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 7,
    letterSpacing: 1,
    color: '#bbb',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  fontLabelActive: {
    color: '#91040C',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  resetBtn: {
    paddingVertical: 6,
  },
  resetBtnText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    letterSpacing: 1,
    color: '#ccc',
    textTransform: 'uppercase',
  },
  saveBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
  },
  saveBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    letterSpacing: 2.5,
    color: '#fff',
  },
  // Stickers tab
  stickerAddRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  stickerAddBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
    gap: 6,
  },
  stickerAddIcon: {
    fontSize: 22,
  },
  stickerAddLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#888',
  },
  elementList: {
    maxHeight: 160,
    marginTop: 4,
  },
  emptyHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#ccc',
    paddingVertical: 16,
    textAlign: 'center',
  },
  elementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 10,
  },
  elementThumb: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  elementThumbText: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  elementThumbTextLabel: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 16,
    color: '#aaa',
  },
  elementDesc: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#555',
  },
  elementDeleteBtn: {
    padding: 4,
  },
  elementDeleteText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#ccc',
  },
  stickerHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 9,
    letterSpacing: 0.3,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 12,
  },
});
