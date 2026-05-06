import { useRef, useState } from 'react';
import {
  View, Image, Text, PanResponder,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { Trip, CardElement, useTripStore } from '../store/tripStore';

interface ElementProps {
  el: CardElement;
  tripId: string;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<CardElement>) => void;
  onRemove: () => void;
}

const SCALES = [0.5, 1.0, 1.5, 2.0];

function DraggableEl({ el, isSelected, onSelect, onUpdate, onRemove }: ElementProps) {
  const refs = useRef({ el, onSelect, onUpdate, onRemove });
  refs.current = { el, onSelect, onUpdate, onRemove };

  const startPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPos.current = { x: refs.current.el.x, y: refs.current.el.y };
        moved.current = false;
        longPressTimer.current = setTimeout(() => refs.current.onSelect(), 400);
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) {
          moved.current = true;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
        refs.current.onUpdate({
          x: startPos.current.x + g.dx,
          y: startPos.current.y + g.dy,
        });
      },
      onPanResponderRelease: (_, g) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        if (!moved.current) {
          refs.current.onSelect();
        } else {
          refs.current.onUpdate({
            x: startPos.current.x + g.dx,
            y: startPos.current.y + g.dy,
          });
        }
      },
    })
  ).current;

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
      ) : (
        <Text style={{
          fontFamily: el.fontFamily ?? 'DMSans-Regular',
          fontSize: (el.fontSize ?? 14) * el.scale,
          color: el.color ?? '#1a1a1a',
        }}>
          {el.text}
        </Text>
      )}

      {isSelected && (
        <View style={styles.badge}>
          <TouchableOpacity onPress={onRemove} hitSlop={6}>
            <Text style={styles.badgeText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

interface Props {
  trip: Trip;
}

export default function StickerLayer({ trip }: Props) {
  const { updateElement, removeElement } = useTripStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (trip.elements.length === 0) return null;

  const selectedEl = trip.elements.find((e) => e.id === selectedId) ?? null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {trip.elements.map((el) => (
        <DraggableEl
          key={el.id}
          el={el}
          tripId={trip.id}
          isSelected={selectedId === el.id}
          onSelect={() => setSelectedId((prev) => (prev === el.id ? null : el.id))}
          onUpdate={(patch) => updateElement(trip.id, el.id, patch)}
          onRemove={() => { removeElement(trip.id, el.id); setSelectedId(null); }}
        />
      ))}

      {/* Scale controls at bottom of card when element selected */}
      {selectedId && selectedEl && (
        <View style={styles.scaleBar}>
          {SCALES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.scaleBtn, selectedEl.scale === s && styles.scaleBtnActive]}
              onPress={() => updateElement(trip.id, selectedId, { scale: s })}
            >
              <Text style={[styles.scaleBtnText, selectedEl.scale === s && styles.scaleBtnTextActive]}>
                {s}×
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'DMSans-Regular',
  },
  scaleBar: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(26,26,26,0.82)',
    borderRadius: 8,
    padding: 5,
    zIndex: 30,
  },
  scaleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  scaleBtnActive: {
    backgroundColor: '#91040C',
  },
  scaleBtnText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 9,
    letterSpacing: 0.3,
    color: '#888',
  },
  scaleBtnTextActive: {
    color: '#fff',
  },
});
