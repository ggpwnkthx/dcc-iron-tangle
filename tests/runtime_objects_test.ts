import { RuntimeObjectRegistry } from "../src/client/runtime_objects.ts";
import type { IronObject } from "../src/client/types.ts";
import { equal, throws } from "./assert.ts";

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
  registry.replace(runtime(object, disposed));
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
