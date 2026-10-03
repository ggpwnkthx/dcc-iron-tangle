import {
  LANDMARK_SPECS,
  LINE_SPECS,
  LOGO_RINGS,
  MIMIC_SPECS,
  SERVICE_SPECS,
  STATION_SPECS,
  YARD_SPECS,
} from "./scene_specs.ts";
import { isObjectAvailable } from "./objects.ts";
import type { Group, IronObject } from "./types.ts";

/** One authored source for renderer inputs, discovery, connections, and validation. */
export const SCENE_DEFINITIONS = {
  rings: LOGO_RINGS,
  lines: LINE_SPECS,
  stations: STATION_SPECS,
  services: SERVICE_SPECS,
  yards: YARD_SPECS,
  mimics: MIMIC_SPECS,
  landmarks: LANDMARK_SPECS,
};
export type SceneDefinitions = typeof SCENE_DEFINITIONS;

export function createObjectRegistry(definitions: SceneDefinitions = SCENE_DEFINITIONS) {
  return {
    routes: new Set(definitions.lines.map((spec) => spec.id)),
    services: new Set(definitions.services.map((spec) => spec.id)),
    nodes: new Set(Object.keys(definitions.stations)),
    yards: new Set(definitions.yards.map((spec) => spec.id)),
    mimics: new Set(definitions.mimics.map((spec) => spec.id)),
    landmarks: new Set(definitions.landmarks.map((spec) => spec.id)),
  };
}

export interface CatalogDefinition {
  object: IronObject;
  group: Group;
  meta: string;
  aliases: string;
  rank: number;
}

export function catalogDefinitions(definitions: SceneDefinitions = SCENE_DEFINITIONS) {
  const entries: CatalogDefinition[] = [];
  const add = (object: IronObject, group: Group, meta: string, aliases = "", rank = 100) =>
    entries.push({ object, group, meta, aliases, rank });
  definitions.landmarks.forEach((s) =>
    add({ kind: "landmark", id: s.id }, "landmarks", s.meta, s.aliases, s.rank)
  );
  Object.entries(definitions.stations).forEach(([id, n]) => {
    const meta = id === "security75"
      ? "Downward Dog · security / repair"
      : id === "employee60"
      ? "Employee hub · staff access"
      : id === "abyss436"
      ? "Nightmare Express · Abyss station"
      : "Documented connection · inferred position";
    add(
      { kind: "node", id },
      "stations",
      meta,
      n.lines.join(" "),
      id === "red83" ? 2 : id === "employee60" ? 5 : id === "security75" ? 6 : 20 + n.priority,
    );
  });
  definitions.services.forEach((s) => {
    add(
      { kind: "train", id: s.id },
      "trains",
      "Locate leading vehicle",
      s.stops.map((stop) => stop.label).join(" "),
      s.id === "nightmare" ? 1 : 12,
    );
    s.stops.forEach((stop) => {
      if (stop.catalog) {
        add(stop.target, "stations", stop.catalog.meta, stop.catalog.aliases, stop.catalog.rank);
      }
    });
  });
  definitions.lines.forEach((s) =>
    add(
      { kind: "route", id: s.id },
      "lines",
      "One-way subway · inferred ring path",
      Object.values(definitions.stations).filter((n) => n.lines.includes(s.id)).map((n) => n.label)
        .join(" "),
      60,
    )
  );
  definitions.yards.forEach(({ id, label, named }) => {
    add(
      { kind: "yard", id, face: 1 },
      "yards",
      named ? "Named yard · reconstructed position" : "Unidentified yard · inferred",
      label === "E" ? "Homeward Bound staff service" : "",
      id === 3 ? 3 : 70 + id,
    );
    add(
      { kind: "yard", id, face: -1 },
      "yards",
      "Opposing identity and pairing inferred",
      "trainyard " + label + " inverted",
      90 + id,
    );
  });
  definitions.mimics.forEach(({ id }) =>
    add(
      { kind: "mimic", id },
      "bosses",
      "Terminus 433 · hidden stairwell revealed after Mimic removal · placement inferred",
      "station mimic boss terminus 433 hidden stairwell saferoom",
      id === 1 ? 7 : 80 + id,
    )
  );
  return entries;
}

