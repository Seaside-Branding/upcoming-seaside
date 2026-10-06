// Pure data and maths for the intro: no DOM or three.js, so the beat map is easy to tune and test.
export const BPM = 116;
export const BEAT = 60 / BPM;
export const CLAP_BEAT = 16;
export const CUT_BEAT = 16.5;
export const FINAL_BEAT = 19.5;
export const END_BEAT = 20.5;

export const PALETTES = {
  black: { bg: 0x000000, front: 0xff8f7a, shadow: 0x894742 },
  coral: { bg: 0xff8f7a, front: 0x550000, shadow: 0x241e4e },
  violet: { bg: 0x241e4e, front: 0xffd700, shadow: 0xff8f7a },
  ice: { bg: 0xdcdeff, front: 0x550000, shadow: 0xff8f7a },
  gold: { bg: 0xffd700, front: 0x550000, shadow: 0xff8f7a },
  oxblood: { bg: 0x550000, front: 0xff8f7a, shadow: 0x2b0000 }
} as const;
export type PaletteName = keyof typeof PALETTES;

/** Background/letter colours crossfade into `name` over `fade` beats starting at `beat`. */
const PALETTE_STEPS: { beat: number; name: PaletteName; fade: number }[] = [
  { beat: 0, name: 'black', fade: 0 },
  { beat: 2.5, name: 'coral', fade: 0.8 },
  { beat: 4.5, name: 'violet', fade: 0.8 },
  { beat: 6.5, name: 'ice', fade: 0.8 },
  { beat: 8.5, name: 'black', fade: 0.8 },
  { beat: 10, name: 'gold', fade: 0.8 },
  { beat: 11.5, name: 'black', fade: 0.5 },
  { beat: 16.8, name: 'oxblood', fade: 2.4 }
];

const smooth = (t: number) => t * t * (3 - 2 * t);
export function paletteAt(beat: number): { from: PaletteName; to: PaletteName; mix: number } {
  let index = 0;
  PALETTE_STEPS.forEach((step, i) => { if (beat >= step.beat) index = i; });
  const step = PALETTE_STEPS[index];
  const previous = PALETTE_STEPS[Math.max(0, index - 1)];
  const mix = step.fade > 0 ? smooth(Math.min(1, Math.max(0, (beat - step.beat) / step.fade))) : 1;
  return { from: previous.name, to: step.name, mix };
}

/** x/y are world units; vy shifts the view by a fraction of the view height; roll/yaw/pitch are radians. */
export interface Pose { x: number; y: number; zoom: number; roll: number; yaw: number; pitch: number; vy: number }
interface Waypoint extends Pose { t: number }
export interface CameraPath { start: number; end: number; points: Waypoint[]; openStart: boolean; openEnd: boolean }

