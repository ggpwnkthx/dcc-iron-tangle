import type { IronObject, LandmarkId } from "./types.ts";
import { MIMIC_SPECS, YARD_SPECS } from "./scene_specs.ts";

export interface ObjectRegistry {
  routes: ReadonlySet<string>;
  services: ReadonlySet<string>;
  nodes: ReadonlySet<string>;
}

/** Return the route/service identity carried by route-like objects. */
export function objectRouteId(o: IronObject): string | null {
  switch (o.kind) {
    case "route":
    case "train":
      return o.id;
    case "station":
    case "stop":
      return o.route;
    default:
      return null;
  }
}

const landmarks = new Set<LandmarkId>(["logo", "abyss", "cutaway", "wreckage", "portals"]);
const yardIds = new Set(YARD_SPECS.map((spec) => spec.id));
const mimicIds = new Set(MIMIC_SPECS.map((spec) => spec.id));

/** Validate persisted JSON and construct a clean object with only the relevant fields. */
export function parseObject(value: unknown, registry: ObjectRegistry): IronObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const isRoute = (id: unknown): id is string => {
    if (typeof id !== "string") return false;
    const unmapped = /^unmapped-(\d+)-(-?1)$/.exec(id);
    return registry.routes.has(id) || registry.services.has(id) ||
      Boolean(unmapped && Number(unmapped[1]) < 3123);
  };
  switch (o.kind) {
    case "route":
      return isRoute(o.id) ? { kind: "route", id: o.id } : null;
    case "train":
      return typeof o.id === "string" && registry.services.has(o.id)
        ? { kind: "train", id: o.id }
        : null;
    case "node":
      return typeof o.id === "string" && registry.nodes.has(o.id)
        ? { kind: "node", id: o.id }
        : null;
    case "station":
      return isRoute(o.route) && !registry.services.has(o.route) && typeof o.n === "number" &&
          Number.isInteger(o.n) && o.n >= 10 && o.n <= 436
        ? { kind: "station", route: o.route, n: o.n }
        : null;
    case "stop":
      return typeof o.route === "string" && registry.services.has(o.route) &&
          typeof o.t === "number" && Number.isFinite(o.t) && o.t >= 0 && o.t <= 1 &&
          typeof o.label === "string"
        ? { kind: "stop", route: o.route, t: o.t, label: o.label }
        : null;
    case "yard":
      return typeof o.id === "number" && Number.isInteger(o.id) && yardIds.has(o.id) &&
          (o.face === 1 || o.face === -1)
        ? { kind: "yard", id: o.id, face: o.face }
        : null;
    case "mimic":
      return typeof o.id === "number" && Number.isInteger(o.id) && mimicIds.has(o.id)
        ? { kind: "mimic", id: o.id }
        : null;
    case "landmark":
      return typeof o.id === "string" && landmarks.has(o.id as LandmarkId)
        ? { kind: "landmark", id: o.id as LandmarkId }
        : null;
    default:
      return null;
  }
}

/** Preserve the existing browser-storage keys, including yard zero. */
export function objectKey(o: IronObject = { kind: "overview", view: "whole" }): string {
  switch (o.kind) {
    case "overview":
      return `overview::${o.view}`;
    case "station":
      return `station:${o.route}:${o.n}`;
    case "stop":
      return `stop:${o.route}:${o.t}`;
    case "yard":
      return `yard:${o.id === 0 ? "" : o.id}:${o.face}`;
    default:
      return `${o.kind}:${o.id}`;
  }
}
