import { useRef, useState } from 'react';
import {
  View, Image, Text, TextInput, PanResponder,
  TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
  allElements: CardElement[];
  onBringFront: () => void;
  onSendBack: () => void;
}

function DraggableEl({
  el, isSelected, onSelect, onUpdate, onRemove,
  bookScale, onBringFront, onSendBack,
}: ElementProps) {
  const refs = useRef({ el, isSelected, onSelect, onUpdate, onRemove, bookScale });
  refs.current = { el, isSelected, onSelect, onUpdate, onRemove, bookScale };

  const startPos  = useRef({ x: 0, y: 0 });
  const moved     = useRef(false);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggablePath = el.type === 'path' && el.draggable;
  const isStaticPath    = el.type === 'path' && !el.draggable;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        if (isStaticPath) return false;
        return !(refs.current.isSelected && refs.current.el.type === 'text');
      },
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

  if (isStaticPath) {
    // Fixed stroke — rendered in place, tap selects for deletion only
    const w = (el.width ?? 40) * el.scale;
    const h = (el.height ?? 40) * el.scale;
    return (
      <View
        style={{ position: 'absolute', left: el.x, top: el.y }}
        onTouchEnd={() => onSelect()}
      >
        <Svg
          width={w}
          height={h}
          viewBox={`0 0 ${el.width ?? 40} ${el.height ?? 40}`}
        >
          <Path
            d={el.pathD ?? ''}
            stroke={el.strokeColor ?? '#1a1a1a'}
            strokeWidth={el.strokeWidth ?? 2}
            strokeOpacity={el.strokeOpacity ?? 1}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
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

  return (
    <View
      style={{ position: 'absolute', left: el.x, top: el.y }}
      {...panResponder.panHandlers}
    >
      {el.type === 'image' ? (
        <Image
          source={{ uri: el.uri! }}
          style={{ width: (el.width ?? 80) * el.scale, height: (el.height ?? 80) * el.scale }}
          resizeMode="contain"
        />
      ) : el.type === 'path' ? (
        // Draggable brush stroke
        <Svg
          width={(el.width ?? 40) * el.scale}
          height={(el.height ?? 40) * el.scale}
          viewBox={`0 0 ${el.width ?? 40} ${el.height ?? 40}`}
        >
          <Path
            d={el.pathD ?? ''}
            stroke={el.strokeColor ?? '#1a1a1a'}
            strokeWidth={el.strokeWidth ?? 8}
            strokeOpacity={el.strokeOpacity ?? 1}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
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

  const sorted     = [...trip.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const selectedEl = sorted.find((e) => e.id === selectedId) ?? null;
  const isText     = selectedEl?.type === 'text';
  const isImage    = selectedEl?.type === 'image';
  const isPath     = selectedEl?.type === 'path';

  const maxZ = Math.max(0, ...trip.elements.map((e) => e.zIndex ?? 0));
  const minZ = Math.min(0, ...trip.elements.map((e) => e.zIndex ?? 0));

  function bringFront(id: string) {
    updateElement(trip.id, id, { zIndex: maxZ + 1 });
  }
  function sendBack(id: string) {
    updateElement(trip.id, id, { zIndex: minZ - 1 });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sorted.map((el) => (
        <DraggableEl
          key={el.id}
          el={el}
          tripId={trip.id}
          allElements={trip.elements}
          isSelected={selectedId === el.id}
          onSelect={() => setSelectedId((p) => (p === el.id ? null : el.id))}
          onUpdate={(patch) => updateElement(trip.id, el.id, patch)}
          onRemove={() => { removeElement(trip.id, el.id); setSelectedId(null); }}
          bookScale={bookScale}
          onBringFront={() => bringFront(el.id)}
          onSendBack={() => sendBack(el.id)}
        />
      ))}

      {/* Image selected: scale + layer bar */}
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
          <View style={styles.barDivider} />
          <TouchableOpacity style={styles.layerBtn} onPress={() => bringFront(selectedId)}>
            <Text style={styles.layerBtnText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.layerBtn} onPress={() => sendBack(selectedId)}>
            <Text style={styles.layerBtnText}>↓</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Draggable brush selected: scale + layer bar */}
      {selectedId && isPath && selectedEl?.draggable && (
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
          <View style={styles.barDivider} />
          <TouchableOpacity style={styles.layerBtn} onPress={() => bringFront(selectedId)}>
            <Text style={styles.layerBtnText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.layerBtn} onPress={() => sendBack(selectedId)}>
            <Text style={styles.layerBtnText}>↓</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Text selected: size row + font row + layer */}
      {selectedId && isText && (
        <View style={styles.textControlBar}>
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
            <View style={styles.barDivider} />
            <TouchableOpacity style={styles.layerBtn} onPress={() => bringFront(selectedId)}>
              <Text style={styles.layerBtnText}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.layerBtn} onPress={() => sendBack(selectedId)}>
              <Text style={styles.layerBtnText}>↓</Text>
            </TouchableOpacity>
          </View>
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
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: 'rgba(26,26,26,0.82)',
    borderRadius: 8, padding: 5, zIndex: 30,
  },
  scaleBtn:     { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 },
  scaleBtnText: { fontFamily: 'DMSans-Regular', fontSize: 9, letterSpacing: 0.3, color: '#888' },

  barDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 2 },
  layerBtn:   { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 },
  layerBtnText: { color: '#ccc', fontSize: 13, lineHeight: 15 },

  textControlBar: {
    position: 'absolute', bottom: 8, left: 8, right: 8,
    backgroundColor: 'rgba(26,26,26,0.85)',
    borderRadius: 8, padding: 5, gap: 4, zIndex: 30,
  },
  sizeRow:    { flexDirection: 'row', gap: 4, alignItems: 'center' },
  sizeBtn:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  sizeBtnText:{ fontFamily: 'DMSans-Regular', fontSize: 9, color: '#888' },
  fontScroll: { flexGrow: 0 },
  fontBtn:    { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, marginRight: 2 },

  btnActive:     { backgroundColor: '#91040C' },
  btnTextActive: { color: '#fff' },
});