export function serviceConnections(
  id: string,
  definitions: SceneDefinitions = SCENE_DEFINITIONS,
): IronObject[] {
  return definitions.services.find((s) => s.id === id)?.stops.map((stop) => ({ ...stop.target })) ??
    [];
}

/** Fail early on duplicate identities and dangling authored references. */
export function validateSceneDefinitions(definitions: SceneDefinitions = SCENE_DEFINITIONS) {
  const unique = (values: (string | number)[], label: string) => {
    if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${label}`);
  };
  unique(definitions.lines.map((s) => s.id), "line id");
  unique(definitions.lines.map((s) => s.axisIndex), "line layout slot");
  unique(definitions.services.map((s) => s.id), "service id");
  unique(definitions.yards.map((s) => s.id), "yard id");
  unique(definitions.mimics.map((s) => s.id), "Mimic id");
  unique(definitions.landmarks.map((s) => s.id), "landmark id");
  const registry = createObjectRegistry(definitions);
  const ringExists = (ring: number) =>
    Number.isInteger(ring) && ring >= 0 && ring < definitions.rings.length;
  if (!definitions.lines.length || !definitions.yards.length || !definitions.rings.length) {
    throw new TypeError("Scene needs at least one line, yard, and ring");
  }
  for (const line of definitions.lines) {
    if (
      !line.id.startsWith("line:") || !Number.isInteger(line.axisIndex) || line.axisIndex < 0 ||
      line.axisIndex >= 3123
    ) {
      throw new TypeError(`Invalid line identity or layout slot: ${line.id}`);
    }
  }
  for (const [id, station] of Object.entries(definitions.stations)) {
    if (station.lines.some((line) => !registry.routes.has(line))) {
      throw new TypeError(`Unknown line at station ${id}`);
    }
    if (
      !ringExists(station.ring) ||
      station.placement.kind === "ring" && !ringExists(station.placement.ring)
    ) {
      throw new TypeError(`Unknown ring at station ${id}`);
    }
  }
  if (definitions.yards.some((yard) => !ringExists(yard.ring))) {
    throw new TypeError("Unknown yard ring");
  }
  for (const service of definitions.services) {
    if (
      !Number.isInteger(service.count) || service.count < 1 || !Number.isFinite(service.spacing) ||
      service.spacing <= 0
    ) {
      throw new TypeError(`Invalid train dimensions for ${service.id}`);
    }
    if (service.path.kind !== "nightmare" && !ringExists(service.path.ring)) {
      throw new TypeError(`Unknown ring for ${service.id}`);
    }
    if (registry.routes.has(service.id)) {
      throw new TypeError(`Service and line share id ${service.id}`);
    }
    if (service.path.kind === "access" && !registry.routes.has(service.path.line)) {
      throw new TypeError(`Unknown access line for ${service.id}`);
    }
    for (const stop of service.stops) {
      const target = stop.target;
      const exists = target.kind === "node"
        ? registry.nodes.has(target.id)
        : target.kind === "yard"
        ? registry.yards.has(target.id)
        : target.kind === "stop"
        ? registry.services.has(target.route) && target.route === service.id &&
          target.t === stop.t && target.label === stop.label
        : false;
      if (!exists || stop.t < 0 || stop.t > 1 || !Number.isFinite(stop.t)) {
        throw new TypeError(`Invalid stop for ${service.id}`);
      }
      if (stop.platform && target.kind !== "stop") {
        throw new TypeError(`Platform needs a stop identity for ${service.id}`);
      }
    }
  }
  for (const landmark of definitions.landmarks) {
    if (landmark.connections.some((object) => !isObjectAvailable(object, registry))) {
      throw new TypeError(`Unknown connection for landmark ${landmark.id}`);
    }
  }
}
