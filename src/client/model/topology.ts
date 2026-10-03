import { STATION_24_PLATFORM_EXITS } from "../canon.ts";
import { required } from "../dom.ts";
import { LOGO_RINGS, YARD_SPECS } from "../scene_specs.ts";
import * as B from "@babylonjs/core";
import type { StationNode } from "../types.ts";
import { hash, TAU } from "./math.ts";

const V = B.Vector3;

// Station 24 explicitly has ten platform exits. Reusing that count for every modeled stairwell
// bundle is still an inference, but it is a book-supported heuristic and is preferable to the
// previous arbitrary nine-line grouping.
export const modeledHubPlatformCount = STATION_24_PLATFORM_EXITS;
export const logoRings = LOGO_RINGS, yardSpecs = YARD_SPECS;
export function yardSpec(id: number) {
  return required(yardSpecs.find((spec) => spec.id === id));
}
export function ringPoint(index: number, a: number) {
  const r = logoRings[index];
  return new V(
    required(r).x + required(r).radius * Math.cos(a),
    required(r).y + required(r).lift * Math.sin(a + required(r).phase),
    required(r).z + required(r).radius * Math.sin(a),
  );
}
export function yardBase(id: number) {
  const s = yardSpec(id);
  return ringPoint(required(s).ring, required(s).angle);
}
export function axisBase(i: number, t: number) {
  const g = Math.floor(i / modeledHubPlatformCount),
    s = yardSpecs[g % yardSpecs.length],
    r = logoRings[required(s).ring],
    loopEnd = .86;
  const innerAngle = Math.atan2(-required(r).z, -required(r).x);
  const remaining = ((required(s).direction * (innerAngle - required(s).angle) % TAU) + TAU) %
    TAU;
  const travel = TAU + remaining;
  const loopPoint = (u: number) => {
    const fan = Math.sin(Math.PI * u),
      a = required(s).angle + required(s).direction * travel * u +
        (hash(i + 81) - .5) * .055 * fan;
    const band = (hash(i + 1) - .5) * 10 * fan;
    return ringPoint(required(s).ring, a).add(
      new V(
        Math.cos(a) * band,
        (hash(g + 53) - .5) * 17 * fan + Math.sin(a * 2 + hash(i + 17) * TAU) * 4 * fan,
        Math.sin(a) * band,
      ),
    );
  };
  if (t <= loopEnd) return loopPoint(t / loopEnd);
  const u = (t - loopEnd) / (1 - loopEnd), q = loopPoint(1);
  // The numbered subway services are open routes even though their aggregate
  // traces the loop motif. Their final stations converge on the central rim.
  const a = Math.atan2(q.z, q.x) + (hash(g + 31) - .5) * .55;
  const end = new V(Math.cos(a) * 22, 19 + (hash(g + 62) - .5) * 13, Math.sin(a) * 22);
  const bow = new V(-Math.sin(a) * 7, 6, Math.cos(a) * 7).scale(Math.sin(Math.PI * u));
  return V.Lerp(q, end, u).add(bow);
}
export function nightmarePoint(t: number) {
  // Two unequal circular lobes meet in top projection, with a grade-separated
  // second crossing. Preserve the recorded 83–283–436–283–83 stop sequence.
  const left = t <= .25 || t >= .75, index = left ? 0 : 1;
  const a = left
    ? (t <= .25 ? Math.PI + t * TAU * 2 : (t - .75) * TAU * 2)
    : Math.PI - (t - .25) * TAU * 2;
  const p = ringPoint(index, a);
  p.y = 24 + 9 * Math.sin(t * TAU);
  return p;
}
export const nodes: Record<string, StationNode> = {
  red83: {
    n: 83,
    p: nightmarePoint(0),
    label: "83 · Red / Yellow",
    lines: ["Red", "Yellow"],
    ring: 0,
    priority: 1,
  },
  purple283: {
    n: 283,
    p: nightmarePoint(.125),
    label: "283 · Purple / Mauve",
    lines: ["Purple", "Mauve"],
    ring: 0,
    priority: 2,
  },
  abyss436: {
    n: 436,
    p: nightmarePoint(.25),
    label: "436 · Abyss station",
    lines: [],
    ring: 0,
    priority: 0,
  },
  green283: {
    n: 283,
    p: nightmarePoint(.375),
    label: "283 · Green / Yellow",
    lines: ["Green", "Yellow"],
    ring: 0,
    priority: 2,
  },
  plum83: {
    n: 83,
    p: nightmarePoint(.5),
    label: "83 · Tangerine / Plum",
    lines: ["Tangerine", "Plum"],
    ring: 0,
    priority: 1,
  },
  orange83: {
    n: 83,
    p: ringPoint(0, -2.7),
    label: "83 · Orange / Indigo",
    lines: ["Orange", "Indigo"],
    ring: 0,
    priority: 4,
  },
  yellow89: {
    n: 89,
    p: ringPoint(0, -2.4),
    label: "89 · Yellow / Indigo",
    lines: ["Yellow", "Indigo"],
    ring: 0,
    priority: 5,
  },
  tangerine89: {
    n: 89,
    p: ringPoint(1, .35),
    label: "89 · Tangerine / Escape Velocity",
    lines: ["Tangerine"],
    ring: 0,
    priority: 5,
  },
  mauve281: {
    n: 281,
    p: ringPoint(2, Math.PI),
    label: "281 · Mauve / Dismemberment",
    lines: ["Mauve"],
    ring: 0,
    priority: 4,
  },
  ochre149: {
    n: 149,
    p: ringPoint(2, 0),
    label: "149 · Ochre / Dismemberment",
    lines: ["Ochre"],
    ring: 0,
    priority: 4,
  },
  azure199: {
    n: 199,
    p: ringPoint(3, Math.PI * .6),
    label: "199 · Azure / Brown",
    lines: ["Azure", "Brown"],
    ring: 0,
    priority: 5,
  },
  vermillion101: {
    n: 101,
    p: ringPoint(1, .62),
    label: "101 · Vermillion",
    lines: ["Vermillion"],
    ring: 0,
    priority: 6,
  },
  cobalt271: {
    n: 271,
    p: ringPoint(3, 0),
    label: "271 · Camel / Cobalt / Eviscerator",
    lines: ["Camel", "Cobalt"],
    ring: 0,
    priority: 4,
  },
  security75: {
    n: 75,
    p: ringPoint(1, .18),
    label: "75 · Security / repair hub",
    lines: ["Vermillion"],
    ring: 0,
    priority: 5,
  },
  employee60: {
    n: 60,
    p: ringPoint(3, -Math.PI / 3),
    label: "60 · Employee hub",
    lines: [],
    ring: 0,
    priority: 5,
  },
};
const nodeRings: Record<string, number> = {
  red83: 0,
  purple283: 0,
  abyss436: 0,
  green283: 1,
  plum83: 1,
  orange83: 0,
  yellow89: 0,
  tangerine89: 1,
  mauve281: 2,
  ochre149: 2,
  azure199: 3,
  vermillion101: 1,
  cobalt271: 3,
  security75: 1,
  employee60: 3,
};
Object.entries(nodes).forEach(([id, n]) => n.ring = required(nodeRings[id]));
const angleAt = (ring: number, p: B.Vector3) =>
  Math.atan2(p.z - required(logoRings[ring]).z, p.x - required(logoRings[ring]).x);
