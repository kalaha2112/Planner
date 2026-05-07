import { useState, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, StatusBar, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { Trip, CardElement, StickerTemplate, useTripStore } from '../store/tripStore';
import StickerLayer from './StickerLayer';
import DrawingLayer, { DrawBrush } from './DrawingLayer';
import StickerDrawer from './StickerDrawer';
import ParisCard    from './cards/ParisCard';
import KyotoCard    from './cards/KyotoCard';
import BaliCard     from './cards/BaliCard';
import MoroccoCard  from './cards/MoroccoCard';
import LisbonCard   from './cards/LisbonCard';

const CARDS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard];

type Tool = 'select' | 'draw' | 'text' | 'sticker' | 'trip';

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'select',  icon: '↖',  label: 'Select'  },
  { id: 'draw',    icon: '✎',  label: 'Draw'    },
  { id: 'text',    icon: 'T',   label: 'Text'    },
  { id: 'sticker', icon: '◈',  label: 'Sticker' },
  { id: 'trip',    icon: '✦',  label: 'Trip'    },
];

const PALETTE       = ['#1a1a1a', '#ffffff', '#91040C', '#2563eb', '#16a34a', '#d97706', '#ec4899', '#71717a'];
const HILITE_PALETTE = ['#fef08a', '#fca5a5', '#a5f3fc', '#86efac', '#fdba74', '#e9d5ff', '#fbcfe8', '#a3e635'];

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
}

// ─── Draw options panel ───────────────────────────────────────────────────────
function DrawPanel({
  brush, onBrush,
  penColor, onPenColor,
  brushColor, onBrushColor,
  hiliteColor, onHiliteColor,
}: {
  brush: DrawBrush; onBrush: (b: DrawBrush) => void;
  penColor: string;    onPenColor:    (c: string) => void;
  brushColor: string;  onBrushColor:  (c: string) => void;
  hiliteColor: string; onHiliteColor: (c: string) => void;
}) {
  const BRUSHES: { id: DrawBrush; label: string }[] = [
    { id: 'pen',         label: 'Pen'    },
    { id: 'brush',       label: 'Brush'  },
    { id: 'highlighter', label: 'Hi-lite'},
    { id: 'eraser',      label: 'Eraser' },
  ];

  const activeColor   = brush === 'pen' ? penColor : brush === 'brush' ? brushColor : hiliteColor;
  const onActiveColor = brush === 'pen' ? onPenColor : brush === 'brush' ? onBrushColor : onHiliteColor;
  const palette       = brush === 'highlighter' ? HILITE_PALETTE : PALETTE;

  return (
    <View style={styles.panel}>
      <View style={styles.panelRow}>
        {BRUSHES.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.toolPill, brush === b.id && styles.toolPillActive]}
            onPress={() => onBrush(b.id)}
          >
            <Text style={[styles.toolPillText, brush === b.id && styles.toolPillTextActive]}>
              {b.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {brush === 'eraser' ? (
        <View style={styles.eraserDisplay}>
          <View style={styles.eraserShape}>
            <View style={styles.eraserPink} />
            <View style={styles.eraserCream} />
            <View style={styles.eraserStripe} />
          </View>
          <Text style={styles.panelHint}>Swipe over any element to erase it.</Text>
        </View>
      ) : (
        <View style={styles.panelRow}>
          {palette.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c, borderColor: c === '#ffffff' ? '#e8e8e8' : c },
                activeColor === c && styles.colorDotActive,
              ]}
              onPress={() => onActiveColor(c)}
            />
          ))}
        </View>
      )}

      {brush === 'pen'         && <Text style={styles.panelHint}>Pen strokes are fixed. Switch to Brush for movable strokes.</Text>}
      {brush === 'brush'       && <Text style={styles.panelHint}>Brush strokes can be moved and scaled after drawing.</Text>}
      {brush === 'highlighter' && <Text style={styles.panelHint}>Highlighter is semi-transparent and fixed in place.</Text>}
    </View>
  );
}

// ─── Text placement panel ─────────────────────────────────────────────────────
function TextPanel({ onAddText }: { onAddText: () => void }) {
  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.bigAddBtn} onPress={onAddText} activeOpacity={0.8}>
        <Text style={styles.bigAddBtnText}>TAP CANVAS TO PLACE TEXT</Text>
      </TouchableOpacity>
      <Text style={styles.panelHint}>A text label will appear at the centre of the card. Drag it wherever you like.</Text>
    </View>
  );
}

