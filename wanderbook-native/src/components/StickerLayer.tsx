import { useRef, useState } from 'react';
import {
  View, Image, Text, TextInput, PanResponder,
  TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Trip, CardElement, useTripStore } from '../store/tripStore';

const SCALES = [0.5, 1.0, 1.5, 2.0];
const SIZES  = [10, 14, 20, 28];
const FONTS  = [
  { key: 'PlayfairDisplay-Black',         short: 'PF●'  },
  { key: 'PlayfairDisplay-Bold',          short: 'PF Bd' },
  { key: 'PlayfairDisplay-BoldItalic',    short: 'PF It' },
  { key: 'PlayfairDisplay-Italic',        short: 'PF Li' },
  { key: 'BebasNeue',                     short: 'Bebas' },
  { key: 'DMSans-Regular',               short: 'DM'    },
  { key: 'DMSans-Medium',               short: 'DM Md' },
  { key: 'CormorantGaramond-LightItalic', short: 'CG'    },
];

interface ElementProps {
  el: CardElement;
  tripId: string;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<CardElement>) => void;
  onRemove: () => void;
  bookScale: number;
}

function DraggableEl({ el, isSelected, onSelect, onUpdate, onRemove, bookScale }: ElementProps) {
  const refs = useRef({ el, isSelected, onSelect, onUpdate, onRemove, bookScale });
  refs.current = { el, isSelected, onSelect, onUpdate, onRemove, bookScale };

  const startPos   = useRef({ x: 0, y: 0 });
  const moved      = useRef(false);
  const longTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      // Text elements in selected/edit state: let TextInput capture the touch
      onStartShouldSetPanResponder: () =>
        !(refs.current.isSelected && refs.current.el.type === 'text'),
      onPanResponderGrant: () => {
        startPos.current = { x: refs.current.el.x, y: refs.current.el.y };
        moved.current = false;
        longTimer.current = setTimeout(() => refs.current.onSelect(), 400);
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) {
          moved.current = true;
          if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
        }
        const bs = refs.current.bookScale;
        refs.current.onUpdate({
          x: startPos.current.x + g.dx / bs,
          y: startPos.current.y + g.dy / bs,
        });
      },
      onPanResponderRelease: (_, g) => {
        if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
        const bs = refs.current.bookScale;
        if (!moved.current) refs.current.onSelect();
        else refs.current.onUpdate({
          x: startPos.current.x + g.dx / bs,
          y: startPos.current.y + g.dy / bs,
        });
      },
    })
  ).current;

  return (
    <View style={{ position: 'absolute', left: el.x, top: el.y }} {...panResponder.panHandlers}>
      {el.type === 'image' ? (
        <Image
          source={{ uri: el.uri! }}
          style={{ width: (el.width ?? 80) * el.scale, height: (el.height ?? 80) * el.scale }}
          resizeMode="contain"
        />
      ) : isSelected ? (
        <TextInput
          value={el.text}
          onChangeText={(t) => onUpdate({ text: t })}
          style={{
            fontFamily: el.fontFamily ?? 'DMSans-Regular',
            fontSize:   (el.fontSize  ?? 14) * el.scale,
            color:      el.color      ?? '#1a1a1a',
            minWidth: 60,
            padding: 0,
          }}
          multiline
          blurOnSubmit
        />
      ) : (
        <Text style={{
          fontFamily: el.fontFamily ?? 'DMSans-Regular',
          fontSize:   (el.fontSize  ?? 14) * el.scale,
          color:      el.color      ?? '#1a1a1a',
        }}>
          {el.text}
        </Text>
      )}

      {isSelected && (
        <View style={styles.deleteBadge}>
          <TouchableOpacity onPress={onRemove} hitSlop={6}>
            <Text style={styles.deleteBadgeText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

interface Props { trip: Trip; bookScale?: number; }

export default function StickerLayer({ trip, bookScale = 1 }: Props) {
  const { updateElement, removeElement } = useTripStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (trip.elements.length === 0) return null;

  const selectedEl = trip.elements.find((e) => e.id === selectedId) ?? null;
  const isText  = selectedEl?.type === 'text';
  const isImage = selectedEl?.type === 'image';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {trip.elements.map((el) => (
        <DraggableEl
          key={el.id}
          el={el}
          tripId={trip.id}
          isSelected={selectedId === el.id}
          onSelect={() => setSelectedId((p) => (p === el.id ? null : el.id))}
          onUpdate={(patch) => updateElement(trip.id, el.id, patch)}
          onRemove={() => { removeElement(trip.id, el.id); setSelectedId(null); }}
          bookScale={bookScale}
        />
      ))}

      {/* Image selected: scale bar */}
      {selectedId && isImage && (
        <View style={styles.controlBar}>
          {SCALES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.scaleBtn, selectedEl!.scale === s && styles.btnActive]}
              onPress={() => updateElement(trip.id, selectedId, { scale: s })}
            >
              <Text style={[styles.scaleBtnText, selectedEl!.scale === s && styles.btnTextActive]}>
                {s}×
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Text selected: size row + font row */}
      {selectedId && isText && (
        <View style={styles.textControlBar}>
          {/* Size row */}
          <View style={styles.sizeRow}>
            {SIZES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sizeBtn, selectedEl!.fontSize === s && styles.btnActive]}
                onPress={() => updateElement(trip.id, selectedId, { fontSize: s })}
              >
                <Text style={[styles.sizeBtnText, selectedEl!.fontSize === s && styles.btnTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Font row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fontScroll}>
            {FONTS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.fontBtn, selectedEl!.fontFamily === f.key && styles.btnActive]}
                onPress={() => updateElement(trip.id, selectedId, { fontFamily: f.key })}
              >
                <Text
                  style={[
                    { fontFamily: f.key, fontSize: 9, color: '#999' },
                    selectedEl!.fontFamily === f.key && styles.btnTextActive,
                  ]}
                >
                  {f.short}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deleteBadge: {
    position: 'absolute', top: -10, right: -10,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
  },
  deleteBadgeText: { color: '#fff', fontSize: 7, fontFamily: 'DMSans-Regular' },

  controlBar: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', gap: 4,
    backgroundColor: 'rgba(26,26,26,0.82)',
    borderRadius: 8, padding: 5, zIndex: 30,
  },
  scaleBtn:     { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 },
  scaleBtnText: { fontFamily: 'DMSans-Regular', fontSize: 9, letterSpacing: 0.3, color: '#888' },

  textControlBar: {
    position: 'absolute', bottom: 8, left: 8, right: 8,
    backgroundColor: 'rgba(26,26,26,0.85)',
    borderRadius: 8, padding: 5, gap: 4, zIndex: 30,
  },
  sizeRow:    { flexDirection: 'row', gap: 4 },
  sizeBtn:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  sizeBtnText:{ fontFamily: 'DMSans-Regular', fontSize: 9, color: '#888' },
  fontScroll: { flexGrow: 0 },
  fontBtn:    { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, marginRight: 2 },

  btnActive:     { backgroundColor: '#91040C' },
  btnTextActive: { color: '#fff' },
});
