/**
 * Data-only scene authoring knobs.
 *
 * Keep identities, placement parameters, and motion parameters here. Babylon
 * mesh construction stays in model.ts; changing the modeled content should not
 * require editing the render loop or storage/navigation validation separately.
 */
import { HOMEWARD_BOUND_PLATFORM_COUNT } from "./canon.ts";
import type { IronObject, LandmarkId } from "./types.ts";

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

export type PaletteKey =
  | "background"
  | "foreground"
  | "muted-foreground"
  | "border"
  | "blue"
  | "orange"
  | "green"
  | "red"
  | "purple"
  | "yellow";

export interface LineSpec {
  id: string;
  name: string;
  /** Stable layout slot; independent of display order and identity. */
  axisIndex: number;
  color: [PaletteKey, PaletteKey?, number?];
}

export const LINE_SPECS: LineSpec[] = [
  { id: "line:red", name: "Red", axisIndex: 0, color: ["red"] },
  { id: "line:orange", name: "Orange", axisIndex: 1, color: ["orange"] },
  { id: "line:yellow", name: "Yellow", axisIndex: 2, color: ["yellow"] },
  { id: "line:indigo", name: "Indigo", axisIndex: 3, color: ["blue", "purple", .55] },
  { id: "line:azure", name: "Azure", axisIndex: 4, color: ["blue"] },
  { id: "line:purple", name: "Purple", axisIndex: 5, color: ["purple"] },
  { id: "line:brown", name: "Brown", axisIndex: 6, color: ["orange", "muted-foreground", .6] },
  { id: "line:mauve", name: "Mauve", axisIndex: 7, color: ["purple", "red", .28] },
  { id: "line:green", name: "Green", axisIndex: 8, color: ["green"] },
  { id: "line:tangerine", name: "Tangerine", axisIndex: 9, color: ["orange", "yellow", .25] },
  { id: "line:plum", name: "Plum", axisIndex: 10, color: ["purple", "red", .42] },
  { id: "line:winter-sky", name: "Winter Sky", axisIndex: 11, color: ["blue", "background", .38] },
  { id: "line:ochre", name: "Ochre", axisIndex: 12, color: ["yellow", "orange", .55] },
  { id: "line:fulvous", name: "Fulvous", axisIndex: 13, color: ["orange", "yellow", .45] },
  { id: "line:camel", name: "Camel", axisIndex: 14, color: ["orange", "muted-foreground", .4] },
  { id: "line:cobalt", name: "Cobalt", axisIndex: 15, color: ["blue", "purple", .2] },
  { id: "line:puce", name: "Puce", axisIndex: 16, color: ["red", "purple", .45] },
  { id: "line:vermillion", name: "Vermillion", axisIndex: 17, color: ["red", "orange", .4] },
  { id: "line:mango", name: "Mango", axisIndex: 18, color: ["orange", "yellow", .65] },
  { id: "line:sinopia", name: "Sinopia", axisIndex: 19, color: ["red", "orange", .7] },
  { id: "line:mindaro", name: "Mindaro", axisIndex: 20, color: ["yellow", "green", .22] },
  { id: "line:grullo", name: "Grullo", axisIndex: 21, color: ["muted-foreground", "orange", .2] },
  { id: "line:zomp", name: "Zomp", axisIndex: 22, color: ["green", "blue", .35] },
];

/** Frozen meaning of the original positional IDs. Never renumber these aliases. */
export const LEGACY_LINE_IDS: Readonly<Record<string, string>> = Object.freeze({
  "color-0": "line:red",
  "color-1": "line:orange",
  "color-2": "line:yellow",
  "color-3": "line:indigo",
  "color-4": "line:azure",
  "color-5": "line:purple",
  "color-6": "line:brown",
  "color-7": "line:mauve",
  "color-8": "line:green",
  "color-9": "line:tangerine",
  "color-10": "line:plum",
  "color-11": "line:winter-sky",
  "color-12": "line:ochre",
  "color-13": "line:fulvous",
  "color-14": "line:camel",
  "color-15": "line:cobalt",
  "color-16": "line:puce",
  "color-17": "line:vermillion",
  "color-18": "line:mango",
  "color-19": "line:sinopia",
  "color-20": "line:mindaro",
  "color-21": "line:grullo",
  "color-22": "line:zomp",
});

export interface StationSpec {
  n: number;
  label: string;
  lines: string[];
  ring: number;
  priority: number;
  placement: { kind: "nightmare"; t: number } | { kind: "ring"; ring: number; angle: number };
}

