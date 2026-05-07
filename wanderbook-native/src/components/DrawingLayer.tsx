import { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CardElement, useTripStore } from '../store/tripStore';

export type DrawBrush = 'pen' | 'brush' | 'eraser';

interface Point { x: number; y: number; }

interface Props {
  tripId: string;
  elements: CardElement[];
  brush: DrawBrush;
  strokeColor: string;
  brushWidth: number;
  onBeforeDraw: () => void;
  onNextZIndex: () => number;
}

function buildSmoothPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function normalizePath(pts: Point[], sw: number) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - sw;
  const minY = Math.min(...ys) - sw;
  const maxX = Math.max(...xs) + sw;
  const maxY = Math.max(...ys) + sw;
  const w = Math.max(maxX - minX, 2);
  const h = Math.max(maxY - minY, 2);
  const norm = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  return { pathD: buildSmoothPath(norm), x: minX, y: minY, w, h };
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// pen is draggable too — both pen and brush produce movable strokes
const BRUSH_PARAMS: Record<DrawBrush, { width: number; opacity: number; draggable: boolean }> = {
  pen:    { width: 2,  opacity: 1.0, draggable: true },
  brush:  { width: 10, opacity: 1.0, draggable: true },
  eraser: { width: 0,  opacity: 0,   draggable: false },
};

export default function DrawingLayer({
  tripId, elements, brush, strokeColor, brushWidth, onBeforeDraw, onNextZIndex,
}: Props) {
  const { addElement } = useTripStore();
  const [livePathD,  setLivePathD]  = useState('');
  const [eraserPos,  setEraserPos]  = useState<{ x: number; y: number } | null>(null);

  const points = useRef<Point[]>([]);
  const hasPushedHistory = useRef(false);

  const R = useRef({ brush, strokeColor, brushWidth, onBeforeDraw, onNextZIndex, elements });
  R.current = { brush, strokeColor, brushWidth, onBeforeDraw, onNextZIndex, elements };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const { brush: b, elements: els, onBeforeDraw: before } = R.current;
        hasPushedHistory.current = false;

        if (b === 'eraser') {
          setEraserPos({ x, y });
          const { removeElement } = useTripStore.getState();
          els.forEach((el) => {
            const elW = (el.width  ?? (el.type === 'text' ? 80 : 40)) * el.scale;
            const elH = (el.height ?? (el.type === 'text' ? 20 : 40)) * el.scale;
            if (x >= el.x && x <= el.x + elW && y >= el.y && y <= el.y + elH) {
              if (!hasPushedHistory.current) { before(); hasPushedHistory.current = true; }
              removeElement(tripId, el.id);
            }
          });
          return;
        }

        before();
        hasPushedHistory.current = true;
        points.current = [{ x, y }];
        setLivePathD(`M ${x} ${y}`);
      },

      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const { brush: b, elements: els, onBeforeDraw: before } = R.current;

        if (b === 'eraser') {
          setEraserPos({ x, y });
          const { removeElement } = useTripStore.getState();
          els.forEach((el) => {
            const elW = (el.width  ?? (el.type === 'text' ? 80 : 40)) * el.scale;
            const elH = (el.height ?? (el.type === 'text' ? 20 : 40)) * el.scale;
            if (x >= el.x && x <= el.x + elW && y >= el.y && y <= el.y + elH) {
              if (!hasPushedHistory.current) { before(); hasPushedHistory.current = true; }
              removeElement(tripId, el.id);
            }
          });
          return;
        }

        points.current.push({ x, y });
        setLivePathD(buildSmoothPath(points.current));
      },

      onPanResponderRelease: () => {
        setEraserPos(null);
        const { brush: b, strokeColor: color, brushWidth: bw, onNextZIndex: nextZ } = R.current;

        if (b === 'eraser' || points.current.length < 2) {
          setLivePathD('');
          points.current = [];
          return;
        }

        const params = BRUSH_PARAMS[b];
        // brush uses user-selected width; pen uses fixed 2px
        const effectiveWidth = b === 'brush' ? bw : params.width;
        const { pathD, x, y, w, h } = normalizePath(points.current, effectiveWidth);

        addElement(tripId, {
          id:            makeId(),
          type:          'path',
          x, y, scale: 1, rotation: 0,
          zIndex:        nextZ(),
          pathD,
          strokeColor:   color,
          strokeWidth:   effectiveWidth,
          strokeOpacity: params.opacity,
          draggable:     params.draggable,
          width: w, height: h,
        });

        setLivePathD('');
        points.current = [];
      },
    })
  ).current;

  const params        = BRUSH_PARAMS[brush];
  const liveWidth     = brush === 'brush' ? brushWidth : params.width;

  return (
    <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
      {/* Live stroke being drawn */}
      {livePathD ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Path
            d={livePathD}
            stroke={strokeColor}
            strokeWidth={liveWidth}
            strokeOpacity={params.opacity}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}

      {/* Eraser cursor — follows the touch position while erasing */}
      {brush === 'eraser' && eraserPos && (
        <View
          pointerEvents="none"
          style={[
            styles.eraserCursor,
            { left: eraserPos.x - 10, top: eraserPos.y - 6 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eraserCursor: {
    position: 'absolute',
    width: 20, height: 12,
    borderRadius: 2,
    backgroundColor: '#d0d0d0',
    borderWidth: 1,
    borderColor: '#999',
    transform: [{ rotate: '-10deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
