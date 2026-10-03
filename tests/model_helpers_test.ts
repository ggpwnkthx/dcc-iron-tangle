import { assert, equal } from "./assert.ts";
import { clamp, hash, stationT } from "../src/client/model/math.ts";
import {
  logoRings,
  nightmarePoint,
  nodes,
  ringJunctions,
  yardSpec,
  yardSpecs,
} from "../src/client/model/topology.ts";

Deno.test("model math helpers retain route interpolation behavior", () => {
  equal(clamp(-2, 0, 1), 0);
  equal(clamp(.5, 0, 1), .5);
  equal(clamp(2, 0, 1), 1);
  equal(stationT(10), 0);
  equal(stationT(72), .17);
  equal(hash(42), hash(42));
  assert(hash(42) >= 0 && hash(42) < 1);
});

Deno.test("topology module exposes authored rings, yards, and station graph", () => {
  equal(logoRings.length, 4);
  equal(yardSpecs.length, 12);
  equal(yardSpec(3).label, "E");
  equal(nodes.abyss436?.n, 436);
  equal(nightmarePoint(.25).y, 33);
  assert(ringJunctions.length > 0);
});