export const STATION_SPECS: Record<string, StationSpec> = {
  red83: {
    n: 83,
    placement: { kind: "nightmare", t: 0 },
    label: "83 · Red / Yellow",
    lines: ["line:red", "line:yellow"],
    ring: 0,
    priority: 1,
  },
  purple283: {
    n: 283,
    placement: { kind: "nightmare", t: .125 },
    label: "283 · Purple / Mauve",
    lines: ["line:purple", "line:mauve"],
    ring: 0,
    priority: 2,
  },
  abyss436: {
    n: 436,
    placement: { kind: "nightmare", t: .25 },
    label: "436 · Abyss station",
    lines: [],
    ring: 0,
    priority: 0,
  },
  green283: {
    n: 283,
    placement: { kind: "nightmare", t: .375 },
    label: "283 · Green / Yellow",
    lines: ["line:green", "line:yellow"],
    ring: 1,
    priority: 2,
  },
  plum83: {
    n: 83,
    placement: { kind: "nightmare", t: .5 },
    label: "83 · Tangerine / Plum",
    lines: ["line:tangerine", "line:plum"],
    ring: 1,
    priority: 1,
  },
  orange83: {
    n: 83,
    placement: { kind: "ring", ring: 0, angle: -2.7 },
    label: "83 · Orange / Indigo",
    lines: ["line:orange", "line:indigo"],
    ring: 0,
    priority: 4,
  },
  yellow89: {
    n: 89,
    placement: { kind: "ring", ring: 0, angle: -2.4 },
    label: "89 · Yellow / Indigo",
    lines: ["line:yellow", "line:indigo"],
    ring: 0,
    priority: 5,
  },
  tangerine89: {
    n: 89,
    placement: { kind: "ring", ring: 1, angle: .35 },
    label: "89 · Tangerine / Escape Velocity",
    lines: ["line:tangerine"],
    ring: 1,
    priority: 5,
  },
  mauve281: {
    n: 281,
    placement: { kind: "ring", ring: 2, angle: Math.PI },
    label: "281 · Mauve / Dismemberment",
    lines: ["line:mauve"],
    ring: 2,
    priority: 4,
  },
  ochre149: {
    n: 149,
    placement: { kind: "ring", ring: 2, angle: 0 },
    label: "149 · Ochre / Dismemberment",
    lines: ["line:ochre"],
    ring: 2,
    priority: 4,
  },
  azure199: {
    n: 199,
    placement: { kind: "ring", ring: 3, angle: Math.PI * .6 },
    label: "199 · Azure / Brown",
    lines: ["line:azure", "line:brown"],
    ring: 3,
    priority: 5,
  },
  vermillion101: {
    n: 101,
    placement: { kind: "ring", ring: 1, angle: .62 },
    label: "101 · Vermillion",
    lines: ["line:vermillion"],
    ring: 1,
    priority: 6,
  },
  cobalt271: {
    n: 271,
    placement: { kind: "ring", ring: 3, angle: 0 },
    label: "271 · Camel / Cobalt / Eviscerator",
    lines: ["line:camel", "line:cobalt"],
    ring: 3,
    priority: 4,
  },
  security75: {
    n: 75,
    placement: { kind: "ring", ring: 1, angle: .18 },
    label: "75 · Security / repair hub",
    lines: ["line:vermillion"],
    ring: 1,
    priority: 5,
  },
  employee60: {
    n: 60,
    placement: { kind: "ring", ring: 3, angle: -Math.PI / 3 },
    label: "60 · Employee hub",
    lines: [],
    ring: 3,
    priority: 5,
  },
};

export interface ServiceStopSpec {
  label: string;
  t: number;
  target: IronObject;
  platform?: boolean;
  catalog?: { meta: string; aliases: string; rank: number };
}

export interface ServiceSpec {
  id: string;
  name: string;
  color: PaletteKey;
  labelT: number;
  showStopLabels?: boolean;
  prototype: "nightmare" | "white" | "subway";
  loop: boolean;
  reverse?: boolean;
  count: number;
  spacing: number;
  path:
    | { kind: "nightmare" }
    | { kind: "ring"; ring: number }
    | {
      kind: "access";
      line: string;
      station: number;
      ring: number;
      endAngle: number;
      lift: number;
    }
    | { kind: "homeward"; ring: number; startAngle: number; endAngle: number; lift: number };
  stops: ServiceStopSpec[];
}

