import * as B from "@babylonjs/core";

export const TAU = Math.PI * 2;

export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

export function mix(a: B.Color3, b: B.Color3, t: number) {
  return B.Color3.Lerp(a, b, t);
}

export function lineSample(fn: (t: number) => B.Vector3, count = 150, extra: number[] = []) {
  const ts = [...new Set([...Array.from({ length: count + 1 }, (_, i) => i / count), ...extra])]
    .sort((a, b) => a - b);
  return ts.map(fn);
}

export function stationT(n: number) {
  return n <= 72 ? (n - 10) / 62 * .17 : .17 + (n - 72) / 364 * .83;
}
