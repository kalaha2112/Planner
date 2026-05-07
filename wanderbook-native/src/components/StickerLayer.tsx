import { useRef, useState } from 'react';
import {
  View, Image, Text, TextInput, PanResponder,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Trip, CardElement, useTripStore } from '../store/tripStore';

const SIZES = [10, 14, 20, 28];
const FONTS = [
  { key: 'PlayfairDisplay-Black',         short: 'PF●'   },
  { key: 'PlayfairDisplay-Bold',          short: 'PF Bd' },
  { key: 'PlayfairDisplay-BoldItalic',    short: 'PF It' },
  { key: 'PlayfairDisplay-Italic',        short: 'PF Li' },
  { key: 'BebasNeue',                     short: 'Bebas' },
  { key: 'DMSans-Regular',               short: 'DM'    },
  { key: 'DMSans-Medium',               short: 'DM Md' },
  { key: 'CormorantGaramond-LightItalic', short: 'CG'   },
];

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getW(el: CardElement): number {
  if (el.type === 'text') {
    return Math.max(60, ((el.text?.length ?? 5) * (el.fontSize ?? 14) * 0.55 + 12) * el.scale);
  }
  return (el.width ?? 80) * el.scale;
}

function getH(el: CardElement): number {
  if (el.type === 'text') return (el.fontSize ?? 14) * el.scale * 1.6 + 6;
  return (el.height ?? 80) * el.scale;
}

// ─── DraggableEl ─────────────────────────────────────────────────────────────

interface ElementProps {
  el: CardElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<CardElement>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  bookScale: number;
  onBringFront: () => void;
  onSendBack: () => void;
}