export type Row = 'zoom' | 'film' | 'clapper' | 'center';
export type Anchor = (row: Row, index: number, u: number, v: number) => { x: number; y: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const easings = {
  linear: (t: number) => t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  expo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
};
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const deg = (value: number) => (value * Math.PI) / 180;

/**
 * Hard cuts only happen at path boundaries (beat 12 to the clapperboard, beat 16.5 to the macro).
 * Inside a path the camera follows a C1-continuous spline, so velocity never jumps.
 */
export function buildPaths(anchor: Anchor): CameraPath[] {
  const wp = (
    t: number, row: Row, index: number, u: number, v: number, zoom: number, roll: number, extra: Partial<Pose> = {}
  ): Waypoint => ({ t, ...anchor(row, index, u, v), zoom, roll: deg(roll), yaw: 0, pitch: 0, vy: 0, ...extra });

  // Letter indexes: zoom = Z O O M I N (0-5), film = F I L M F E S T (0-7). u/v are 0-1 inside the letter box.
  const flight: CameraPath = {
    start: 0, end: 12, openStart: false, openEnd: true,
    points: [
      wp(0, 'zoom', 1, 0.12, 0.5, 16, -4),
      wp(1.6, 'zoom', 0, 0.45, 0.5, 9, 4),
      wp(3.2, 'zoom', 2, 0.5, 0.9, 14, 0),
      wp(4.8, 'zoom', 3, 0.35, 0.95, 11, -3),
      wp(6.4, 'zoom', 5, 0.3, 0.5, 12, -8),
      wp(8, 'zoom', 4, 0.5, 0.85, 7, 2),
      wp(9.5, 'film', 0, 0.1, 0.95, 9, -3),
      wp(10.8, 'film', 5, 0.8, 0.5, 8, 3),
      wp(12, 'film', 7, 0.5, 0.9, 6, 0)
    ]
  };

  const clapper: CameraPath = {
    start: 12, end: CUT_BEAT, openStart: true, openEnd: true,
    points: [
      wp(12, 'clapper', 0, 0.5, 0.5, 1.05, -2, { yaw: 0.35 }),
      wp(14.25, 'clapper', 0, 0.5, 0.5, 1.3, 2, { yaw: 0.12 }),
      wp(CUT_BEAT, 'clapper', 0, 0.5, 0.5, 1.7, 0, { yaw: -0.1 })
    ]
  };

  // Exponential snap zoom-out, sampled densely so the spline reproduces the curve.
  const zoomOut: Waypoint[] = [];
  for (let t = CUT_BEAT; t <= FINAL_BEAT + 1e-6; t += 0.1) {
    const e = easings.expo((t - CUT_BEAT) / (FINAL_BEAT - CUT_BEAT));
    zoomOut.push({
      t, ...anchor('center', 0, 0.5, 0.5),
      zoom: Math.exp(Math.log(34) * (1 - e)), roll: deg(-8) * (1 - e), yaw: 0.12 * e, pitch: -0.03 * e, vy: 0.14 * e
    });
  }
  zoomOut.push({ t: END_BEAT, ...anchor('center', 0, 0.5, 0.5), zoom: 1, roll: 0, yaw: 0, pitch: 0, vy: 0.14 });
  return [flight, clapper, { start: CUT_BEAT, end: END_BEAT, points: zoomOut, openStart: true, openEnd: false }];
}

const FIELDS = ['x', 'y', 'lz', 'roll', 'yaw', 'pitch', 'vy'] as const;
const value = (point: Waypoint, field: (typeof FIELDS)[number]) => (field === 'lz' ? Math.log(point.zoom) : point[field]);

export function samplePose(paths: CameraPath[], beat: number): Pose {
  const path = paths.find((candidate) => beat >= candidate.start && beat <= candidate.end) ?? paths[paths.length - 1];
  const pts = path.points;
  const last = pts.length - 1;
  const b = Math.min(path.end, Math.max(path.start, beat));
  let i = 0;
  while (i < last - 1 && b >= pts[i + 1].t) i += 1;
  const t0 = pts[i].t;
  const t1 = pts[i + 1].t;
  const h = t1 - t0;
  const s = clamp01((b - t0) / h);
  const s2 = s * s;
  const s3 = s2 * s;
  const result: Record<string, number> = {};
  for (const field of FIELDS) {
    const slope = (j: number) => {
      if (j === 0) return path.openStart ? (value(pts[1], field) - value(pts[0], field)) / (pts[1].t - pts[0].t) : 0;
      if (j === last) return path.openEnd ? (value(pts[last], field) - value(pts[last - 1], field)) / (pts[last].t - pts[last - 1].t) : 0;
      return (value(pts[j + 1], field) - value(pts[j - 1], field)) / (pts[j + 1].t - pts[j - 1].t);
    };
    const p0 = value(pts[i], field);
    const p1 = value(pts[i + 1], field);
    let m0 = slope(i);
    let m1 = slope(i + 1);
    if (m0 * (p1 - p0) < 0) m0 = 0;
    if (m1 * (p1 - p0) < 0) m1 = 0;
    result[field] = (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * h * m1;
  }
  return {
    x: result.x, y: result.y, zoom: Math.exp(result.lz), roll: result.roll, yaw: result.yaw, pitch: result.pitch, vy: result.vy
  };
}
