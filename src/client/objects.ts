import type { IronObject, LandmarkId } from "./types.ts";
import { LEGACY_LINE_IDS } from "./scene_specs.ts";
import type { createObjectRegistry } from "./object_definitions.ts";

export type ObjectRegistry = ReturnType<typeof createObjectRegistry>;

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

/** Migrate positional aliases before validating against the current definitions. */
export function canonicalRouteId(id: string): string {
  return Object.hasOwn(LEGACY_LINE_IDS, id) ? (LEGACY_LINE_IDS[id] ?? id) : id;
}

/** Validate persisted JSON and construct a clean object with only the relevant fields. */
export function parseObject(value: unknown, registry: ObjectRegistry): IronObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = { ...value } as Record<string, unknown>;
  if (typeof o.id === "string" && (o.kind === "route" || o.kind === "train")) {
    o.id = canonicalRouteId(o.id);
  }
  if (typeof o.route === "string" && (o.kind === "station" || o.kind === "stop")) {
    o.route = canonicalRouteId(o.route);
  }
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
      return typeof o.id === "number" && Number.isInteger(o.id) && registry.yards.has(o.id) &&
          (o.face === 1 || o.face === -1)
        ? { kind: "yard", id: o.id, face: o.face }
        : null;
    case "mimic":
      return typeof o.id === "number" && Number.isInteger(o.id) && registry.mimics.has(o.id)
        ? { kind: "mimic", id: o.id }
        : null;
    case "landmark":
      return typeof o.id === "string" && registry.landmarks.has(o.id as LandmarkId)
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

/** Reconcile bookmarks after definitions change, preserving virtual unmapped-line identities. */
export function reconcileObjects(
  values: readonly unknown[],
  registry: ObjectRegistry,
): IronObject[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const object = parseObject(value, registry);
    if (!object || seen.has(objectKey(object))) return [];
    seen.add(objectKey(object));
    return [object];
  });
}

export function isObjectAvailable(object: IronObject, registry: ObjectRegistry): boolean {
  return object.kind === "overview" || parseObject(object, registry) !== null;
}

export function reconcileHistory(
  items: readonly IronObject[],
  index: number,
  registry: ObjectRegistry,
) {
  const history: IronObject[] = [];
  let nextIndex = -1;
  items.forEach((object, i) => {
    const valid = object.kind === "overview" ? object : parseObject(object, registry);
    if (valid) {
      history.push(valid);
      if (i <= index) nextIndex = history.length - 1;
    }
  });
  if (!history.length) history.push({ kind: "overview", view: "whole" });
  return { items: history, index: Math.max(0, nextIndex) };
}