function DraggableEl({
  el, isSelected, onSelect, onUpdate, onRemove, onDuplicate,
  bookScale, onBringFront, onSendBack,
}: ElementProps) {
  // Stable refs — all PanResponders are created once, must read current values
  const R = useRef({ el, isSelected, onSelect, onUpdate, onRemove, onDuplicate, bookScale });
  R.current = { el, isSelected, onSelect, onUpdate, onRemove, onDuplicate, bookScale };

  const startPos   = useRef({ x: 0, y: 0 });
  const startScale = useRef(1);
  const startRot   = useRef(0);
  const moved      = useRef(false);

  const isStaticPath = el.type === 'path' && !el.draggable;

  // ── Main drag/tap PanResponder ──────────────────────────────────────────────
  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        // Let TextInput handle its own touches when a text element is selected
        !(R.current.isSelected && R.current.el.type === 'text'),
      onPanResponderGrant: () => {
        startPos.current = { x: R.current.el.x, y: R.current.el.y };
        moved.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) moved.current = true;
        const bs = R.current.bookScale;
        R.current.onUpdate({
          x: startPos.current.x + g.dx / bs,
          y: startPos.current.y + g.dy / bs,
        });
      },
      onPanResponderRelease: (_, g) => {
        if (!moved.current) {
          R.current.onSelect();
        } else {
          const bs = R.current.bookScale;
          R.current.onUpdate({
            x: startPos.current.x + g.dx / bs,
            y: startPos.current.y + g.dy / bs,
          });
        }
      },
    })
  ).current;

  // ── Resize handle (bottom-right corner) ────────────────────────────────────
  const resizePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => { startScale.current = R.current.el.scale; },
      onPanResponderMove: (_, g) => {
        const delta = (g.dx + g.dy) / (160 * R.current.bookScale);
        R.current.onUpdate({ scale: Math.max(0.2, Math.min(4, startScale.current + delta)) });
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // ── Rotate handle (top, floating above element) ─────────────────────────────
  const rotatePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => { startRot.current = R.current.el.rotation ?? 0; },
      onPanResponderMove: (_, g) => {
        R.current.onUpdate({ rotation: startRot.current + g.dx * 0.8 / R.current.bookScale });
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const w = getW(el);
  const h = getH(el);
  const rot = el.rotation ?? 0;

  // ── Static (pen/highlighter) path — tap to select, no drag ─────────────────
  if (isStaticPath) {
    const pw = (el.width  ?? 40) * el.scale;
    const ph = (el.height ?? 40) * el.scale;
    return (
      <View style={{ position: 'absolute', left: el.x, top: el.y }}>
        <TouchableOpacity onPress={onSelect} activeOpacity={1}>
          <Svg width={pw} height={ph} viewBox={`0 0 ${el.width ?? 40} ${el.height ?? 40}`}>
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
        </TouchableOpacity>
        {isSelected && (
          <>
            <View pointerEvents="none"
              style={[styles.bbox, { position: 'absolute', top: 0, left: 0, width: pw, height: ph }]}
            />
            <TouchableOpacity style={styles.deleteBadge} onPress={onRemove} hitSlop={6}>
              <Text style={styles.deleteBadgeText}>✕</Text>
            </TouchableOpacity>
            <View style={[styles.actionBar, { position: 'absolute', top: ph + 4, left: 0 }]}>
              <TouchableOpacity style={styles.actionBtn} onPress={onDuplicate}>
                <Text style={styles.actionBtnText}>⧉</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={onBringFront}>
                <Text style={styles.actionBtnText}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={onSendBack}>
                <Text style={styles.actionBtnText}>↓</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  // ── Draggable element (image, brush path, text) ─────────────────────────────
  return (
    <View
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: w,
        height: h,
        transform: [{ rotate: `${rot}deg` }],
      }}
      {...dragPan.panHandlers}
    >
      {/* ── Content ── */}
      {el.type === 'image' ? (
        <Image source={{ uri: el.uri! }} style={{ width: w, height: h }} resizeMode="contain" />
      ) : el.type === 'path' ? (
        <Svg width={w} height={h} viewBox={`0 0 ${el.width ?? 40} ${el.height ?? 40}`}>
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
            minWidth: 60, padding: 0,
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

      {/* ── Selection handles & toolkit ── */}
      {isSelected && (
        <>
          {/* Dashed bounding box */}
          <View
            pointerEvents="none"
            style={[styles.bbox, { position: 'absolute', top: 0, left: 0, width: w, height: h }]}
          />

          {/* Rotate handle — top center, above element */}
          <View
            style={[styles.rotateHandle, { position: 'absolute', top: -26, left: w / 2 - 8 }]}
            {...rotatePan.panHandlers}
          />

          {/* Resize handle — bottom-right corner */}
          <View
            style={[styles.resizeHandle, { position: 'absolute', bottom: -7, right: -7 }]}
            {...resizePan.panHandlers}
          />

          {/* Delete badge — top-right */}
          <TouchableOpacity style={styles.deleteBadge} onPress={onRemove} hitSlop={6}>
            <Text style={styles.deleteBadgeText}>✕</Text>
          </TouchableOpacity>

          {/* Action bar — below element */}
          <View style={[styles.actionBar, { position: 'absolute', top: h + 4, left: 0 }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={onDuplicate}>
              <Text style={styles.actionBtnText}>⧉</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onBringFront}>
              <Text style={styles.actionBtnText}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onSendBack}>
              <Text style={styles.actionBtnText}>↓</Text>
            </TouchableOpacity>
          </View>

          {/* Font controls — text elements only */}
          {el.type === 'text' && (
            <>
              <View style={[styles.textSizeBar, { position: 'absolute', top: h + 30, left: 0 }]}>
                {SIZES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.textBarBtn, el.fontSize === s && styles.textBarBtnActive]}
                    onPress={() => onUpdate({ fontSize: s })}
                  >
                    <Text style={[styles.textBarText, el.fontSize === s && styles.textBarTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.textFontBar, { position: 'absolute', top: h + 56, left: 0 }]}>
                {FONTS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.textBarBtn, el.fontFamily === f.key && styles.textBarBtnActive]}
                    onPress={() => onUpdate({ fontFamily: f.key })}
                  >
                    <Text style={[
                      { fontFamily: f.key, fontSize: 9, color: '#aaa' },
                      el.fontFamily === f.key && styles.textBarTextActive,
                    ]}>
                      {f.short}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

// ─── StickerLayer ─────────────────────────────────────────────────────────────

interface Props { trip: Trip; bookScale?: number; }

export default function StickerLayer({ trip, bookScale = 1 }: Props) {
  const { updateElement, removeElement, addElement } = useTripStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (trip.elements.length === 0) return null;

  const sorted = [...trip.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const maxZ   = Math.max(0, ...trip.elements.map((e) => e.zIndex ?? 0));
  const minZ   = Math.min(0, ...trip.elements.map((e) => e.zIndex ?? 0));

  function bringFront(id: string) { updateElement(trip.id, id, { zIndex: maxZ + 1 }); }
  function sendBack(id: string)   { updateElement(trip.id, id, { zIndex: minZ - 1 }); }

  function duplicate(el: CardElement) {
    addElement(trip.id, {
      ...el,
      id: makeId(),
      x: el.x + 10,
      y: el.y + 10,
      zIndex: maxZ + 1,
    });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sorted.map((el) => (
        <DraggableEl
          key={el.id}
          el={el}
          isSelected={selectedId === el.id}
          onSelect={() => setSelectedId((p) => (p === el.id ? null : el.id))}
          onUpdate={(patch) => updateElement(trip.id, el.id, patch)}
          onRemove={() => { removeElement(trip.id, el.id); setSelectedId(null); }}
          onDuplicate={() => duplicate(el)}
          bookScale={bookScale}
          onBringFront={() => bringFront(el.id)}
          onSendBack={() => sendBack(el.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bbox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#333',
    borderRadius: 2,
  },

  rotateHandle: {
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  resizeHandle: {
    width: 14, height: 14,
    borderRadius: 3,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  deleteBadge: {
    position: 'absolute', top: -9, right: -9,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
  },
  deleteBadgeText: { color: '#fff', fontSize: 7, fontFamily: 'DMSans-Regular' },

  actionBar: {
    flexDirection: 'row', gap: 2,
    backgroundColor: 'rgba(26,26,26,0.82)',
    borderRadius: 6, padding: 3,
    zIndex: 20,
  },
  actionBtn:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  actionBtnText: { color: '#ddd', fontSize: 11, fontFamily: 'DMSans-Regular' },

  textSizeBar: {
    flexDirection: 'row', gap: 2,
    backgroundColor: 'rgba(26,26,26,0.82)',
    borderRadius: 6, padding: 3,
    zIndex: 20,
  },
  textFontBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 2,
    backgroundColor: 'rgba(26,26,26,0.82)',
    borderRadius: 6, padding: 3,
    zIndex: 20,
  },
  textBarBtn:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  textBarBtnActive: { backgroundColor: '#1a1a1a' },
  textBarText:      { fontFamily: 'DMSans-Regular', fontSize: 9, color: '#888' },
  textBarTextActive: { color: '#fff' },
});
