import {
  catalogDefinitions,
  createObjectRegistry,
  SCENE_DEFINITIONS,
  serviceConnections,
  validateSceneDefinitions,
} from "../src/client/object_definitions.ts";
import {
  canonicalRouteId,
  objectKey,
  parseObject,
  reconcileHistory,
  reconcileObjects,
} from "../src/client/objects.ts";
import { assert, equal, throws } from "./assert.ts";

Deno.test("scene definitions share identities across discovery, validation, and service connections", () => {
  validateSceneDefinitions();
  const registry = createObjectRegistry();
  const catalog = catalogDefinitions();
  equal(catalog.length, 80);
  equal(new Set(catalog.map((entry) => objectKey(entry.object))).size, 80);
  assert(catalog.every((entry) => parseObject(entry.object, registry)));
  for (const service of SCENE_DEFINITIONS.services) {
    assert(serviceConnections(service.id).every((object) => parseObject(object, registry)));
  }
});

Deno.test("line IDs, layout slots, and migrated bookmarks survive insertion and reordering", () => {
  const definitions = {
    ...SCENE_DEFINITIONS,
    lines: [
      { id: "line:new", name: "New", axisIndex: 90, color: ["blue"] as ["blue"] },
      ...SCENE_DEFINITIONS.lines.toReversed(),
    ],
  };
  validateSceneDefinitions(definitions);
  const registry = createObjectRegistry(definitions);
  equal(canonicalRouteId("color-9"), "line:tangerine");
  equal(definitions.lines.find((s) => s.id === "line:tangerine")?.axisIndex, 9);
  const saved = reconcileObjects([
    { kind: "route", id: "color-0" },
    { kind: "route", id: "line:red" },
    { kind: "station", route: "color-9", n: 24 },
  ], registry);
  equal(saved.length, 2);
  equal(objectKey(saved[0]!), "route:line:red");
  equal(objectKey(saved[1]!), "station:line:tangerine:24");
});

Deno.test("deleted definitions invalidate durable references while runtime eviction preserves virtual lines", () => {
  const definitions = {
    ...SCENE_DEFINITIONS,
    lines: SCENE_DEFINITIONS.lines.filter((s) => s.id !== "line:red"),
    mimics: SCENE_DEFINITIONS.mimics.filter((s) => s.id !== 1),
  };
  const registry = createObjectRegistry(definitions);
  const items = reconcileObjects([
    { kind: "route", id: "color-0" },
    { kind: "station", route: "line:red", n: 83 },
    { kind: "mimic", id: 1 },
    { kind: "route", id: "unmapped-300-1" },
  ], registry);
  equal(items.length, 1);
  equal(objectKey(items[0]!), "route:unmapped-300-1");
  const history = reconcileHistory(
    [
      { kind: "overview", view: "whole" },
      { kind: "route", id: "line:red" },
      { kind: "route", id: "line:green" },
      { kind: "mimic", id: 1 },
    ],
    3,
    registry,
  );
  equal(history.items.length, 2);
  equal(history.index, 1);
});

Deno.test("definition validation rejects ambiguous identities and dangling references", () => {
  throws(
    () =>
      validateSceneDefinitions({
        ...SCENE_DEFINITIONS,
        lines: [...SCENE_DEFINITIONS.lines, SCENE_DEFINITIONS.lines[0]!],
      }),
    "Duplicate line id",
  );
  throws(
    () =>
      validateSceneDefinitions({
        ...SCENE_DEFINITIONS,
        lines: SCENE_DEFINITIONS.lines.filter((s) => s.id !== "line:red"),
      }),
    "Unknown line",
  );
});

Deno.test("removing a service updates discovery and connected stops without separate lists", () => {
  const definitions = {
    ...SCENE_DEFINITIONS,
    services: SCENE_DEFINITIONS.services.filter((s) => s.id !== "escape"),
  };
  validateSceneDefinitions(definitions);
  equal(catalogDefinitions(definitions).length, 78);
  equal(serviceConnections("escape", definitions).length, 0);
  equal(
    parseObject(
      { kind: "stop", route: "escape", t: 0, label: "old" },
      createObjectRegistry(definitions),
    ),
    null,
  );
});

Deno.test("definition validation catches deleted landmark connections and invalid placement", () => {
  throws(
    () =>
      validateSceneDefinitions({
        ...SCENE_DEFINITIONS,
        landmarks: SCENE_DEFINITIONS.landmarks.filter((s) => s.id !== "abyss"),
      }),
    "Unknown connection",
  );
  throws(
    () =>
      validateSceneDefinitions({
        ...SCENE_DEFINITIONS,
        yards: [{ ...SCENE_DEFINITIONS.yards[0]!, ring: 99 }],
      }),
    "Unknown yard ring",
  );
});