// ─── Trip details panel ───────────────────────────────────────────────────────
function TripPanel({ trip }: { trip: Trip }) {
  const { updateTrip, addElement } = useTripStore();
  const [name,     setName]     = useState(trip.customName    ?? trip.name);
  const [days,     setDays]     = useState(trip.daysAway      ?? '');
  const [dateRange, setDateRange] = useState(trip.dateRange   ?? '');
  const [budget,   setBudget]   = useState(trip.budgetTotal != null ? String(trip.budgetTotal) : '');
  const [spent,    setSpent]    = useState(trip.budgetSpent   != null ? String(trip.budgetSpent) : '');
  const [hotel,    setHotel]    = useState(trip.hotelLocation ?? '');
  const [nights,   setNights]   = useState(trip.hotelNights   != null ? String(trip.hotelNights) : '');
  const [fFrom,    setFFrom]    = useState(trip.flightFrom    ?? '');
  const [fTo,      setFTo]      = useState(trip.flightTo      ?? '');
  const [fDate,    setFDate]    = useState(trip.flightDate    ?? '');
  const [fNum,     setFNum]     = useState(trip.flightNumber  ?? '');

  function save() {
    updateTrip(trip.id, {
      customName:    name.trim()    || undefined,
      daysAway:      days.trim()    || undefined,
      dateRange:     dateRange.trim() || undefined,
      budgetTotal:   budget ? Number(budget) : undefined,
      budgetSpent:   spent  ? Number(spent)  : undefined,
      hotelLocation: hotel.trim()   || undefined,
      hotelNights:   nights ? parseInt(nights, 10) : undefined,
      flightFrom:    fFrom.trim()   || undefined,
      flightTo:      fTo.trim()     || undefined,
      flightDate:    fDate.trim()   || undefined,
      flightNumber:  fNum.trim()    || undefined,
    });
  }

  function stamp(text: string) {
    if (!text.trim()) return;
    addElement(trip.id, {
      id: makeId(), type: 'text',
      x: 20, y: 170, scale: 1, rotation: 0,
      text: text.trim(),
      fontFamily: trip.titleFont,
      fontSize: 14,
      color: '#1a1a1a',
      zIndex: 100,
    });
  }

  return (
    <ScrollView style={styles.tripScroll} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.tripRow}>
        <View style={styles.tripField}>
          <Text style={styles.tripLabel}>TRIP NAME</Text>
          <TextInput
            style={styles.tripInput}
            value={name}
            onChangeText={setName}
            onBlur={save}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity style={styles.stampBtn} onPress={() => stamp(name)}>
          <Text style={styles.stampBtnText}>→ card</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tripRow}>
        <View style={styles.tripField}>
          <Text style={styles.tripLabel}>DAYS AWAY</Text>
          <TextInput
            style={styles.tripInput}
            value={days}
            onChangeText={setDays}
            onBlur={save}
            placeholder="e.g. 7 days away"
            placeholderTextColor="#ccc"
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity style={styles.stampBtn} onPress={() => stamp(days)}>
          <Text style={styles.stampBtnText}>→ card</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.tripLabel} >DATE RANGE</Text>
      <TextInput style={styles.tripInput} value={dateRange} onChangeText={setDateRange} onBlur={save}
        placeholder="May 15 – 22, 2026" placeholderTextColor="#ccc" returnKeyType="done" />

      <View style={styles.halfRow}>
        <View style={styles.halfField}>
          <Text style={styles.tripLabel}>BUDGET</Text>
          <TextInput style={styles.tripInput} value={budget} onChangeText={setBudget} onBlur={save}
            keyboardType="numeric" placeholder="5000" placeholderTextColor="#ccc" returnKeyType="done" />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.tripLabel}>SPENT</Text>
          <TextInput style={styles.tripInput} value={spent} onChangeText={setSpent} onBlur={save}
            keyboardType="numeric" placeholder="1200" placeholderTextColor="#ccc" returnKeyType="done" />
        </View>
      </View>

      <Text style={styles.tripLabel}>HOTEL</Text>
      <TextInput style={styles.tripInput} value={hotel} onChangeText={setHotel} onBlur={save}
        placeholder="Hotel name / location" placeholderTextColor="#ccc" returnKeyType="done" />

      <Text style={styles.tripLabel}>NIGHTS</Text>
      <TextInput style={styles.tripInput} value={nights} onChangeText={setNights} onBlur={save}
        keyboardType="numeric" placeholder="7" placeholderTextColor="#ccc" returnKeyType="done" />

      <Text style={styles.tripLabel}>FLIGHT</Text>
      <View style={styles.halfRow}>
        <TextInput style={[styles.tripInput, styles.halfField]} value={fFrom} onChangeText={setFFrom} onBlur={save}
          placeholder="From" placeholderTextColor="#ccc" returnKeyType="next" />
        <TextInput style={[styles.tripInput, styles.halfField]} value={fTo} onChangeText={setFTo} onBlur={save}
          placeholder="To" placeholderTextColor="#ccc" returnKeyType="next" />
      </View>
      <View style={styles.halfRow}>
        <TextInput style={[styles.tripInput, styles.halfField]} value={fDate} onChangeText={setFDate} onBlur={save}
          placeholder="Date" placeholderTextColor="#ccc" returnKeyType="next" />
        <TextInput style={[styles.tripInput, styles.halfField]} value={fNum} onChangeText={setFNum} onBlur={save}
          placeholder="Flight no." placeholderTextColor="#ccc" returnKeyType="done" />
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Root CardEditor ──────────────────────────────────────────────────────────
export default function CardEditor({ trip: tripProp, visible, onClose }: Props) {
  const { addElement, setElements } = useTripStore();
  const [tool, setTool]             = useState<Tool>('select');
  const [brush, setBrush]           = useState<DrawBrush>('pen');
  const [penColor,    setPenColor]    = useState('#1a1a1a');
  const [brushColor,  setBrushColor]  = useState('#1a1a1a');
  const [hiliteColor, setHiliteColor] = useState('#fef08a');
  const [history, setHistory]        = useState<CardElement[][]>([]);

  const activeColor = brush === 'pen' ? penColor
                    : brush === 'brush' ? brushColor
                    : hiliteColor;

  const { width: screenW } = useWindowDimensions();
  const canvasW     = Math.min(screenW - 32, 680);
  const canvasH     = Math.round(canvasW * 228 / 340);
  const canvasScale = canvasW / 340;
  const outerW      = canvasW + 4;
  const outerH      = canvasH + 4;

  if (!tripProp) return null;
  const trip = tripProp; // non-null alias so closures below see Trip, not Trip|null

  const Card = CARDS[trip.cardDesign];

  function pushHistory() {
    setHistory((h) => [...h.slice(-19), [...trip.elements]]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setElements(trip.id, prev);
  }

  function nextZIndex() {
    return Math.max(0, ...trip.elements.map((e) => e.zIndex ?? 0)) + 1;
  }

  function handlePlaceText() {
    pushHistory();
    addElement(trip.id, {
      id: makeId(), type: 'text',
      x: 100, y: 90, scale: 1, rotation: 0,
      text: 'Label',
      fontFamily: 'DMSans-Regular',
      fontSize: 14,
      color: '#1a1a1a',
      zIndex: nextZIndex(),
    });
    setTool('select');
  }

  function handlePlaceSticker(t: StickerTemplate) {
    pushHistory();
    addElement(trip.id, {
      id: makeId(), type: 'image',
      x: 80, y: 60, scale: 1, rotation: 0,
      uri: t.uri,
      width: 80, height: 80,
      zIndex: nextZIndex(),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="dark-content" />

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.topClose}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {trip.customName ?? trip.name}
          </Text>
          <TouchableOpacity onPress={undo} disabled={history.length === 0} hitSlop={12}>
            <Text style={[styles.topUndo, history.length === 0 && styles.topUndoDisabled]}>↩</Text>
          </TouchableOpacity>
        </View>

        {/* ── Card canvas ── */}
        <View style={{ width: outerW, height: outerH, alignSelf: 'center', marginTop: 12 }}>
          <View style={{
            position: 'absolute', width: 344, height: 232, top: 0, left: 0,
            transform: [
              { translateX: (outerW - 344) / 2 },
              { translateY: (outerH - 232) / 2 },
              { scale: outerW / 344 },
            ],
          }}>
            {/* Card background */}
            <Card
              customName={trip.customName}
              customCountry={trip.customCountry}
              titleFont={trip.titleFont}
            />
            {/* Element layer — interactive in select/sticker mode */}
            <View pointerEvents={tool === 'draw' ? 'none' : 'auto'}>
              <StickerLayer trip={trip} bookScale={canvasScale} />
            </View>
            {/* Drawing overlay — active only in draw mode */}
            {tool === 'draw' && (
              <DrawingLayer
                tripId={trip.id}
                elements={trip.elements}
                brush={brush}
                strokeColor={activeColor}
                onBeforeDraw={pushHistory}
                onNextZIndex={nextZIndex}
              />
            )}
            {/* Text placement tap overlay */}
            {tool === 'text' && (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={handlePlaceText}
                activeOpacity={1}
              />
            )}
          </View>
        </View>

        {/* ── Tool strip ── */}
        <View style={styles.toolStrip}>
          {TOOLS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.toolBtn, tool === t.id && styles.toolBtnActive]}
              onPress={() => setTool(t.id)}
            >
              <Text style={styles.toolIcon}>{t.icon}</Text>
              <Text style={[styles.toolLabel, tool === t.id && styles.toolLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Options panel ── */}
        <View style={styles.optionsPanel}>
          {tool === 'select' && (
            <View style={styles.panel}>
              <Text style={styles.panelHint}>
                Tap an element to select it. Drag to move. Use ↑↓ to change layer order. ✕ to delete.
              </Text>
            </View>
          )}
          {tool === 'draw' && (
            <DrawPanel
              brush={brush} onBrush={setBrush}
              penColor={penColor}       onPenColor={setPenColor}
              brushColor={brushColor}   onBrushColor={setBrushColor}
              hiliteColor={hiliteColor} onHiliteColor={setHiliteColor}
            />
          )}
          {tool === 'text' && (
            <TextPanel onAddText={handlePlaceText} />
          )}
          {tool === 'sticker' && (
            <StickerDrawer onPlace={handlePlaceSticker} />
          )}
          {tool === 'trip' && (
            <TripPanel trip={trip} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f5f2',
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 8,
    backgroundColor: '#f7f5f2',
  },
  topClose: { fontFamily: 'DMSans-Regular', fontSize: 18, color: '#1a1a1a', width: 32 },
  topTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 15, color: '#1a1a1a', letterSpacing: 0.3,
  },
  topUndo:         { fontFamily: 'DMSans-Regular', fontSize: 20, color: '#1a1a1a', width: 32, textAlign: 'right' },
  topUndoDisabled: { color: '#ccc' },

  // ── Tool strip ──
  toolStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ebe9e5',
    backgroundColor: '#f7f5f2',
  },
  toolBtn: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  toolBtnActive: { backgroundColor: 'rgba(145,4,12,0.08)' },
  toolIcon:  { fontSize: 18 },
  toolLabel: { fontFamily: 'DMSans-Regular', fontSize: 8, letterSpacing: 1.5, color: '#aaa', textTransform: 'uppercase' },
  toolLabelActive: { color: '#91040C' },

  // ── Options panel ──
  optionsPanel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },

  // ── Shared panel ──
  panel: { gap: 10 },
  panelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  panelHint: {
    fontFamily: 'DMSans-Regular', fontSize: 10, color: '#aaa',
    lineHeight: 16, letterSpacing: 0.2,
  },

  // Draw panel
  toolPill: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0',
  },
  toolPillActive:     { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  toolPillText:       { fontFamily: 'DMSans-Regular', fontSize: 11, color: '#666' },
  toolPillTextActive: { color: '#fff' },
  colorDot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2,
  },
  colorDotActive: { borderColor: '#91040C', transform: [{ scale: 1.2 }] },

  // Eraser display
  eraserDisplay: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eraserShape: {
    width: 44, height: 22,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bbb',
    transform: [{ rotate: '-15deg' }],
    flexDirection: 'row',
  },
  eraserPink:  { width: 18, backgroundColor: '#c8c8c8' },
  eraserCream: { flex: 1,   backgroundColor: '#f0f0f0' },
  eraserStripe: {
    position: 'absolute', left: 18, top: 0, bottom: 0,
    width: 1.5, backgroundColor: '#aaa',
  },

  // Text panel
  bigAddBtn: {
    paddingVertical: 14, borderRadius: 6,
    backgroundColor: '#1a1a1a', alignItems: 'center',
  },
  bigAddBtnText: {
    fontFamily: 'DMSans-Regular', fontSize: 9,
    letterSpacing: 2.5, color: '#fff', textTransform: 'uppercase',
  },

  // Trip panel
  tripScroll: { flex: 1 },
  tripRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  tripField:  { flex: 1 },
  tripLabel: {
    fontFamily: 'DMSans-Medium', fontSize: 8, letterSpacing: 2,
    color: '#bbb', marginBottom: 4, marginTop: 10, textTransform: 'uppercase',
  },
  tripInput: {
    fontFamily: 'DMSans-Regular', fontSize: 14, color: '#1a1a1a',
    borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
    paddingVertical: 4,
  },
  stampBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: 'rgba(145,4,12,0.08)',
    borderRadius: 4, marginBottom: 1,
  },
  stampBtnText: {
    fontFamily: 'DMSans-Regular', fontSize: 9,
    color: '#91040C', letterSpacing: 0.5,
  },
  halfRow:   { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
});
