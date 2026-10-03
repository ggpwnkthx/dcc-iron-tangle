import { objectKey } from "./objects.ts";
import type { IronObject } from "./types.ts";

export interface RuntimeObject {
  readonly object: IronObject;
  /** Authored objects already have catalog entries; temporary expansions can opt in. */
  readonly discoverable?: boolean;
  /** Acquire exclusive registrations only after the previous handle has been released. */
  activate?(): void;
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
    try {
      runtime.activate?.();
    } catch (error) {
      this.#objects.delete(key);
      runtime.dispose();
      throw error;
    }
    this.onChange("add", runtime.object);
    return () => {
      if (this.#objects.get(key) !== runtime) return false;
      return this.remove(runtime.object);
    };
  }

  replace(object: IronObject, prepare: () => RuntimeObject) {
    const key = objectKey(object);
    const previous = this.#objects.get(key);
    if (!previous) throw new TypeError(`Object ${key} is not registered`);
    // Preparation can fail without disturbing the live object. Motion IDs are
    // acquired in activate(), after the previous owner's disposal.
    const runtime = prepare();
    if (objectKey(runtime.object) !== key) {
      runtime.dispose();
      throw new TypeError("Replacement must preserve object identity");
    }
    this.#objects.delete(key);
    try {
      previous.dispose();
      runtime.activate?.();
    } catch (error) {
      try {
        runtime.dispose();
      } finally {
        this.onChange("remove", object);
      }
      throw error;
    }
    this.#objects.set(key, runtime);
    this.onChange("replace", runtime.object);
  }

  remove(object: IronObject) {
    const key = objectKey(object);
    const runtime = this.#objects.get(key);
    if (!runtime) return false;
    this.#objects.delete(key);
    try {
      runtime.dispose();
    } finally {
      this.onChange("remove", object);
    }
    return true;
  }

  dispose() {
    const objects = Array.from(this.#objects.values());
    this.#objects.clear();
    const errors: unknown[] = [];
    for (const runtime of objects.reverse()) {
      try {
        runtime.dispose();
      } catch (error) {
        errors.push(error);
      } finally {
        this.onChange("remove", runtime.object);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Object disposal failed");
  }
}

/** A small, idempotent owner for meshes, instances, and registration cleanup. */
export class ResourceScope {
  #cleanup: (() => void)[] = [];
  #disposed = false;

  defer(cleanup: () => void) {
    if (this.#disposed) throw new TypeError("Resource scope is disposed");
    this.#cleanup.push(cleanup);
  }

  own<T extends { dispose(): void }>(resource: T): T {
    this.defer(() => resource.dispose());
    return resource;
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors: unknown[] = [];
    for (const cleanup of this.#cleanup.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Resource disposal failed");
  }
}
