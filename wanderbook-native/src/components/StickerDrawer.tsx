import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { StickerTemplate, useTripStore } from '../store/tripStore';

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface Props {
  onPlace: (template: StickerTemplate) => void;
}

export default function StickerDrawer({ onPlace }: Props) {
  const { stickerTemplates, addStickerTemplate, removeStickerTemplate } = useTripStore();
  const [longPressId, setLongPressId] = useState<string | null>(null);

  async function handleAddPhoto() {
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
      // Convert to PNG — preserves any transparency (e.g. from Lift Subject)
      const png = await manipulateAsync(result.assets[0].uri, [], {
        format: SaveFormat.PNG,
        compress: 1,
      });
      addStickerTemplate({ id: makeId(), uri: png.uri });
    }
  }

  async function handlePaste() {
    try {
      const img = await Clipboard.getImageAsync({ format: 'png' });
      if (!img?.data) {
        Alert.alert('No image', 'Copy an image first (try "Lift Subject" in Photos), then tap Paste.');
        return;
      }
      const path = (FileSystem.cacheDirectory ?? '') + `sticker_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, img.data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      addStickerTemplate({ id: makeId(), uri: path });
    } catch {
      Alert.alert('Paste failed', 'Could not read image from clipboard.');
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Remove sticker', 'Remove from drawer? Placed instances are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { removeStickerTemplate(id); setLongPressId(null); } },
    ]);
  }

  return (
    <View style={styles.root}>
      {/* Add buttons */}
      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPhoto} activeOpacity={0.7}>
          <Text style={styles.addIcon}>🖼</Text>
          <Text style={styles.addLabel}>Add Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={handlePaste} activeOpacity={0.7}>
          <Text style={styles.addIcon}>📋</Text>
          <Text style={styles.addLabel}>Paste</Text>
        </TouchableOpacity>
      </View>

      {stickerTemplates.length === 0 ? (
        <Text style={styles.emptyHint}>
          Add photos or paste iOS "Lift Subject" images to build your sticker drawer.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {stickerTemplates.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tile, longPressId === t.id && styles.tileSelected]}
              onPress={() => { setLongPressId(null); onPlace(t); }}
              onLongPress={() => setLongPressId(t.id)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: t.uri }} style={styles.tileImg} resizeMode="contain" />
              {longPressId === t.id && (
                <TouchableOpacity style={styles.tileDelete} onPress={() => confirmDelete(t.id)}>
                  <Text style={styles.tileDeleteText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.hint}>Tap to place · long-press to remove from drawer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },

  addRow: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#e8e8e8', alignItems: 'center', gap: 4,
  },
  addIcon:  { fontSize: 20 },
  addLabel: { fontFamily: 'DMSans-Regular', fontSize: 9, letterSpacing: 1, color: '#888', textTransform: 'uppercase' },

  emptyHint: {
    fontFamily: 'DMSans-Regular', fontSize: 11, color: '#ccc',
    textAlign: 'center', paddingVertical: 12, lineHeight: 18,
  },

  grid: { gap: 8, paddingHorizontal: 2, paddingVertical: 4 },
  tile: {
    width: 72, height: 72, borderRadius: 8,
    borderWidth: 1, borderColor: '#e8e8e8',
    backgroundColor: '#faf9f7',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
  },
  tileSelected: { borderColor: '#91040C' },
  tileImg:      { width: 62, height: 62 },
  tileDelete: {
    position: 'absolute', top: -8, right: -8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#91040C',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  tileDeleteText: { color: '#fff', fontSize: 9, fontFamily: 'DMSans-Regular' },

  hint: {
    fontFamily: 'DMSans-Regular', fontSize: 8, letterSpacing: 1,
    color: '#ccc', textAlign: 'center', textTransform: 'uppercase',
  },
});
