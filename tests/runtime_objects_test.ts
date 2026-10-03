import { ResourceScope, RuntimeObjectRegistry } from "../src/client/runtime_objects.ts";
import { MotionRegistry } from "../src/client/motion.ts";
import type { IronObject } from "../src/client/types.ts";
import { assert, equal, throws } from "./assert.ts";

function runtime(object: IronObject, disposed: string[]) {
  return {
    object,
    dispose: () => disposed.push(object.kind + ":" + ("id" in object ? object.id : "")),
  };
}

Deno.test("runtime object registry owns symmetric add and remove cleanup", () => {
  const disposed: string[] = [], changes: string[] = [];
  const registry = new RuntimeObjectRegistry((change, object) => {
    changes.push(change + ":" + object.kind);
  });
  const object: IronObject = { kind: "route", id: "unmapped-1-1" };

  const remove = registry.add(runtime(object, disposed));
  equal(registry.size, 1);
  equal(registry.has(object), true);
  equal(remove(), true);
  equal(registry.size, 0);
  equal(disposed.join(","), "route:unmapped-1-1");
  equal(changes.join(","), "add:route,remove:route");
});

Deno.test("runtime object registry rejects duplicate identities", () => {
  const registry = new RuntimeObjectRegistry();
  const object: IronObject = { kind: "mimic", id: 1 };
  registry.add({ object, dispose() {} });
  throws(() => registry.add({ object, dispose() {} }), "already registered");
});

Deno.test("runtime object registry replaces resources without changing identity", () => {
  const disposed: string[] = [];
  const registry = new RuntimeObjectRegistry();
  const object: IronObject = { kind: "route", id: "unmapped-2--1" };

  registry.add(runtime(object, disposed));
  registry.replace(object, () => runtime(object, disposed));
  equal(disposed.length, 1);
  equal(registry.size, 1);
});

Deno.test("runtime object registry disposes all owned resources", () => {
  const disposed: string[] = [];
  const registry = new RuntimeObjectRegistry();
  registry.add(runtime({ kind: "mimic", id: 1 }, disposed));
  registry.add(runtime({ kind: "mimic", id: 2 }, disposed));

  registry.dispose();
  equal(registry.size, 0);
  equal(disposed.length, 2);
});

Deno.test("replacement prepares resources before release and activates after release", () => {
  const steps: string[] = [];
  const registry = new RuntimeObjectRegistry();
  const object: IronObject = { kind: "train", id: "nightmare" };
  const staleRemove = registry.add({ object, dispose: () => steps.push("release") });
  registry.replace(object, () => {
    equal(registry.has(object), true);
    steps.push("prepare");
    return { object, activate: () => steps.push("activate"), dispose() {} };
  });
  equal(steps.join(","), "prepare,release,activate");
  equal(staleRemove(), false);
  equal(registry.has(object), true);
});

Deno.test("failed preparation preserves the live object and rejects changed identity", () => {
  const disposed: string[] = [];
  const registry = new RuntimeObjectRegistry();
  const object: IronObject = { kind: "mimic", id: 1 };
  registry.add(runtime(object, disposed));
  throws(() =>
    registry.replace(object, () => {
      throw new TypeError("build failed");
    }), "build failed");
  equal(disposed.length, 0);
  throws(
    () => registry.replace(object, () => runtime({ kind: "mimic", id: 2 }, disposed)),
    "preserve object identity",
  );
  equal(registry.has(object), true);
  equal(disposed.join(","), "mimic:2");
});

Deno.test("activation failure cleans the replacement and emits removal", () => {
  const changes: string[] = [], disposed: string[] = [];
  const registry = new RuntimeObjectRegistry((change) => changes.push(change));
  const object: IronObject = { kind: "mimic", id: 1 };
  registry.add(runtime(object, disposed));
  throws(() =>
    registry.replace(object, () => ({
      ...runtime(object, disposed),
      activate() {
        throw new TypeError("activation failed");
      },
    })), "activation failed");
  equal(registry.size, 0);
  equal(disposed.length, 2);
  equal(changes.join(","), "add,remove");
});

Deno.test("resource scopes clean every resource in reverse order, once, despite disposal errors", () => {
  const scope = new ResourceScope();
  const calls: string[] = [];
  scope.defer(() => calls.push("first"));
  scope.defer(() => {
    calls.push("broken");
    throw new Error("cleanup failed");
  });
  scope.own({ dispose: () => calls.push("last") });
  try {
    scope.dispose();
    throw new Error("Expected disposal failure");
  } catch (error) {
    assert(error instanceof AggregateError);
  }
  equal(calls.join(","), "last,broken,first");
  scope.dispose();
  equal(calls.length, 3);
  throws(() => scope.defer(() => {}), "disposed");
});

Deno.test("repeated moving-object replacement reuses one motion id without leaking owners", () => {
  const motions = new MotionRegistry();
  const registry = new RuntimeObjectRegistry();
  const object: IronObject = { kind: "train", id: "nightmare" };
  let updates = 0, disposed = 0;
  const prepare = () => {
    const scope = new ResourceScope();
    scope.defer(() => disposed++);
    return {
      object,
      activate: () => scope.defer(motions.register("train:nightmare", () => updates++)),
      dispose: () => scope.dispose(),
    };
  };
  registry.add(prepare());
  for (let i = 0; i < 30; i++) {
    registry.replace(object, prepare);
    equal(motions.size, 1);
    motions.update(.1);
  }
  equal(updates, 30);
  equal(disposed, 30);
  registry.dispose();
  equal(motions.size, 0);
  equal(disposed, 31);
});
