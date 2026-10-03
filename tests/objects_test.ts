import { objectKey, parseObject } from "../src/client/objects.ts";
import { assert, equal } from "./assert.ts";

const registry = {
  routes: new Set(["color-0"]),
  services: new Set(["nightmare"]),
  nodes: new Set(["red83"]),
};

Deno.test("saved selections reject malformed fields and unknown identities", () => {
  for (
    const value of [
      null,
      [],
      { kind: "route", route: "color-0" },
      { kind: "station", id: "color-0", n: 83 },
      { kind: "station", route: "color-0", n: "83" },
      { kind: "station", route: "nightmare", n: 83 },
      { kind: "route", id: "unmapped-3123-1" },
      { kind: "node", id: "missing" },
      { kind: "yard", id: 12, face: 1 },
      { kind: "stop", route: "nightmare", t: NaN, label: "bad" },
    ]
  ) {
    equal(parseObject(value, registry), null);
  }
});

Deno.test("saved selections retain legitimate boundaries and strip irrelevant fields", () => {
  const station = parseObject({ kind: "station", route: "color-0", n: 436, id: "wrong" }, registry);
  assert(station?.kind === "station");
  equal(station.n, 436);
  equal(station.id, undefined);
  assert(parseObject({ kind: "route", id: "unmapped-3122--1" }, registry));
  assert(parseObject({ kind: "yard", id: 0, face: -1 }, registry));
  assert(parseObject({ kind: "stop", route: "nightmare", t: 0, label: "start" }, registry));
});

Deno.test("object keys preserve saved-data compatibility and distinguish paired yards", () => {
  equal(objectKey({ kind: "yard", id: 0, face: 1 }), "yard::1");
  equal(objectKey({ kind: "yard", id: 0, face: -1 }), "yard::-1");
  equal(objectKey({ kind: "station", route: "color-0", n: 24 }), "station:color-0:24");
  equal(objectKey(), "overview::whole");
});