export const SERVICE_SPECS: ServiceSpec[] = [
  {
    id: "nightmare",
    labelT: .86,
    name: "Nightmare Express",
    color: "purple",
    prototype: "nightmare",
    loop: true,
    count: 40,
    spacing: 2,
    path: { kind: "nightmare" },
    stops: [
      { label: "83 · Red / Yellow", t: 0, target: { kind: "node", id: "red83" } },
      { label: "283 · Purple / Mauve", t: .125, target: { kind: "node", id: "purple283" } },
      { label: "436 · Abyss", t: .25, target: { kind: "node", id: "abyss436" } },
      { label: "283 · Green / Yellow", t: .375, target: { kind: "node", id: "green283" } },
      { label: "83 · Tangerine / Plum", t: .5, target: { kind: "node", id: "plum83" } },
    ],
  },
  {
    id: "dismemberment",
    labelT: .75,
    name: "Dismemberment Limited",
    color: "foreground",
    prototype: "white",
    loop: true,
    count: 2,
    spacing: 3,
    path: { kind: "ring", ring: 2 },
    stops: [
      { label: "149 · Ochre", t: 0, target: { kind: "node", id: "ochre149" } },
      { label: "281 · Mauve", t: .5, target: { kind: "node", id: "mauve281" } },
    ],
  },
  {
    id: "eviscerator",
    labelT: .25,
    name: "Eviscerator",
    color: "red",
    prototype: "nightmare",
    loop: true,
    count: 12,
    spacing: 1.9,
    path: { kind: "ring", ring: 3 },
    stops: [{ label: "271 · Cobalt", t: 0, target: { kind: "node", id: "cobalt271" } }],
  },
  {
    id: "escape",
    labelT: .6,
    showStopLabels: true,
    name: "Escape Velocity",
    color: "green",
    prototype: "subway",
    loop: false,
    reverse: true,
    count: 12,
    spacing: 1.9,
    path: { kind: "access", line: "line:tangerine", station: 24, ring: 1, endAngle: .35, lift: 8 },
    stops: [
      { label: "89 · Tangerine", t: 1, target: { kind: "node", id: "tangerine89" } },
      {
        label: "24 · Escape Velocity III / stairwell hub",
        t: 0,
        target: {
          kind: "stop",
          route: "escape",
          t: 0,
          label: "24 · Escape Velocity III / stairwell hub",
        },
        platform: true,
        catalog: {
          meta: "5 stairwells · 10 platform exits · documented hub; service geometry inferred",
          aliases: "escape velocity escape velocity iii stairwell stairs station 24",
          rank: 35,
        },
      },
    ],
  },
  {
    id: "homeward",
    labelT: .28,
    showStopLabels: true,
    name: "Homeward Bound",
    color: "orange",
    prototype: "subway",
    loop: false,
    count: 10,
    spacing: 1.9,
    path: { kind: "homeward", ring: 3, startAngle: Math.PI / 2, endAngle: -Math.PI / 3, lift: 6 },
    stops: [
      { label: "Trainyard E", t: 0, target: { kind: "yard", id: 3, face: 1 } },
      {
        label: "24 · staff access",
        t: .4,
        target: { kind: "stop", route: "homeward", t: .4, label: "24 · staff access" },
        platform: true,
        catalog: {
          meta: "Homeward Bound · representative staff access toward station 60",
          aliases: "homeward bound stairs staff 24",
          rank: 36,
        },
      },
      {
        label: `60 · ${HOMEWARD_BOUND_PLATFORM_COUNT} Homeward Bound platforms`,
        t: 1,
        target: { kind: "node", id: "employee60" },
      },
    ],
  },
];

export interface LandmarkSpec {
  id: LandmarkId;
  title: string;
  meta: string;
  aliases: string;
  rank: number;
  connections: IronObject[];
}

export const LANDMARK_SPECS: LandmarkSpec[] = [
  {
    id: "logo",
    title: "Syndicate logo view",
    meta: "Named circuits · interpreted unequal rings",
    aliases: "syndicate logo symbol emblem wormhole galaxy rings overhead",
    rank: -2,
    connections: [{ kind: "landmark", id: "abyss" }],
  },
  {
    id: "abyss",
    title: "The Abyss",
    meta: "Abyss cutaway",
    aliases: "436 central abyss engine cars galaxy center",
    rank: 0,
    connections: [{ kind: "node", id: "abyss436" }, { kind: "landmark", id: "portals" }, {
      kind: "landmark",
      id: "wreckage",
    }],
  },
  {
    id: "cutaway",
    title: "Paired tunnel cutaway",
    meta: "Opposing gravity and hidden conveyor",
    aliases: "tunnel passage cross section",
    rank: 4,
    connections: [],
  },
  {
    id: "wreckage",
    title: "Discarded carriages",
    meta: "Reconstructed wreckage below the Abyss",
    aliases: "cars carriages scrap abyss",
    rank: 15,
    connections: [{ kind: "landmark", id: "abyss" }],
  },
  {
    id: "portals",
    title: "Engine-return portals",
    meta: "Reconstructed portal placement",
    aliases: "engine locomotive return abyss",
    rank: 16,
    connections: [{ kind: "landmark", id: "abyss" }],
  },
];
