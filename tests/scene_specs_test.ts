import { MIMIC_SPECS, trainMotion, YARD_SPECS } from "../src/client/scene_specs.ts";
import { assert, equal } from "./assert.ts";

Deno.test("authored scene object ids stay unique", () => {
  const yardIds = new Set(YARD_SPECS.map((spec) => spec.id));
  const yardLabels = new Set(YARD_SPECS.map((spec) => spec.label));
  const mimicIds = new Set(MIMIC_SPECS.map((spec) => spec.id));

  equal(yardIds.size, YARD_SPECS.length);
  equal(yardLabels.size, YARD_SPECS.length);
  equal(mimicIds.size, MIMIC_SPECS.length);
  assert(YARD_SPECS.every((spec) => spec.ring >= 0));
  assert(MIMIC_SPECS.every((spec) => spec.face === 1 || spec.face === -1));
});

Deno.test("train motion has a default and small per-route overrides", () => {
  const ordinary = trainMotion("color-0");
  const nightmare = trainMotion("nightmare");

  equal(ordinary.speed, 4);
  equal(ordinary.startFraction, .7);
  equal(nightmare.speed, 4);
  equal(nightmare.startFraction, .16);
});
