import { MotionRegistry, wrap } from "../src/client/motion.ts";
import { equal, throws } from "./assert.ts";

Deno.test("motion registry advances a shared clock and unregisters by id", () => {
  const motions = new MotionRegistry();
  let first = -1, accumulated = 0;
  const unregister = motions.register("first", ({ elapsed }) => first = elapsed);
  motions.register("second", ({ dt }) => accumulated += dt);

  motions.update(.25);
  equal(first, .25);
  equal(accumulated, .25);
  equal(motions.elapsed, .25);
  equal(motions.size, 2);

  unregister();
  motions.update(.5);
  equal(first, .25);
  equal(accumulated, .75);
  equal(motions.elapsed, .75);
  equal(motions.size, 1);
});

Deno.test("motion registry rejects duplicate ids and invalid deltas", () => {
  const motions = new MotionRegistry();
  motions.register("object", () => {});
  throws(() => motions.register("object", () => {}), "already registered");
  throws(() => motions.update(-1), "finite, non-negative");
});

Deno.test("wrap produces a positive loop position", () => {
  equal(wrap(33, 32), 1);
  equal(wrap(-1, 32), 31);
  equal(wrap(0, 32), 0);
  throws(() => wrap(1, 0), "positive");
});
