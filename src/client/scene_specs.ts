/**
 * Data-only scene authoring knobs.
 *
 * Keep identities, placement parameters, and motion parameters here. Babylon
 * mesh construction stays in model.ts; changing the modeled content should not
 * require editing the render loop or storage/navigation validation separately.
 */

export interface LogoRingSpec {
  name: string;
  x: number;
  z: number;
  radius: number;
  y: number;
  lift: number;
  phase: number;
}

export const LOGO_RINGS: LogoRingSpec[] = [
  { name: "Nightmare · western lobe", x: -62, z: 0, radius: 62, y: 18, lift: 13, phase: .3 },
  { name: "Nightmare · eastern lobe", x: 78, z: 0, radius: 78, y: 15, lift: 17, phase: 1.8 },
  { name: "Dismemberment circuit", x: -30, z: -38, radius: 64, y: 5, lift: 19, phase: .7 },
  { name: "Eviscerator circuit", x: 36, z: 37, radius: 50, y: 12, lift: 15, phase: 2.4 },
];

export interface YardSpec {
  id: number;
  label: string;
  named: boolean;
  ring: number;
  angle: number;
  direction: 1 | -1;
}

export const YARD_SPECS: YardSpec[] = [
  { id: 0, label: "B", named: true, ring: 0, angle: Math.PI, direction: 1 },
  { id: 1, label: "C", named: true, ring: 1, angle: -Math.PI / 2, direction: 1 },
  { id: 2, label: "D", named: true, ring: 2, angle: -Math.PI / 2, direction: -1 },
  { id: 3, label: "E", named: true, ring: 3, angle: Math.PI / 2, direction: -1 },
  { id: 4, label: "F", named: true, ring: 0, angle: Math.PI / 2, direction: -1 },
  { id: 5, label: "H", named: true, ring: 1, angle: 0, direction: 1 },
  { id: 6, label: "M", named: true, ring: 2, angle: Math.PI, direction: 1 },
  { id: 7, label: "Q", named: true, ring: 3, angle: 0, direction: -1 },
  { id: 8, label: "?1", named: false, ring: 0, angle: -Math.PI / 2, direction: 1 },
  { id: 9, label: "?2", named: false, ring: 1, angle: Math.PI / 2, direction: -1 },
  { id: 10, label: "?3", named: false, ring: 2, angle: 0, direction: 1 },
  { id: 11, label: "?4", named: false, ring: 3, angle: Math.PI, direction: -1 },
];

export interface MimicSpec {
  id: number;
  station: number;
  axisIndex: number;
  face: 1 | -1;
}

export const MIMIC_SPECS: MimicSpec[] = [
  { id: 1, station: 433, axisIndex: 320, face: -1 },
  { id: 2, station: 433, axisIndex: 790, face: 1 },
  { id: 3, station: 433, axisIndex: 1260, face: -1 },
  { id: 4, station: 433, axisIndex: 1730, face: 1 },
  { id: 5, station: 433, axisIndex: 2200, face: -1 },
  { id: 6, station: 433, axisIndex: 2670, face: 1 },
];

export const CUTAWAY_MOTION = {
  cars: {
    startXs: [-7, -4.95, -2.9, -.85, 1.2],
    speed: 2.5,
    span: 32,
  },
  cargo: {
    startX: -3,
    speed: 1.7,
    span: 27,
  },
};

export interface TrainMotionSpec {
  speed: number;
  startFraction: number;
}

const DEFAULT_TRAIN_MOTION: TrainMotionSpec = { speed: 4, startFraction: .7 };
const TRAIN_MOTION_OVERRIDES: Record<string, Partial<TrainMotionSpec>> = {
  nightmare: { startFraction: .16 },
};

export function trainMotion(id: string): TrainMotionSpec {
  return { ...DEFAULT_TRAIN_MOTION, ...TRAIN_MOTION_OVERRIDES[id] };
}
