import type * as B from "@babylonjs/core";

export type View = "whole" | "known" | "top" | "logo" | "yard" | "abyss" | "cutaway";
export type LandmarkId = "logo" | "abyss" | "cutaway" | "wreckage" | "portals";
export type IronObject =
  & (
    | { kind: "overview"; view: View }
    | { kind: "route" | "train" | "node"; id: string }
    | { kind: "station"; route: string; n: number }
    | { kind: "stop"; route: string; t: number; label: string }
    | { kind: "yard"; id: number; face: number }
    | { kind: "mimic"; id: number }
    | { kind: "landmark"; id: LandmarkId }
  )
  & {
    id?: string | number;
    route?: string;
    n?: number;
    t?: number;
    face?: number;
    view?: View;
    label?: string;
  };
export type Group = "stations" | "trains" | "lines" | "yards" | "bosses" | "landmarks";
export interface CatalogEntry {
  key: string;
  object: IronObject;
  group: Group;
  title: string;
  meta: string;
  search: string;
  rank: number;
}
export interface StationNode {
  n: number;
  p: B.Vector3;
  label: string;
  lines: string[];
  priority: number;
  ring: number;
}
export interface Anchor {
  n: number | null;
  t: number;
  ring: number;
  p: B.Vector3;
}
export interface Route {
  id: string;
  name: string;
  i: number;
  point: (t: number) => B.Vector3;
  namedNodes: StationNode[];
  path: B.Vector3[];
  anchors: Anchor[];
  samples: { t: number; p: B.Vector3 }[];
  arcs: { ring: number; start: number; sweep: number; direction: number; t0: number; t1: number }[];
  material: B.StandardMaterial;
  loop: boolean;
  reverse: boolean;
  count: number;
  spacing: number;
  prototype: B.Mesh;
  stops: [string, number][];
  parent: B.TransformNode;
  length: number;
  distancePoint: (distance: number) => B.Vector3;
  face?: number;
  counterpart?: B.Mesh;
  mesh?: B.Mesh;
  hidden?: B.Mesh;
  opposing?: B.Mesh;
  lowPlatform?: B.Mesh;
}
export interface Train {
  r: Route;
  cars: B.InstancedMesh[];
  base: number;
  speed: number;
}
export interface Yard {
  id: number;
  sign: number;
  base: B.Vector3;
  parent: B.TransformNode;
  yard: B.TransformNode;
  merged: B.Mesh;
}
export interface SceneLabel {
  text: string;
  point: B.Vector3;
  parent: B.TransformNode;
  priority: number;
  kind?: string;
  node?: string;
  route?: string;
  t?: number;
}
export interface ScreenTarget {
  x: number;
  y: number;
  object: IronObject;
}
export interface LabelTarget extends ScreenTarget {
  w: number;
  h: number;
}
export interface CameraTween {
  from: B.Vector3;
  to: B.Vector3;
  r0: number;
  r1: number;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  start: number;
}
export interface ObjectLocation {
  point: B.Vector3;
  parent: B.TransformNode;
  radius: number;
  scale: number;
  alpha?: number;
  beta?: number;
}
export interface PickMetadata {
  node?: string;
  yard?: number;
  face?: number | string;
  mimic?: number;
  landmark?: LandmarkId;
  abyss?: boolean;
  route?: string;
  number?: number;
  stop?: boolean;
  t?: number;
  train?: boolean;
  counterpart?: boolean;
  bulk?: boolean;
  routeRanges?: number[];
  trianglesPerRoute?: number;
  verticesPerRoute?: number;
}
export interface BulkMetadata extends PickMetadata {
  bulk: true;
  face: "upper" | "lower";
  routeRanges: number[];
  trianglesPerRoute: number;
  verticesPerRoute: number;
}