const wrapAngle = (a: number) => ((a % TAU) + TAU) % TAU;
// Junctions belong to the inferred geometry only. They do not assert new
// documented stations or connections between named services.
export const ringJunctions: { p: B.Vector3; members: { ring: number; angle: number }[] }[] = [];
for (let a = 0; a < logoRings.length; a++) {
  for (let b = a + 1; b < logoRings.length; b++) {
    const u = logoRings[a],
      v = logoRings[b],
      dx = required(v).x - required(u).x,
      dz = required(v).z - required(u).z,
      d = Math.hypot(dx, dz);
    if (
      d < 1e-8 || d > required(u).radius + required(v).radius + 1e-8 ||
      d < Math.abs(required(u).radius - required(v).radius) - 1e-8
    ) continue;
    const along =
        (required(u).radius * required(u).radius - required(v).radius * required(v).radius +
          d * d) / (2 * d),
      h = Math.sqrt(Math.max(0, required(u).radius * required(u).radius - along * along));
    for (const sign of h < 1e-7 ? [1] : [1, -1]) {
      const p = new V(
        required(u).x + dx / d * along - sign * dz / d * h,
        0,
        required(u).z + dz / d * along + sign * dx / d * h,
      );
      const angles: [number, number] = [angleAt(a, p), angleAt(b, p)];
      p.y = (ringPoint(a, angles[0]).y + ringPoint(b, angles[1]).y) / 2;
      ringJunctions.push({
        p,
        members: [{ ring: a, angle: angles[0] }, { ring: b, angle: angles[1] }],
      });
    }
  }
}
function ringArc(ring: number, from: B.Vector3, to: B.Vector3, direction: number, index: number) {
  const start = angleAt(ring, from),
    sweep = wrapAngle(direction * (angleAt(ring, to) - start)),
    r = logoRings[ring];
  const startOffset = from.subtract(ringPoint(ring, start)),
    endOffset = to.subtract(ringPoint(ring, start + direction * sweep));
  const length = Math.max(sweep * required(r).radius, V.Distance(from, to)),
    count = Math.max(2, Math.ceil(length / 2.5));
  const points = Array.from({ length: count + 1 }, (_, k) => {
    if (k === 0) return from.clone();
    if (k === count) return to.clone();
    const u = k / count, e = u * u * (3 - 2 * u), angle = start + direction * sweep * u;
    const lane = (hash(index + 96) - .5) * 2.4 * Math.sin(Math.PI * u);
    return ringPoint(ring, angle).add(V.Lerp(startOffset, endOffset, e)).add(
      new V(
        Math.cos(angle) * lane,
        (hash(index + 72) - .5) * 3 * Math.sin(Math.PI * u),
        Math.sin(angle) * lane,
      ),
    );
  });
  return { ring, start, sweep, direction, points, length };
}
export function ringPath(
  from: { ring: number; p: B.Vector3 },
  to: { ring: number; p: B.Vector3 },
  direction: number,
  index: number,
) {
  // Remain on the same circle between stops on that circle. For different
  // circles, traverse their directed arcs through actual XZ intersections.
  if (from.ring === to.ring) return [ringArc(from.ring, from.p, to.p, direction, index)];
  const vertices = ringJunctions.concat([
      { p: from.p, members: [{ ring: from.ring, angle: angleAt(from.ring, from.p) }] },
      { p: to.p, members: [{ ring: to.ring, angle: angleAt(to.ring, to.p) }] },
    ]),
    source = vertices.length - 2,
    target = vertices.length - 1,
    edges: { to: number; ring: number; cost: number }[][] = vertices.map(() => []);
  logoRings.forEach((r, ring) => {
    const members = vertices.flatMap((v, id) =>
      v.members.filter((m) => m.ring === ring).map((m) => ({ id, angle: wrapAngle(m.angle) }))
    ).sort((a, b) => a.angle - b.angle || a.id - b.id);
    members.forEach((m, k) => {
      const next = members[(k + direction + members.length) % members.length],
        sweep = wrapAngle(direction * (required(next).angle - m.angle));
      required(edges[m.id]).push({
        to: required(next).id,
        ring,
        cost: Math.max(
          .001,
          sweep * r.radius +
            Math.abs(required(vertices[m.id]).p.y - required(vertices[required(next).id]).p.y) *
              .15,
        ),
      });
    });
  });
  const distances = vertices.map(() => Infinity),
    previous: ({ from: number; ring: number } | null)[] = vertices.map(() => null),
    visited = new Set();
  distances[source] = 0;
  for (let step = 0; step < vertices.length; step++) {
    let at = -1;
    vertices.forEach((_, id) => {
      if (!visited.has(id) && (at === -1 || required(distances[id]) < required(distances[at]))) {
        at = id;
      }
    });
    if (at === -1 || !Number.isFinite(distances[at])) break;
    if (at === target) break;
    visited.add(at);
    required(edges[at]).forEach((edge) => {
      const d = required(distances[at]) + edge.cost;
      if (d < required(distances[edge.to])) {
        distances[edge.to] = d;
        previous[edge.to] = { from: at, ring: edge.ring };
      }
    });
  }
  if (!previous[target]) throw new Error("Disconnected Syndicate ring graph");
  const steps = [];
  for (let at = target; at !== source;) {
    const edge = previous[at];
    steps.unshift({
      ring: required(edge).ring,
      from: required(vertices[required(edge).from]).p,
      to: required(vertices[at]).p,
    });
    at = required(edge).from;
  }
  return steps.map((s) => ringArc(s.ring, s.from, s.to, direction, index));
}
