import { objectKey } from "./objects.ts";
import type { IronObject } from "./types.ts";

export interface RuntimeObject {
  readonly object: IronObject;
  dispose(): void;
}

export type RuntimeObjectChange = "add" | "remove" | "replace";

export class RuntimeObjectRegistry {
  #objects = new Map<string, RuntimeObject>();

  constructor(
    private readonly onChange: (
      change: RuntimeObjectChange,
      object: IronObject,
    ) => void = () => {},
  ) {}

  get size() {
    return this.#objects.size;
  }

  has(object: IronObject) {
    return this.#objects.has(objectKey(object));
  }

  get(object: IronObject) {
    return this.#objects.get(objectKey(object));
  }

  values() {
    return this.#objects.values();
  }

  add(runtime: RuntimeObject) {
    const key = objectKey(runtime.object);
    if (this.#objects.has(key)) throw new TypeError(`Object ${key} is already registered`);
    this.#objects.set(key, runtime);
    this.onChange("add", runtime.object);
    return () => {
      if (this.#objects.get(key) !== runtime) return false;
      return this.remove(runtime.object);
    };
  }

  replace(runtime: RuntimeObject) {
    const key = objectKey(runtime.object);
    const previous = this.#objects.get(key);
    if (!previous) throw new TypeError(`Object ${key} is not registered`);
    previous.dispose();
    this.#objects.set(key, runtime);
    this.onChange("replace", runtime.object);
  }

  remove(object: IronObject) {
    const key = objectKey(object);
    const runtime = this.#objects.get(key);
    if (!runtime) return false;
    runtime.dispose();
    this.#objects.delete(key);
    this.onChange("remove", object);
    return true;
  }

  dispose() {
    const objects = Array.from(this.#objects.values());
    this.#objects.clear();
    for (const runtime of objects) runtime.dispose();
    for (const runtime of objects) this.onChange("remove", runtime.object);
  }
}
