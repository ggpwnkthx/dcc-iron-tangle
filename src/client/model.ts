import {
  CANONICAL_STAIRWELL_COUNT,
  HOMEWARD_BOUND_PLATFORM_COUNT,
  isPrimaryStairwellStation,
  PRIMARY_STAIRWELL_STATIONS,
  STATION_24_PLATFORM_EXITS,
  STATION_24_STAIRWELLS,
  stationCanonRole,
} from "./canon.ts";
import { context2D, element, query, required, rootElement } from "./dom.ts";
import { MotionRegistry, wrap } from "./motion.ts";
import { objectRouteId } from "./objects.ts";
import { RuntimeObjectRegistry } from "./runtime_objects.ts";
import { CUTAWAY_MOTION, MIMIC_SPECS, trainMotion } from "./scene_specs.ts";
import { createMeshBuilders } from "./model/meshes.ts";
import { clamp, hash, lineSample, mix, stationT, TAU } from "./model/math.ts";
import { createTheme } from "./model/theme.ts";
import {
  axisBase,
  logoRings,
  modeledHubPlatformCount,
  nightmarePoint,
  nodes,
  ringJunctions,
  ringPath,
  ringPoint,
  yardBase,
  yardSpec,
  yardSpecs,
} from "./model/topology.ts";
import * as B from "@babylonjs/core";
import type { UI } from "./interface.ts";
import type {
  Anchor,
  BulkMetadata,
  CameraTween,
  IronObject,
  LabelTarget,
  ObjectLocation,
  PickMetadata,
  Route,
  SceneLabel,
  ScreenTarget,
  Train,
  View,
  Yard,
} from "./types.ts";
export function createModel(ui: UI) {
  const root = rootElement();
  const $ = element;
  const canvas = $("it-canvas"), overlay = $("it-labels"), ctx = context2D(overlay);
  const viewControl = $("it-view"), lineControl = $("it-line"), stationControl = $("it-station");
  const splitControl = $("it-split"), playControl = $("it-play"), detail = $("it-detail");
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  function fail(message: string) {
    $("it-loading").hidden = true;
    $("it-error").hidden = false;
    $("it-error").textContent = message;
  }
  const isView = (value: string): value is View =>
    ["whole", "known", "top", "logo", "yard", "abyss", "cutaway"].includes(value);
  const V = B.Vector3, C = B.Color3;
  let engine: B.Engine, scene: B.Scene;
  try {
    engine = new B.Engine(canvas, true, {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: "high-performance",
    }, true);
    scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(0, 0, 0, 0);
  } catch (_e) {
    fail("This 3D reconstruction requires a browser with WebGL.");
    return;
  }
  const camera = new B.ArcRotateCamera("orbit", -1.1, 1.08, 330, new V(0, 4, 0), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 760;
  camera.lowerBetaLimit = .025;
  camera.upperBetaLimit = Math.PI - .025;
  camera.wheelDeltaPercentage = .012;
  camera.panningSensibility = 70;
  camera.minZ = .15;
  camera.maxZ = 1600;
  camera.inertia = .75;
  scene.activeCamera = camera;
  const hemi = new B.HemisphericLight("ambient", new V(.1, 1, .2), scene);
  hemi.intensity = .92;
  const lamp = new B.DirectionalLight("work light", new V(-.4, -1, .5), scene);
  lamp.intensity = .55;
  const globalRoot = new B.TransformNode("complete floor", scene);
  const abyssRoot = new B.TransformNode("Abyss architecture", scene);
  abyssRoot.parent = globalRoot;
  const upper = new B.TransformNode("ordinary face", scene);
  upper.parent = globalRoot;
  const lower = new B.TransformNode("inverted face", scene);
  lower.parent = globalRoot;
  const middle = new B.TransformNode("hidden passage network", scene);
  middle.parent = globalRoot;
  const cutaway = new B.TransformNode("tunnel cutaway", scene);
  cutaway.setEnabled(false);
  const bulkRoots = {
    upper: new B.TransformNode("unmapped upper rails", scene),
    lower: new B.TransformNode("unmapped lower rails", scene),
  };
  bulkRoots.upper.parent = upper;
  bulkRoots.lower.parent = lower;
  const labels: SceneLabel[] = [],
    routeMeshes: B.Mesh[] = [],
    stationMeshes: B.TransformNode[] = [],
    trains: Train[] = [],
    yards: Yard[] = [],
    bosses: B.TransformNode[] = [],
    enginePortals: B.Mesh[] = [];
  let selected = "all",
    selectedStation: number | null = null,
    playing = false,
    lastTime = performance.now(),
    currentView: View = "whole";
  let cameraTween: CameraTween | null = null,
    ready = false,
    selectedStationMeshes: B.Mesh[] = [],
    needsRender = 8,
    inferredRoute: Route | null = null;
  let activeObject: IronObject | null = null,
    hoveredObject: IronObject | null = null,
    screenTargets: ScreenTarget[] = [],
    labelTargets: LabelTarget[] = [];
  const motions = new MotionRegistry();
  const runtimeObjects = new RuntimeObjectRegistry((change, object) => {
    root.dispatchEvent(new CustomEvent("iron:objects-changed", { detail: { change, object } }));
  });
  function requestRender() {
    needsRender = 3;
  }
  scene.skipPointerMovePicking = true;
  const {
    palette,
    colorDefinitions,
    routeColor,
    darkTone,
    material,
    refreshMaterials,
  } = createTheme(scene);
  const steel = material(
    "structural metal",
    () => mix(palette["muted-foreground"], palette.background, .35),
    { metal: true, emission: .06 },
  );
  const darkSteel = material(
    "train bodies",
    () => mix(darkTone(), palette["muted-foreground"], .18),
    { metal: true, emission: .04 },
  );
  material(
    "unmapped rail web",
    () => mix(palette["muted-foreground"], palette.background, .28),
    { metal: true, emission: .16 },
  );
  const oppositeMat = material(
    "unidentified opposing rail web",
    () => mix(palette["muted-foreground"], palette.background, .38),
    { metal: true, emission: .12 },
  );
  const hiddenMat = material(
    "hidden conveyor",
    () => mix(palette.orange, palette["muted-foreground"], .7),
    { emission: .25 },
  );
  const windowMat = material("train windows", () => mix(palette.yellow, palette.background, .2), {
    emission: .8,
  });
  const stairMat = material("stair portals", () => palette.green, { emission: .45 });
  const abyssMat = material(
    "abyss walls",
    () => mix(darkTone(), palette["muted-foreground"], .28),
    { emission: .03 },
  );
  const bossMat = material(
    "station mimic",
    () => mix(palette.red, palette["muted-foreground"], .35),
    { emission: .18 },
  );
  const nightmareMat = material("nightmare rails", () => palette.purple, { emission: .45 });
  const dismemberMat = material(
    "dismemberment rails",
    () => mix(palette.foreground, palette.background, .08),
    { emission: .35 },
  );
  const evisceratorMat = material("eviscerator rails", () => palette.red, { emission: .4 });
  const escapeMat = material("escape velocity", () => palette.green, { emission: .42 });
  const homewardMat = material("homeward bound", () => palette.orange, { emission: .4 });
  const railMaterials = colorDefinitions.map((d, i) =>
    material(d[0] + " rail", () => routeColor(i), { emission: .42, metal: true })
  );
  const glow = new B.GlowLayer("work lights", scene, { blurKernelSize: 16, mainTextureRatio: .25 });
  glow.intensity = .28;
  const { box, tube, torus } = createMeshBuilders(scene);
  const defaultPrototype = new B.Mesh("route prototype placeholder", scene);
  function routeDefaults(): Route {
    return {
      id: "",
      name: "",
      i: -1,
      point: () => V.Zero(),
      namedNodes: [],
      path: [],
      anchors: [],
      samples: [],
      arcs: [],
      material: steel,
      loop: false,
      reverse: false,
      count: 12,
      spacing: 1.9,
      prototype: defaultPrototype,
      stops: [],
      parent: upper,
      length: 0,
      distancePoint: () => V.Zero(),
    };
  }
  const knownRoutes: Route[] = colorDefinitions.map((d, i) => {
    const namedNodes = Object.values(nodes).filter((n) => n.lines.includes(d[0])),
      spec = yardSpecs[Math.floor(i / modeledHubPlatformCount) % yardSpecs.length];
    const anchors: Anchor[] = [10, 12, 24, 36, 48, 60, 72, 180, 340, 410, 433, 435, 436].filter((
      n,
    ) => n <= 72 || !namedNodes.some((k) => Math.abs(k.n - n) < 28)).map((n) => ({
      n,
      t: stationT(n),
      ring: required(spec).ring,
      p: axisBase(
        n <= 72 ? Math.floor(i / modeledHubPlatformCount) * modeledHubPlatformCount : i,
        stationT(n),
      ).add(new V(0, 1.15, 0)),
    }));
    namedNodes.forEach((n) =>
      anchors.push({ n: n.n, t: stationT(n.n), ring: n.ring, p: n.p.clone() })
    );
    anchors.push({
      n: null,
      t: .86,
      ring: required(spec).ring,
      p: axisBase(i, .86).add(new V(0, 1.15, 0)),
    });
    anchors.sort((a, b) => a.t - b.t);
    const samples = [{ t: 0, p: required(anchors[0]).p.clone() }], arcs = [];
    for (let k = 0; k < anchors.length - 1; k++) {
      const lo = anchors[k], hi = anchors[k + 1];
      let points;
      if (required(lo).t >= .86) {
        points = lineSample(
          (u) => V.Lerp(required(lo).p, required(hi).p, u),
          Math.max(2, Math.ceil(V.Distance(required(lo).p, required(hi).p) / 2.5)),
        );
      } else {
        const leg = ringPath(required(lo), required(hi), required(spec).direction, i);
        arcs.push(
          ...leg.map((a) => ({
            ring: a.ring,
            start: a.start,
            sweep: a.sweep,
            direction: a.direction,
            t0: required(lo).t,
            t1: required(hi).t,
          })),
        );
        points = leg.flatMap((a, j) => j ? a.points.slice(1) : a.points);
      }
      const distances = [0];
      for (let j = 1; j < points.length; j++) {
        distances.push(
          required(distances[j - 1]) + V.Distance(required(points[j - 1]), required(points[j])),
        );
      }
      const length = distances.at(-1);
      for (let j = 1; j < points.length; j++) {
        samples.push({
          t: required(lo).t +
            (required(hi).t - required(lo).t) *
              (length ? required(distances[j]) / length : j / (points.length - 1)),
          p: required(points[j]),
        });
      }
      required(samples[samples.length - 1]).t = required(hi).t;
    }
    const point = (t: number) => {
      t = clamp(t, 0, 1);
      let lo = 0, hi = samples.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (required(samples[mid]).t < t) lo = mid;
        else hi = mid;
      }
      const a = samples[lo], b = samples[hi];
      return V.Lerp(
        required(a).p,
        required(b).p,
        (t - required(a).t) / (required(b).t - required(a).t || 1),
      );
    };
    const id = "color-" + i;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = d[0];
    $("it-colors").appendChild(option);
    return {
      ...routeDefaults(),
      id,
      name: d[0],
      i,
      point,
      namedNodes,
      anchors,
      samples,
      path: samples.map((s) => s.p),
      arcs,
    };
  });
  const ringGuides = B.MeshBuilder.CreateLineSystem("Syndicate ring guides", {
    lines: logoRings.map((_, i) => lineSample((t) => ringPoint(i, t * TAU), 160)),
  }, scene);
  ringGuides.parent = upper;
  ringGuides.color = mix(palette["muted-foreground"], palette.background, .55);
  ringGuides.alpha = .25;
  ringGuides.isPickable = false;
  ringGuides.setEnabled(false);
  function axis(i: number, t: number) {
    if (i < knownRoutes.length) {
      return required(knownRoutes[i]).point(t).subtract(new V(0, 1.15, 0));
    }
    let p = axisBase(i, t);
    for (const n of PRIMARY_STAIRWELL_STATIONS) {
      const s = stationT(n), distance = Math.abs(t - s), width = .012;
      if (distance < width) {
        const u = 1 - distance / width;
        const base = Math.floor(i / modeledHubPlatformCount) * modeledHubPlatformCount;
        p = V.Lerp(p, axisBase(base, s), u * u * (3 - 2 * u));
      }
    }
    return p;
  }
  function buildBatch(face: "upper" | "lower") {
    const positions = [], normals = [], indices = [], colors = [], routeRanges = [];
    const sampleTs = [
      ...new Set([
        ...Array.from({ length: 51 }, (_, i) => i / 50),
        .86,
        ...PRIMARY_STAIRWELL_STATIONS.map(stationT),
      ]),
    ].sort((a, b) => a - b);
    const rings = sampleTs.length - 1, facets = 3, sign = face === "upper" ? 1 : -1;
    for (let i = 0; i < 3123; i++) {
      if (i < knownRoutes.length) continue;
      const start = positions.length / 3;
      for (let j = 0; j <= rings; j++) {
        const t = required(sampleTs[j]), p = axis(i, t).add(new V(0, sign * 1.15, 0));
        const tangent = axis(i, Math.min(1, required(t) + .002)).subtract(
          axis(i, Math.max(0, required(t) - .002)),
        )
          .normalize();
        const side = V.Cross(tangent, V.Up()).normalize(), up = V.Cross(side, tangent).normalize();
        for (let k = 0; k < facets; k++) {
          const a = k / facets * TAU, normal = side.scale(Math.cos(a)).add(up.scale(Math.sin(a)));
          const q = p.add(normal.scale(.085));
          positions.push(q.x, q.y, q.z);
          normals.push(normal.x, normal.y, normal.z);
          colors.push(1, 1, 1, 1);
        }
      }
      for (let j = 0; j < rings; j++) {
        for (let k = 0; k < facets; k++) {
          const a = start + j * facets + k,
            b = start + j * facets + (k + 1) % facets,
            c = a + facets,
            d = b + facets;
          indices.push(a, c, b, b, c, d);
        }
      }
      routeRanges.push(i);
    }
    const mesh = new B.Mesh(face + " complete rail lattice", scene), vd = new B.VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.indices = indices;
    vd.colors = colors;
    vd.applyToMesh(mesh, true);
    const mat = new B.StandardMaterial(face + " inferred line colors", scene);
    mat.disableLighting = true;
    mat.emissiveColor = C.White();
    mat.diffuseColor = C.White();
    mat.backFaceCulling = false;
    mesh.material = mat;
    mesh.parent = bulkRoots[face];
    mesh.metadata = {
      bulk: true,
      face,
      routeRanges,
      trianglesPerRoute: rings * facets * 2,
      verticesPerRoute: (rings + 1) * facets,
    };
    mesh.freezeNormals();
    return mesh;
  }
  const bulkUpper = buildBatch("upper"), bulkLower = buildBatch("lower");
  const hiddenPaths = Array.from(
    { length: 3123 },
    (_, i) =>
      i < knownRoutes.length
        ? required(knownRoutes[i]).path.map((p) => p.subtract(new V(0, 1.15, 0)))
        : lineSample((t) => axis(i, t), 50),
  );
  const hiddenLines = B.MeshBuilder.CreateLineSystem("3123 concealed passages", {
    lines: hiddenPaths,
  }, scene);
  hiddenLines.color = mix(palette.orange, palette["muted-foreground"], .65);
  hiddenLines.alpha = .45;
  hiddenLines.parent = middle;
  hiddenLines.isPickable = false;
  middle.setEnabled(false);
  knownRoutes.forEach((r) => {
    const path = r.path;
    const mesh = tube(r.name + " subway", path, .42, required(railMaterials[r.i]), upper, 8);
    mesh.metadata = { route: r.id };
    r.mesh = mesh;
    routeMeshes.push(mesh);
    const hidden = tube(
      r.name + " hidden passage",
      path.map((p) => p.subtract(new V(0, 1.15, 0))),
      .11,
      hiddenMat,
      middle,
      4,
    );
    hidden.isPickable = false;
    r.hidden = hidden;
    const opposing = tube(
      "unidentified counterpart of " + r.name,
      path.map((p) => p.subtract(new V(0, 2.3, 0))),
      .29,
      oppositeMat,
      lower,
      5,
    );
    opposing.metadata = { route: r.id, counterpart: true };
    r.opposing = opposing;
  });
  function instancedMarkers(
    name: string,
    source: B.Mesh,
    points: B.Vector3[],
    parent: B.TransformNode,
    inverted = false,
  ) {
    const mesh = source.clone(name);
    mesh.isVisible = true;
    mesh.parent = parent;
    mesh.isPickable = false;
    const matrices = new Float32Array(points.length * 16);
    points.forEach((p, i) =>
      B.Matrix.Compose(
        V.One(),
        inverted ? B.Quaternion.RotationAxis(V.Forward(), Math.PI) : B.Quaternion.Identity(),
        p,
      ).copyToArray(matrices, i * 16)
    );
    mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    return mesh;
  }
  function carPrototype(name: string, bodyMaterial: B.Material, length = 1.8) {
    const parts = [
      box(name + " body", length, .58, .7, new V(0, .48, 0), bodyMaterial, null),
      box(name + " roof", length * .94, .12, .76, new V(0, .83, 0), steel, null),
    ];
    for (const side of [-1, 1]) {
      parts.push(
        box(
          name + " windows",
          length * .66,
          .18,
          .012,
          new V(0, .57, side * .357),
          windowMat,
          null,
        ),
      );
      for (const x of [-length * .29, length * .29]) {
        const w = B.MeshBuilder.CreateCylinder(name + " wheel", {
          diameter: .28,
          height: .075,
          tessellation: 6,
        }, scene);
        w.rotation.x = Math.PI / 2;
        w.position = new V(x, .18, side * .31);
        w.material = darkSteel;
        parts.push(w);
      }
    }
    const merged = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    required(merged).name = name;
    required(merged).isVisible = false;
    required(merged).isPickable = false;
    return merged;
  }
  const subwayCar = carPrototype("subway car", steel),
    whiteCar = carPrototype("white monorail car", dismemberMat, 2.7),
    blackPassenger = carPrototype("Nightmare passenger / caboose", darkSteel, 1.9);
  const freightParts = [box("freight floor", 1.9, .2, .8, new V(0, .22, 0), darkSteel, null)];
  for (const z of [-.39, .39]) {
    freightParts.push(box("open freight side", 1.9, .6, .08, new V(0, .54, z), darkSteel, null));
  }
  for (const x of [-.93, .93]) {
    freightParts.push(box("freight end", .07, .6, .8, new V(x, .54, 0), darkSteel, null));
  }
  for (const x of [-.6, .6]) {
    for (const z of [-.32, .32]) {
      const wheel = B.MeshBuilder.CreateCylinder("freight wheel", {
        diameter: .28,
        height: .09,
        tessellation: 6,
      }, scene);
      wheel.rotation.x = Math.PI / 2;
      wheel.position = new V(x, .12, z);
      wheel.material = steel;
      freightParts.push(wheel);
    }
  }
  const nightmareCar = B.Mesh.MergeMeshes(freightParts, true, true, undefined, false, true);
  required(nightmareCar).name = "open-topped Nightmare freight car";
  required(nightmareCar).isVisible = false;
  required(nightmareCar).isPickable = false;
  const locomotiveParts = [
    box("locomotive chassis", 3.1, .3, .9, new V(0, .24, 0), darkSteel, null),
    box("engine cab", .85, 1.1, .95, new V(-1, .9, 0), darkSteel, null),
    box("cab window", .4, .4, .02, new V(-1, 1, .49), windowMat, null),
  ];
  const boiler = B.MeshBuilder.CreateCylinder("steam boiler", {
    diameter: .9,
    height: 1.9,
    tessellation: 10,
  }, scene);
  boiler.rotation.z = Math.PI / 2;
  boiler.position = new V(.28, .84, 0);
  boiler.material = darkSteel;
  locomotiveParts.push(boiler);
  const chimney = B.MeshBuilder.CreateCylinder("steam chimney", {
    diameterTop: .28,
    diameterBottom: .18,
    height: .65,
    tessellation: 8,
  }, scene);
  chimney.position = new V(.8, 1.52, 0);
  chimney.material = darkSteel;
  locomotiveParts.push(chimney);
  const catcher = B.MeshBuilder.CreateCylinder("wedge cowcatcher", {
    diameter: 1.4,
    height: .18,
    tessellation: 3,
  }, scene);
  catcher.position = new V(1.63, .25, 0);
  catcher.rotation.x = Math.PI / 2;
  catcher.material = steel;
  locomotiveParts.push(catcher);
  for (const x of [-.8, -.15, .5]) {
    for (const z of [-.43, .43]) {
      const wheel = B.MeshBuilder.CreateCylinder("driving wheel", {
        diameter: .5,
        height: .1,
        tessellation: 10,
      }, scene);
      wheel.rotation.x = Math.PI / 2;
      wheel.position = new V(x, .2, z);
      wheel.material = steel;
      locomotiveParts.push(wheel);
    }
  }
  const locomotive = B.Mesh.MergeMeshes(locomotiveParts, true, true, undefined, false, true);
  required(locomotive).name = "Nightmare steam locomotive";
  required(locomotive).isVisible = false;
  required(locomotive).isPickable = false;
  const carCopies = [];
  for (const spec of yardSpecs) {
    const i = spec.id;
    for (const sign of [1, -1] as const) {
      const base = yardBase(i).add(new V(0, sign * 1.15, 0)), parent = sign === 1 ? upper : lower;
      const yard = new B.TransformNode(
        "Trainyard " + (sign === 1 ? spec.label : "opposite " + spec.label),
        scene,
      );
      yard.parent = parent;
      yard.position = base;
      yard.rotation.y = -spec.angle - Math.PI / 2;
      if (sign === -1) yard.rotation.z = Math.PI;
      box("yard deck", 20, .8, 12, new V(0, -.75, 0), steel, yard);
      box("three-story substation", 5, 5.6, 5, new V(6, 2.45, 2.1), darkSteel, yard);
      for (let floor = 0; floor < 3; floor++) {
        for (let column = 0; column < 3; column++) {
          box(
            "substation window",
            .03,
            .68,
            .6,
            new V(3.49, .6 + floor * 1.65, .7 + column * 1.3),
            windowMat,
            yard,
          );
        }
      }
      for (let floor = 0; floor < 3; floor++) {
        for (let column = 0; column < 3; column++) {
          box(
            "outer substation window",
            .03,
            .68,
            .6,
            new V(8.51, .6 + floor * 1.65, .7 + column * 1.3),
            windowMat,
            yard,
          );
          for (const z of [-.41, 4.61]) {
            box(
              "substation front / rear window",
              .68,
              .68,
              .03,
              new V(4.7 + column * 1.3, .6 + floor * 1.65, z),
              windowMat,
              yard,
            );
          }
        }
      }
      for (let track = -3; track <= 3; track++) {
        box("yard sleeper", 18, .12, .9, new V(0, -.2, track * 1.5), darkSteel, yard);
        for (const side of [-.28, .28]) {
          box("yard rail", 18, .08, .08, new V(0, -.09, track * 1.5 + side), steel, yard);
        }
        if (track % 2 === 0) {
          for (let k = 0; k < 3; k++) {
            const car = required(subwayCar).createInstance("parked train");
            car.parent = yard;
            car.position = new V(-4 + k * 2.0, 0, track * 1.5);
            carCopies.push(car);
          }
        }
      }
      const portal = torus("yard portal", new V(-8, 1.2, 0), 2, .18, homewardMat, yard);
      portal.rotation.z = Math.PI / 2;
      const staticParts = yard.getChildMeshes().filter((m) => m instanceof B.Mesh);
      const merged = B.Mesh.MergeMeshes(staticParts, true, true, undefined, false, true);
      required(merged).name = "Trainyard " + spec.label + " structure";
      required(merged).parent = parent;
      required(merged).metadata = { yard: i, face: sign };
      const y = { id: i, sign, base, parent, yard, merged: required(merged) };
      yards.push(y);
      if (sign === 1 && i === 3) {
        labels.push({
          text: "Trainyard " + spec.label,
          point: base,
          parent: upper,
          priority: 3,
          kind: "yard",
        });
      }
      yard.getChildMeshes().forEach((m) => m.metadata = { yard: i, face: sign });
    }
  }
  torus("Abyss rim", new V(0, 29, 0), 43, 1.9, abyssMat, abyssRoot);
  torus("opposite Abyss rim", new V(0, -29, 0), 43, 1.9, abyssMat, abyssRoot);
  for (const sign of [1, -1]) {
    const wallPositions = [], wallIndices = [], wallNormals: number[] = [];
    for (let edge = 0; edge < 2; edge++) {
      for (let j = 0; j <= 36; j++) {
        const a = j / 36 * Math.PI, r = sign === 1 ? (edge ? 21.5 : 15.5) : (edge ? 15.5 : 21.5);
        wallPositions.push(Math.cos(a) * r, sign * 13.5 + (edge ? 15.5 : -15.5), Math.sin(a) * r);
      }
    }
    for (let j = 0; j < 36; j++) wallIndices.push(j, j + 37, j + 1, j + 1, j + 37, j + 38);
    B.VertexData.ComputeNormals(wallPositions, wallIndices, wallNormals);
    const wall = new B.Mesh("inferred Abyss section", scene), wallData = new B.VertexData();
    wallData.positions = wallPositions;
    wallData.indices = wallIndices;
    wallData.normals = wallNormals;
    wallData.applyToMesh(wall);
    wall.material = abyssMat;
    wall.parent = abyssRoot;
    wall.metadata = { abyss: true };
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * TAU;
      const portal = torus(
        "engine return portal",
        new V(Math.cos(a) * 23, sign * (10 + hash(k + 51) * 16), Math.sin(a) * 23),
        1.8,
        .2,
        homewardMat,
        abyssRoot,
      );
      portal.rotation.z = Math.PI / 2;
      portal.rotation.y = -a;
      portal.metadata = { landmark: "portals" };
      enginePortals.push(portal);
    }
  }
  for (let i = 0; i < 95; i++) {
    const a = hash(i + 913) * TAU,
      r = hash(i + 217) * 13,
      car = required(subwayCar).createInstance("discarded carriage");
    car.parent = abyssRoot;
    car.position = new V(Math.cos(a) * r, -36 + hash(i + 38) * 8, Math.sin(a) * r);
    car.rotation = new V(hash(i + 31) * Math.PI, hash(i + 3) * TAU, hash(i + 414) * Math.PI);
    car.scaling.setAll(1.5);
    car.isPickable = false;
  }
  for (const spec of MIMIC_SPECS) {
    const sign = spec.face,
      parent = sign === 1 ? upper : lower,
      p = axis(spec.axisIndex, stationT(spec.station)).add(new V(0, sign * 1.15, 0));
    const boss = new B.TransformNode("Station Mimic " + spec.id, scene);
    boss.parent = parent;
    boss.position = p;
    boss.metadata = { mimic: spec.id, station: spec.station };
    box("mimic platform", 9, .9, 5, new V(0, sign * .5, 0), bossMat, boss);
    const head = B.MeshBuilder.CreateSphere(
      "Station Mimic mouth",
      { diameter: 6, segments: 8 },
      scene,
    );
    head.scaling = new V(1, .55, .6);
    head.position.y = sign * 2;
    head.material = bossMat;
    head.parent = boss;
    for (let j = 0; j < 7; j++) {
      const tooth = B.MeshBuilder.CreateCylinder("mimic tooth", {
        diameterTop: sign === 1 ? 0 : .7,
        diameterBottom: sign === 1 ? .7 : 0,
        height: 2,
        tessellation: 3,
      }, scene);
      tooth.position = new V(-3.5 + j * 1.15, sign * 1.5, -2);
      tooth.material = dismemberMat;
      tooth.parent = boss;
    }
    boss.getChildMeshes().forEach((m) => m.metadata = { mimic: spec.id, station: spec.station });
    bosses.push(boss);
  }
  Object.entries(nodes).forEach(([id, n]) => {
    const platform = new B.TransformNode(id + " platform", scene);
    platform.position = n.p;
    platform.parent = upper;
    const deck = box(id + " station", 6, .45, 3.6, new V(0, -.3, 0), steel, platform);
    deck.metadata = { node: id };
    const roof = box(id + " shelter", 4.8, .18, 2.8, new V(0, 1.9, 0), darkSteel, platform);
    roof.metadata = { node: id };
    for (const x of [-2, 2]) {
      for (const z of [-1, 1]) {
        box("station column", .12, 1.9, .12, new V(x, .85, z), steel, platform).metadata = {
          node: id,
        };
      }
    }
    const beacon = B.MeshBuilder.CreateSphere(
      "station beacon",
      { diameter: 1.15, segments: 8 },
      scene,
    );
    beacon.position.y = 2.2;
    beacon.material = n.n === 436 || n.n === 60
      ? homewardMat
      : required(railMaterials[colorDefinitions.findIndex((c) => c[0] === n.lines[0])]);
    beacon.parent = platform;
    beacon.metadata = { node: id };
    platform.metadata = { node: id };
    if (n.n === 60) {
      for (let k = 0; k < 5; k++) {
        box("abandoned employee housing", 3, 5, 3, new V(-8 + k * 4, 2.3, 8), darkSteel, platform)
          .metadata = { node: id };
      }
    }
    if (n.n === 75) {
      box("Downward Dog / security depot", 8, 4, 5, new V(0, 1.7, 7), darkSteel, platform)
        .metadata = { node: id };
      for (let k = 0; k < 10; k++) {
        const gate = torus(
          "repair cart portal",
          new V(-9 + k * 2, 1, 11),
          1.4,
          .12,
          homewardMat,
          platform,
        );
        gate.rotation.x = Math.PI / 2;
        gate.metadata = { node: id };
      }
    }
    stationMeshes.push(platform);
    labels.push({
      text: n.label,
      point: n.p.add(new V(0, 3, 0)),
      parent: upper,
      priority: n.priority,
      node: id,
      kind: "station",
    });
  });
  const namedRoutes: Record<string, Route> = {
    nightmare: {
      ...routeDefaults(),
      id: "nightmare",
      name: "Nightmare Express",
      point: nightmarePoint,
      material: nightmareMat,
      loop: true,
      count: 40,
      spacing: 2.0,
      prototype: required(nightmareCar),
      stops: [["83 · Red / Yellow", 0], ["283 · Purple / Mauve", .125], ["436 · Abyss", .25], [
        "283 · Green / Yellow",
        .375,
      ], ["83 · Tangerine / Plum", .5]],
    },
    dismemberment: {
      ...routeDefaults(),
      id: "dismemberment",
      name: "Dismemberment Limited",
      material: dismemberMat,
      loop: true,
      count: 2,
      spacing: 3,
      prototype: required(whiteCar),
      stops: [["149 · Ochre", 0], ["281 · Mauve", .5]],
      point: (t) => ringPoint(2, t * TAU),
    },
    eviscerator: {
      ...routeDefaults(),
      id: "eviscerator",
      name: "Eviscerator",
      material: evisceratorMat,
      loop: true,
      count: 12,
      spacing: 1.9,
      prototype: required(nightmareCar),
      stops: [["271 · Cobalt", 0]],
      point: (t) => ringPoint(3, t * TAU),
    },
    escape: {
      ...routeDefaults(),
      id: "escape",
      name: "Escape Velocity",
      material: escapeMat,
      loop: false,
      reverse: true,
      count: 12,
      spacing: 1.9,
      prototype: required(subwayCar),
      stops: [["89 · Tangerine", 1], ["24 · Escape Velocity III / stairwell hub", 0]],
      point: (t) => {
        const start = required(knownRoutes[9]).point(stationT(24)),
          r = logoRings[1],
          a = Math.atan2(start.z - required(r).z, start.x - required(r).x);
        return ringPoint(1, a + (.35 - a) * t).add(start.subtract(ringPoint(1, a)).scale(1 - t))
          .add(new V(0, Math.sin(t * Math.PI) * 8, 0));
      },
    },
    homeward: {
      ...routeDefaults(),
      id: "homeward",
      name: "Homeward Bound",
      material: homewardMat,
      loop: false,
      count: 10,
      spacing: 1.9,
      prototype: required(subwayCar),
      stops: [["Trainyard E", 0], ["24 · staff access", .4], [
        `60 · ${HOMEWARD_BOUND_PLATFORM_COUNT} Homeward Bound platforms`,
        1,
      ]],
      point: (t) => {
        return ringPoint(3, Math.PI / 2 - (Math.PI / 2 + Math.PI / 3) * t).add(
          new V(0, 1.15 * (1 - t) + 6 * Math.sin(t * Math.PI), 0),
        );
      },
    },
  };
  function registerTrain(r: Route, makeTrack = false) {
    if (makeTrack) {
      r.mesh = tube(
        r.name + " route",
        lineSample(r.point, 260, r.stops.map((s) => s[1])),
        r.id === "nightmare" ? .64 : .38,
        r.material,
        upper,
        10,
      );
      r.mesh.metadata = { route: r.id };
      routeMeshes.push(r.mesh);
    }
    const samples = r.path.length ? r.path : lineSample(r.point, 500, r.stops.map((s) => s[1])),
      cumulative = [0];
    r.length = 0;
    for (let i = 1; i < samples.length; i++) {
      r.length += V.Distance(required(samples[i - 1]), required(samples[i]));
      cumulative.push(r.length);
    }
    r.distancePoint = (d) => {
      const distance = r.loop ? ((d % r.length) + r.length) % r.length : clamp(d, 0, r.length);
      let lo = 0, hi = samples.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (required(cumulative[mid]) < distance) lo = mid;
        else hi = mid;
      }
      return V.Lerp(
        required(samples[lo]),
        required(samples[hi]),
        (distance - required(cumulative[lo])) /
          (required(cumulative[hi]) - required(cumulative[lo]) || 1),
      );
    };
    const cars = [];
    for (let i = 0; i < r.count; i++) {
      const prototype = r.id === "nightmare"
        ? (i === 0 ? locomotive : i === 1 || i === r.count - 1 ? blackPassenger : r.prototype)
        : r.prototype;
      const car = required(prototype).createInstance(r.name + " carriage " + (i + 1));
      car.parent = r.parent || upper;
      car.metadata = { route: r.id, train: true };
      cars.push(car);
    }
    const motion = trainMotion(r.id);
    const train = { r, cars, base: r.length * motion.startFraction, speed: motion.speed };
    trains.push(train);
    motions.register("train:" + r.id, ({ elapsed }) => poseTrain(train, elapsed));
    // New inferred routes can be created after animation has already run.
    // Pose immediately at the shared clock instead of flashing at the origin.
    poseTrain(train, motions.elapsed);
    return () => {
      motions.remove("train:" + r.id);
      const index = trains.findIndex((candidate) => candidate === train);
      if (index !== -1) {
        train.cars.forEach((car) => car.dispose());
        trains.splice(index, 1);
      }
    };
  }
  Object.values(namedRoutes).forEach((r) => registerTrain(r, true));
  ["escape", "homeward"].forEach((id) => {
    const r = namedRoutes[id];
    required(r).stops.forEach(([text, t]) =>
      labels.push({
        text,
        point: required(r).point(t).add(new V(0, 3, 0)),
        parent: upper,
        priority: 3,
        kind: "service",
        route: id,
        t,
      })
    );
    const t = id === "escape" ? 0 : .4,
      platform = box(
        id + " low station",
        5,
        .3,
        3,
        required(r).point(t).subtract(new V(0, .3, 0)),
        steel,
        upper,
      );
    platform.metadata = { route: id, stop: true, t };
    required(r).lowPlatform = platform;
  });
  knownRoutes.forEach((r) => {
    r.count = 12;
    r.spacing = 1.9;
    r.prototype = required(subwayCar);
    r.loop = false;
    registerTrain(r);
  });
  // Logo view uses the real named-route meshes, never a decorative emblem overlay.
  ([["nightmare", .86], ["dismemberment", .75], ["eviscerator", .25], ["escape", .6], [
    "homeward",
    .28,
  ]] as [string, number][]).forEach(([id, t]) => {
    const r = namedRoutes[id];
    labels.push({
      text: required(r).name,
      point: required(r).point(t).add(new V(0, 4, 0)),
      parent: upper,
      priority: 2,
      kind: "logo",
      route: id,
    });
  });
  // Detailed sectional model: two rails, opposing gravity, and the passage concealed between them.
  const shellPositions = [], shellIndices = [];
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j <= 36; j++) {
      const a = j / 36 * Math.PI;
      shellPositions.push(side ? 17 : -17, Math.cos(a) * 6, Math.sin(a) * 6);
    }
  }
  for (let j = 0; j < 36; j++) shellIndices.push(j, j + 1, j + 37, j + 1, j + 38, j + 37);
  const shell = new B.Mesh("open tunnel shell", scene),
    shellData = new B.VertexData(),
    shellNormals: number[] = [];
  B.VertexData.ComputeNormals(shellPositions, shellIndices, shellNormals);
  shellData.positions = shellPositions;
  shellData.indices = shellIndices;
  shellData.normals = shellNormals;
  shellData.applyToMesh(shell);
  shell.material = abyssMat;
  shell.parent = cutaway;
  const cutawayCars = CUTAWAY_MOTION.cars;
  for (const sign of [1, -1]) {
    box("opposed floor", 33, .3, 7.2, new V(0, sign * 3.15, 0), steel, cutaway);
    for (const z of [-2.4, -1.6, 1.6, 2.4]) {
      box(
        "cutaway rail",
        33,
        .16,
        .13,
        new V(0, sign * 2.9, z),
        required(railMaterials[sign === 1 ? 0 : 8]),
        cutaway,
      );
    }
    for (let x = -15; x <= 15; x += 1.4) {
      for (const z of [-2, 2]) {
        box("sleeper", .2, .13, 1.2, new V(x, sign * 3, z), darkSteel, cutaway);
      }
    }
    cutawayCars.startXs.forEach((startX, i) => {
      const car = required(subwayCar).createInstance("opposed subway carriage");
      car.parent = cutaway;
      car.position = new V(startX, sign * 2.88, sign === 1 ? -2 : 2);
      if (sign === 1) car.rotation.z = Math.PI;
      motions.register(`cutaway:car:${sign}:${i}`, ({ elapsed }) => {
        car.position.x = wrap(
          startX + cutawayCars.span / 2 + elapsed * sign * cutawayCars.speed,
          cutawayCars.span,
        ) - cutawayCars.span / 2;
      });
    });
    box("hidden wall", 33, .22, 6.2, new V(0, sign * 1.0, 0), darkSteel, cutaway);
    box("station passage", 3, .25, 3.4, new V(11, sign * 3.2, 3.7), steel, cutaway);
    const gate = torus("hidden access door", new V(10, sign * 1.9, 3), 2.2, .17, stairMat, cutaway);
    gate.rotation.x = Math.PI / 2;
  }
  box("concealed conveyor", 33, .2, 2.2, new V(0, -.4, 0), hiddenMat, cutaway);
  for (let x = -15; x <= 15; x += 1.2) {
    box("conveyor slat", .2, .1, 2.2, new V(x, -.24, 0), steel, cutaway);
  }
  for (let x = -15; x <= 15; x += 5) {
    const hoop = torus("tunnel rib", new V(x, 0, 0), 11.8, .13, steel, cutaway);
    hoop.rotation.z = Math.PI / 2;
  }
  const sectionLabels: SceneLabel[] = [
    {
      text: "Ordinary face · gravity ↑",
      point: new V(0, 4.6, -4.8),
      parent: cutaway,
      priority: 0,
      kind: "section",
    },
    {
      text: "Hidden passage / conveyor",
      point: new V(0, 0, -4.8),
      parent: cutaway,
      priority: 1,
      kind: "section",
    },
    {
      text: "Inverted face · gravity ↓",
      point: new V(0, -4.6, -4.8),
      parent: cutaway,
      priority: 0,
      kind: "section",
    },
  ];
  const worker = B.MeshBuilder.CreateSphere(
    "conveyor cargo",
    { diameter: .65, segments: 6 },
    scene,
  );
  worker.material = bossMat;
  worker.parent = cutaway;
  const cargoMotion = CUTAWAY_MOTION.cargo;
  worker.position = new V(cargoMotion.startX, .15, 0);
  motions.register("cutaway:cargo", ({ elapsed }) => {
    worker.position.x = wrap(
      cargoMotion.startX + cargoMotion.span / 2 + elapsed * cargoMotion.speed,
      cargoMotion.span,
    ) - cargoMotion.span / 2;
  });
  const markerMaterial = material("selection beacon", () => palette.yellow, { emission: .75 });
  const selectedMarker = torus("selected station", new V(0, 0, 0), 5, .24, markerMaterial, upper);
  selectedMarker.setEnabled(false);
  selectedMarker.isPickable = false;
  const previewStation = B.MeshBuilder.CreateSphere("numbered station", {
    diameter: .8,
    segments: 6,
  }, scene);
  previewStation.material = steel;
  previewStation.isVisible = false;
  function updateNumberedStations(r: Route | null) {
    selectedStationMeshes.forEach((m) => m.dispose());
    selectedStationMeshes = [];
    if (!r || (!r.id.startsWith("color-") && !r.id.startsWith("unmapped-"))) return;
    const parent = r.parent || upper;
    const points = [];
    for (let n = 10; n <= 436; n++) points.push(r.point(stationT(n)));
    const marks = instancedMarkers(
      "all numbered stops on " + r.name,
      previewStation,
      points,
      parent,
    );
    selectedStationMeshes.push(marks);
    for (const n of [...PRIMARY_STAIRWELL_STATIONS, 60, 75, 83, 89, 433, 435, 436]) {
      const p = r.point(stationT(n)),
        special = torus(
          "station " + n,
          p,
          n === 433 ? 2.8 : 1.7,
          .15,
          isPrimaryStairwellStation(n) ? stairMat : n >= 433 ? bossMat : steel,
          parent,
        );
      special.metadata = { number: n, route: r.id };
      selectedStationMeshes.push(special);
    }
  }
  function selectedRoute(): Route | null {
    return knownRoutes.find((r) => r.id === selected) || namedRoutes[selected] ||
      (inferredRoute?.id === selected ? inferredRoute : null);
  }
  function numberedLine() {
    return selected.startsWith("color-") || selected.startsWith("unmapped-");
  }
  function stateDetail() {
    if (currentView === "logo") {
      return "Named train circuits reveal the Syndicate logo from above: overlapping rings of different sizes around the Abyss. Ring arrangement, scale, heights, and unrecorded route portions are reconstructed.";
    }
    if (currentView === "cutaway") {
      return "Paired tunnel faces have opposing gravity. The concealed passage between them carries a conveyor and provides emergency access. Cross-section reconstructed.";
    }
    if (activeObject?.kind === "node") {
      const n = nodes[activeObject.id];
      return required(n).label + " · " + (required(n).n === 75
        ? "repair carts, security, and the Downward Dog"
        : required(n).n === 60
        ? `abandoned employee housing; selector for ${HOMEWARD_BOUND_PLATFORM_COUNT} ` +
          "Homeward Bound platforms"
        : required(n).n === 436
        ? "engine returns by portal; discarded cars fall into the Abyss"
        : "documented station connection") +
        " · position and architecture reconstructed.";
    }
    if (activeObject?.kind === "yard") {
      return objectTitle(activeObject) + " · dispatch tracks, parked cars, and return portal. " +
        (activeObject.face === -1
          ? "This opposing yard’s identity and pairing are inferred."
          : "Architecture and paired location reconstructed.");
    }
    if (activeObject?.kind === "mimic") {
      return objectTitle(activeObject) +
        ` · Terminus 433 · one of ${MIMIC_SPECS.length} city bosses concealing a stairwell that ` +
        "is revealed after the Mimic is removed. This placement and appearance are inferred.";
    }
    if (activeObject?.kind === "landmark" && activeObject.id === "wreckage") {
      return "Discarded carriages below the Abyss · representative wreckage; placement and quantity reconstructed.";
    }
    if (activeObject?.kind === "landmark" && activeObject.id === "portals") {
      return "Engine-return portals · locomotives return through portals while their cars fall into the Abyss. Portal shapes and positions reconstructed.";
    }
    if (activeObject?.kind === "train") {
      return objectTitle(activeObject) +
        " · leading vehicle selected. Use the connected stops to inspect the route; shape and position reconstructed.";
    }
    if (activeObject?.kind === "stop") {
      return objectTitle(activeObject) +
        " · this service access point and its position are reconstructed.";
    }
    if (selectedStation !== null && numberedLine()) {
      const r = selectedRoute(), n = selectedStation;
      const at = required(r).namedNodes.find((k) => k.n === n);
      const role = n === 75
        ? (required(r).name === "Vermillion"
          ? "repair / security station"
          : "repair hub · this line’s platform is unconfirmed")
        : stationCanonRole(n);
      return required(r).name + " " + n + " · " + (at ? at.label.split(" · ")[1] + " · " : "") +
        role +
        (at ? "" : " · position inferred");
    }
    if (selected === "nightmare") {
      return "Nightmare Express · 83 Red/Yellow → 283 Purple/Mauve → 436 Abyss → 283 Green/Yellow → 83 Tangerine/Plum. Figure eight; geometry reconstructed.";
    }
    if (selected === "dismemberment") {
      return "Dismemberment Limited · two-car white monorail; stops on Ochre 149 and Mauve 281. The rest of this loop is inferred.";
    }
    if (selected === "eviscerator") {
      return "Eviscerator · Cobalt 271 is a documented stop. The remaining circuit and appearance are reconstructed.";
    }
    if (selected === "escape") {
      return `Escape Velocity · the station-24 platform is specifically Escape Velocity III, in a ` +
        `${STATION_24_STAIRWELLS}-stairwell / ${STATION_24_PLATFORM_EXITS}-platform hub. ` +
        "Tangerine 89 is a known Escape Velocity connection; assigning both points to this one " +
        "representative path remains inferred.";
    }
    if (selected === "homeward") {
      return `Homeward Bound · station 60 has a selector for ${HOMEWARD_BOUND_PLATFORM_COUNT} ` +
        "Homeward Bound platforms. This E–24–60 path represents one staff service; the complete " +
        "employee network and yard-to-platform assignments are not reconstructed as canon.";
    }
    if (numberedLine()) {
      const r = selectedRoute();
      return required(r).name + " · one-way toward higher station numbers · " +
        (required(r).namedNodes.length
          ? required(r).namedNodes.map((n) => n.label).join("; ")
          : "identity and transfers inferred") +
        " · path follows the ring arcs; unrecorded junctions and alignment are inferred.";
    }
    if (currentView === "yard") {
      return "Trainyard E · paired yard decks, dispatch tracks, parked cars, and return portal. Architecture and its opposing yard are inferred.";
    }
    if (currentView === "abyss") {
      return "Abyss cutaway · discarded carriages below, engine-return portals around the rim, and the Nightmare Express station above. Shape and placements inferred.";
    }
    if (currentView === "known") {
      return "Colored routes follow the Syndicate ring arcs and switch rings at inferred intersections. Faint guides show the loop backbone. Recorded stops are retained; the paths, junctions, and positions are reconstructed.";
    }
    return `Syndicate ring pattern · ${CANONICAL_STAIRWELL_COUNT.toLocaleString()} canonical ` +
      "stairwells. The 6,246 rendered rail faces / 3,123 paired visual tunnels and 24 yard " +
      "decks are fan-density estimates, not a derived canonical network count.";
  }
  function cameraAspectScale() {
    return Math.max(
      1,
      1.3 /
        (canvas.clientWidth * camera.viewport.width /
          (canvas.clientHeight * camera.viewport.height)),
    );
  }
  function setCamera(target: B.Vector3, radius: number, alpha = camera.alpha, beta = camera.beta) {
    radius *= cameraAspectScale();
    if (reducedMotion.matches || ["whole", "top", "logo"].includes(currentView)) {
      camera.setTarget(target);
      camera.radius = radius;
      camera.alpha = alpha;
      camera.beta = beta;
      cameraTween = null;
      requestRender();
      return;
    }
    cameraTween = {
      from: camera.target.clone(),
      to: target.clone(),
      r0: camera.radius,
      r1: radius,
      a0: camera.alpha,
      a1: alpha,
      b0: camera.beta,
      b1: beta,
      start: performance.now(),
    };
    requestRender();
  }
  function fitRoute(r: Route) {
    const pts = r.path.length ? r.path : lineSample(r.point, 80);
    let min = new V(Infinity, Infinity, Infinity), max = new V(-Infinity, -Infinity, -Infinity);
    pts.forEach((p) => {
      min = V.Minimize(min, p);
      max = V.Maximize(max, p);
    });
    const centre = V.Center(min, max).add(
      new V(0, (r.face || 1) * Number(splitControl.value) / 2, 0),
    );
    const ringRoute = r.id.startsWith("color-") || r.id.startsWith("unmapped-");
    setCamera(
      centre,
      Math.max(38, V.Distance(min, max) * 1.05),
      ringRoute ? -Math.PI / 2 : -1.1,
      ringRoute ? .25 : 1.04,
    );
  }
  function applyView(focus = true) {
    const section = currentView === "cutaway";
    globalRoot.setEnabled(!section);
    cutaway.setEnabled(section);
    const showBulk = ["whole", "top"].includes(currentView),
      localYard = currentView === "yard",
      localAbyss = currentView === "abyss",
      logo = currentView === "logo";
    bulkRoots.upper.setEnabled(showBulk);
    bulkRoots.lower.setEnabled(showBulk);
    ringGuides.setEnabled(currentView === "known" && activeObject?.kind !== "mimic");
    middle.setEnabled(!section && !logo && Number(splitControl.value) > 4);
    routeMeshes.forEach((m) =>
      m.setEnabled(
        logo
          ? !!namedRoutes[m.metadata.route]
          : activeObject?.kind === "mimic"
          ? false
          : localYard
          ? m.metadata.route === "homeward"
          : localAbyss
          ? m.metadata.route === "nightmare"
          : selected === "all" || m.metadata.route === selected || showBulk,
      )
    );
    hiddenLines.setEnabled(showBulk);
    knownRoutes.forEach((r) => {
      required(r.opposing).setEnabled(showBulk || selected === r.id);
      required(r.hidden).setEnabled(showBulk || selected === "all" || selected === r.id);
    });
    const yardId = activeObject?.kind === "yard" ? activeObject.id : 3;
    yards.forEach((y) => {
      const visible = showBulk || localYard && y.id === yardId ||
        currentView === "known" && selected === "all" && !activeObject ||
        selected === "homeward" && y.id === 3 && y.sign === 1;
      y.yard.setEnabled(visible);
      y.merged.setEnabled(visible);
    });
    bosses.forEach((b) =>
      b.setEnabled(
        showBulk || localAbyss ||
          activeObject?.kind === "mimic" && activeObject.id === b.metadata?.mimic ||
          currentView === "known" && selected === "all" && !activeObject,
      )
    );
    abyssRoot.setEnabled(
      showBulk || logo || localAbyss ||
        currentView === "known" && ["all", "nightmare"].includes(selected),
    );
    ["escape", "homeward"].forEach((id) =>
      required(required(namedRoutes[id]).lowPlatform).setEnabled(
        !section && (logo || selected === id || showBulk || localYard && id === "homeward"),
      )
    );
    stationMeshes.forEach((p) => {
      const id = p.metadata.node, n = nodes[id], r = selectedRoute();
      p.setEnabled(
        logo
          ? [
            "red83",
            "purple283",
            "abyss436",
            "green283",
            "plum83",
            "ochre149",
            "mauve281",
            "cobalt271",
            "tangerine89",
            "employee60",
          ].includes(id)
          : activeObject?.kind === "mimic"
          ? false
          : localYard
          ? false
          : localAbyss
          ? id === "abyss436"
          : activeObject?.kind === "node" && activeObject.id === id || selected === "all" ||
            showBulk || r?.namedNodes?.includes(required(n)) ||
            selected === "nightmare" &&
              ["red83", "purple283", "abyss436", "green283", "plum83"].includes(id) ||
            selected === "dismemberment" && ["ochre149", "mauve281"].includes(id) ||
            selected === "eviscerator" && id === "cobalt271" ||
            selected === "homeward" && id === "employee60" ||
            selected === "escape" && id === "tangerine89",
      );
    });
    if (inferredRoute) {
      const visible = !section && selected === inferredRoute.id;
      required(inferredRoute.mesh).setEnabled(visible);
      required(inferredRoute.counterpart).setEnabled(visible);
      required(inferredRoute.hidden).setEnabled(visible);
    }
    if (section && focus) setCamera(new V(0, 0, 0), 33, -1.48, 1.5);
    else if (focus && currentView === "yard") {
      setCamera(yardBase(3).add(new V(0, Number(splitControl.value) / 2, 0)), 37, 1.05, 1.04);
    } else if (focus && currentView === "abyss") setCamera(new V(0, 5, 0), 114, -1.1, 1.04);
    else if (focus && selected !== "all" && selectedRoute()) fitRoute(required(selectedRoute()));
    else if (focus) {
      setCamera(
        new V(12, 8, -8),
        365,
        ["top", "known"].includes(currentView) ? -Math.PI / 2 : -1.48,
        currentView === "top" ? .025 : currentView === "known" ? .25 : .66,
      );
    }
    splitControl.disabled = section || logo;
    stationControl.disabled = !numberedLine() || section;
    $("it-station-go").disabled = stationControl.disabled;
    $("it-caption").textContent = logo
      ? "Syndicate logo · interpreted ring arrangement"
      : section
      ? "Reconstructed cross-section · orbit / zoom"
      : currentView === "known"
      ? "Ring arcs · inferred paths and junctions"
      : "Syndicate loop pattern · reconstructed coordinates";
    detail.textContent = stateDetail();
    trains.forEach((t) => poseTrain(t, motions.elapsed));
    requestRender();
  }
  function chooseLine(value: string, focus = true, notify = true) {
    if (value === "all") {
      showOverview(focus, notify);
      return;
    }
    if (value.startsWith("unmapped-") && inferredRoute?.id !== value) {
      if (inferredRoute) {
        runtimeObjects.remove({ kind: "route", id: inferredRoute.id });
        inferredRoute = null;
      }
      const match = value.match(/^unmapped-(\d+)-(-?1)$/);
      if (!match) return;
      const i = Number(match[1]), face: 1 | -1 = Number(match[2]) === 1 ? 1 : -1;
      inferredRoute = {
        ...routeDefaults(),
        id: value,
        name: "Unmapped line " + (i * 2 + (face === 1 ? 1 : 2)),
        i,
        face,
        parent: face === 1 ? upper : lower,
        namedNodes: [],
        point: (t) => axis(i, t).add(new V(0, face * 1.15, 0)),
      };
      inferredRoute.mesh = tube(
        "selected inferred line",
        lineSample(inferredRoute.point, 220),
        .63,
        markerMaterial,
        inferredRoute.parent,
        8,
      );
      inferredRoute.mesh.metadata = { route: value };
      inferredRoute.counterpart = tube(
        "selected inferred counterpart",
        lineSample((t) => axis(i, t).add(new V(0, -face * 1.15, 0)), 220),
        .35,
        oppositeMat,
        face === 1 ? lower : upper,
        6,
      );
      inferredRoute.hidden = tube(
        "selected inferred hidden passage",
        lineSample((t) => axis(i, t), 220),
        .13,
        hiddenMat,
        middle,
        5,
      );
      inferredRoute.hidden.isPickable = false;
      inferredRoute.count = 12;
      inferredRoute.spacing = 1.9;
      inferredRoute.prototype = required(subwayCar);
      inferredRoute.loop = false;
      const disposeTrain = registerTrain(inferredRoute);
      const runtimeRoute = inferredRoute;
      runtimeObjects.add({
        object: { kind: "route", id: runtimeRoute.id },
        dispose() {
          disposeTrain();
          required(runtimeRoute.mesh).dispose();
          required(runtimeRoute.counterpart).dispose();
          required(runtimeRoute.hidden).dispose();
        },
      });
      const old = $("it-unmapped");
      if (old) old.remove();
      const option = document.createElement("option");
      option.id = "it-unmapped";
      option.value = value;
      option.textContent = inferredRoute.name + " (inferred)";
      lineControl.appendChild(option);
    }
    if (inferredRoute) {
      required(inferredRoute.mesh).setEnabled(value === inferredRoute.id);
      required(inferredRoute.counterpart).setEnabled(value === inferredRoute.id);
      required(inferredRoute.hidden).setEnabled(value === inferredRoute.id);
    }
    selected = value;
    lineControl.value = value;
    selectedStation = null;
    selectedMarker.setEnabled(false);
    selectedMarker.scaling.setAll(1);
    updateNumberedStations(selectedRoute());
    currentView = "known";
    viewControl.value = currentView;
    activeObject = { kind: "route", id: value };
    applyView(focus);
    if (notify) announceSelection();
  }
  function inspectStation(n: number, focus = true, notify = true) {
    const r = selectedRoute();
    if (!r || !numberedLine()) return;
    n = Math.round(clamp(Number(n) || 83, 10, 436));
    selectedStation = n;
    stationControl.value = String(n);
    selectedMarker.parent = r.parent || upper;
    selectedMarker.position = r.point(stationT(n));
    selectedMarker.setEnabled(true);
    selectedMarker.scaling.setAll(1);
    activeObject = { kind: "station", route: r.id, n };
    if (focus) {
      setCamera(
        selectedMarker.position.add(new V(0, (r.face || 1) * Number(splitControl.value) / 2, 0)),
        22,
        camera.alpha,
        1.05,
      );
    }
    detail.textContent = stateDetail();
    requestRender();
    if (notify) announceSelection();
  }
  function objectTitle(o: IronObject | null) {
    if (!o || o.kind === "overview") {
      return {
        logo: "Whole Tangle",
        yard: "Whole Tangle",
        abyss: "Whole Tangle",
        cutaway: "Whole Tangle",
        whole: "Whole Tangle",
        known: "Route inspection",
        top: "Overhead",
      }[o?.view || "whole"] || "Whole Tangle";
    }
    if (o.kind === "node") return required(nodes[o.id]).label;
    if (o.kind === "yard") {
      const spec = yardSpec(o.id);
      return o.face === -1
        ? "Opposing yard of " + spec.label + " (inferred)"
        : "Trainyard " + spec.label + (spec.named ? "" : " (inferred)");
    }
    if (o.kind === "mimic") return "Station Mimic " + o.id;
    if (o.kind === "landmark") {
      return {
        logo: "Syndicate logo view",
        abyss: "The Abyss",
        wreckage: "Discarded carriages",
        portals: "Engine-return portals",
        cutaway: "Paired tunnel cutaway",
      }[o.id];
    }
    const routeId = objectRouteId(o);
    const r = routeId
      ? knownRoutes.find((route) => route.id === routeId) || namedRoutes[routeId] ||
        (inferredRoute?.id === routeId ? inferredRoute : null)
      : null;
    return (r?.name || "Unknown line") +
      (o.kind === "station"
        ? " " + o.n
        : o.kind === "stop"
        ? " · " + o.label
        : o.kind === "train" && !namedRoutes[o.id]
        ? " train"
        : "");
  }
  function announceSelection() {
    root.dispatchEvent(
      new CustomEvent("iron:selection", {
        detail: activeObject || { kind: "overview", view: currentView },
      }),
    );
  }
  function markObject(point: B.Vector3, parent: B.TransformNode = upper, scale = 1) {
    selectedMarker.parent = parent;
    selectedMarker.position = point.clone();
    selectedMarker.scaling.setAll(scale);
    selectedMarker.setEnabled(true);
    selectedMarker.computeWorldMatrix(true);
  }
  function objectLocation(o: IronObject): ObjectLocation | null {
    if (o.kind === "node") {
      return {
        point: required(nodes[o.id]).p,
        parent: upper,
        radius: o.id === "security75" ? 38 : 28,
        scale: 1,
      };
    }
    if (o.kind === "yard") {
      const y = yards.find((y) => y.id === o.id && y.sign === o.face);
      return { point: required(y).base, parent: required(y).parent, radius: 42, scale: 3 };
    }
    if (o.kind === "mimic") {
      const b = bosses.find((boss) => boss.metadata?.mimic === o.id);
      return {
        point: required(b).position,
        parent: required(required(b).parent) as B.TransformNode,
        radius: 25,
        scale: 2,
      };
    }
    if (o.kind === "train") {
      const train = trains.find((t) => t.r.id === o.id);
      return {
        point: required(required(train).cars[0]).position,
        parent: required(required(required(train).cars[0]).parent) as B.TransformNode,
        radius: 24,
        scale: 1,
      };
    }
    if (o.kind === "stop") {
      return {
        point: required(namedRoutes[o.route]).point(o.t),
        parent: upper,
        radius: 26,
        scale: 1,
      };
    }
    if (o.kind === "landmark") {
      if (o.id === "logo") {
        return {
          point: new V(12, 8, -8),
          parent: globalRoot,
          radius: 365,
          scale: 0,
          alpha: -Math.PI / 2,
          beta: .025,
        };
      }
      if (o.id === "cutaway") {
        return { point: V.Zero(), parent: cutaway, radius: 33, scale: 0, alpha: -1.48, beta: 1.5 };
      }
      if (o.id === "wreckage") {
        return { point: new V(0, -31, 0), parent: abyssRoot, radius: 45, scale: 2 };
      }
      if (o.id === "portals") {
        return {
          point: required(enginePortals[0]).position,
          parent: abyssRoot,
          radius: 23,
          scale: .6,
        };
      }
      return { point: new V(0, 5, 0), parent: abyssRoot, radius: 114, scale: 0 };
    }
    if (o.kind === "station") {
      const r = selectedRoute();
      return {
        point: required(r).point(stationT(o.n)),
        parent: required(r).parent || upper,
        radius: 22,
        scale: 1,
      };
    }
    return null;
  }
  function focusSelection() {
    if (activeObject?.kind === "route") {
      fitRoute(required(selectedRoute()));
      return;
    }
    const location = activeObject && objectLocation(activeObject);
    if (!location) return;
    const world = location.point.add(location.parent.position);
    setCamera(world, location.radius, location.alpha ?? -1.1, location.beta ?? 1.05);
  }
  function selectObject(o: IronObject | null, focus = true, notify = true) {
    if (!o || o.kind === "overview") {
      showOverview(focus, notify, o?.kind === "overview" ? o.view : "whole");
      return;
    }
    if (o.kind === "route") {
      chooseLine(o.id, focus, notify);
      return;
    }
    if (o.kind === "station") {
      chooseLine(o.route, false, false);
      inspectStation(o.n, focus, notify);
      return;
    }
    if (o.kind === "node") {
      const n = nodes[o.id];
      if (!n) return;
      const route = n.lines.length
        ? required(knownRoutes.find((r) => r.name === n.lines[0])).id
        : o.id === "employee60"
        ? "homeward"
        : "nightmare";
      chooseLine(route, false, false);
      if (numberedLine()) inspectStation(n.n, false, false);
    } else if (o.kind === "train" || o.kind === "stop") {
      const id = objectRouteId(o);
      if (!id || !trains.some((t) => t.r.id === id)) return;
      chooseLine(id, false, false);
    } else {
      selected = "all";
      lineControl.value = "all";
      selectedStation = null;
      updateNumberedStations(null);
      currentView = o.kind === "yard"
        ? "yard"
        : o.kind === "mimic"
        ? "known"
        : o.id === "logo"
        ? "logo"
        : o.id === "cutaway"
        ? "cutaway"
        : "abyss";
      viewControl.value = currentView;
    }
    activeObject = { ...o };
    hoveredObject = null;
    applyView(false);
    const location = objectLocation(o);
    if (location?.scale) markObject(location.point, location.parent, location.scale);
    else selectedMarker.setEnabled(false);
    if (focus) focusSelection();
    detail.textContent = stateDetail();
    requestRender();
    if (notify) announceSelection();
  }
  function showOverview(focus = true, notify = true, view: View = "whole") {
    selected = "all";
    lineControl.value = "all";
    selectedStation = null;
    activeObject = null;
    hoveredObject = null;
    selectedMarker.setEnabled(false);
    updateNumberedStations(null);
    currentView = view;
    viewControl.value = view;
    applyView(focus);
    if (notify) announceSelection();
  }
  function setView(value: string) {
    if (!isView(value)) return;
    if (value === "yard") {
      selectObject({ kind: "yard", id: 3, face: 1 });
      return;
    }
    if (value === "logo" || value === "abyss" || value === "cutaway") {
      selectObject({ kind: "landmark", id: value });
      return;
    }
    if (["whole", "top", "known"].includes(value)) {
      showOverview(true, true, value);
      return;
    }
    currentView = value;
    viewControl.value = value;
    applyView();
    announceSelection();
  }
  function zoom(factor: number) {
    cameraTween = null;
    camera.radius = clamp(
      camera.radius * factor,
      camera.lowerRadiusLimit ?? 8,
      camera.upperRadiusLimit ?? 760,
    );
    requestRender();
  }
  function targetFromMetadata(md: PickMetadata): IronObject | null {
    if (md.node) return { kind: "node", id: md.node };
    if (md.yard !== undefined) {
      return { kind: "yard", id: md.yard, face: Number(md.face ?? 1) === -1 ? -1 : 1 };
    }
    if (md.mimic) return { kind: "mimic", id: md.mimic };
    if (md.landmark || md.abyss) return { kind: "landmark", id: md.landmark || "abyss" };
    if (md.route) {
      return md.number ? { kind: "station", route: md.route, n: md.number } : md.stop
        ? {
          kind: "stop",
          route: md.route,
          t: md.t ?? 0,
          label: md.route === "escape" ? "24 · stairwell" : "24 · staff access",
        }
        : { kind: md.train ? "train" : "route", id: md.route };
    }
    return null;
  }
  function nearbyTarget(x: number, y: number, pointerType = "mouse") {
    const box = labelTargets.find((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h);
    if (box) return box.object;
    const radius = pointerType === "touch" ? 22 : 14;
    const near = screenTargets.map((t) => ({ ...t, d: Math.hypot(t.x - x, t.y - y) })).filter((t) =>
      t.d < radius
    ).sort((a, b) => a.d - b.d);
    return near[0]?.object || null;
  }
  function worldTargets() {
    const targets: { object: IronObject; point: B.Vector3; parent: B.TransformNode }[] =
      stationMeshes.filter((p) => p.isEnabled()).map((p) => ({
        object: { kind: "node", id: p.metadata.node },
        point: required(nodes[p.metadata.node]).p,
        parent: upper,
      }));
    yards.filter((y) => y.merged.isEnabled()).forEach((y) =>
      targets.push({
        object: { kind: "yard", id: y.id, face: y.sign },
        point: y.base,
        parent: y.parent,
      })
    );
    bosses.filter((b) => b.isEnabled()).forEach((b) =>
      targets.push({
        object: { kind: "mimic", id: Number(b.metadata?.mimic) },
        point: b.position,
        parent: required(b.parent) as B.TransformNode,
      })
    );
    trains.filter((t) => namedRoutes[t.r.id] && required(t.cars[0]).isEnabled()).forEach((t) =>
      targets.push({
        object: { kind: "train", id: t.r.id },
        point: required(t.cars[0]).position,
        parent: upper,
      })
    );
    ["escape", "homeward"].filter((id) =>
      required(required(namedRoutes[id]).lowPlatform).isEnabled()
    ).forEach((id) => {
      const t = id === "escape" ? 0 : .4;
      targets.push({
        object: {
          kind: "stop",
          route: id,
          t,
          label: id === "escape" ? "24 · stairwell" : "24 · staff access",
        },
        point: required(namedRoutes[id]).point(t),
        parent: upper,
      });
    });
    if (abyssRoot.isEnabled()) {
      targets.push({
        object: { kind: "landmark", id: "abyss" },
        point: new V(0, 29, 0),
        parent: abyssRoot,
      });
      targets.push({
        object: { kind: "landmark", id: "wreckage" },
        point: new V(0, -31, 0),
        parent: abyssRoot,
      });
      targets.push({
        object: { kind: "landmark", id: "portals" },
        point: required(enginePortals[0]).position,
        parent: abyssRoot,
      });
    }
    return targets;
  }
  function poseTrain(train: Train, t: number) {
    const r = train.r,
      rawHead = train.base + (r.reverse ? -1 : 1) * t * train.speed,
      head = r.loop
        ? rawHead
        : ((rawHead % (r.length + r.count * r.spacing)) + r.length + r.count * r.spacing) %
          (r.length + r.count * r.spacing);
    train.cars.forEach((car, i) => {
      const d = head - i * r.spacing * (r.reverse ? -1 : 1),
        p = r.distancePoint(d),
        q = r.distancePoint(d + .2 * (r.reverse ? -1 : 1));
      car.position = p.add(new V(0, .52, 0));
      const tangent = q.subtract(p);
      if (tangent.lengthSquared() > .00001) {
        car.rotationQuaternion = B.Quaternion.FromLookDirectionLH(
          V.Cross(tangent.normalize(), V.Up()).normalize(),
          V.Up(),
        );
      }
      const visible = currentView === "logo"
        ? !!namedRoutes[r.id]
        : activeObject?.kind === "mimic"
        ? false
        : currentView === "abyss"
        ? r.id === "nightmare"
        : currentView === "yard"
        ? r.id === "homeward"
        : selected === "all" || r.id === selected || currentView === "whole" ||
          currentView === "top";
      car.setEnabled((r.loop || d >= 0 && d <= r.length) && visible);
    });
  }
  function updateTheme() {
    refreshMaterials();
    [bulkUpper, bulkLower].forEach((mesh) => {
      const md: BulkMetadata = mesh.metadata,
        colors = new Float32Array(md.routeRanges.length * md.verticesPerRoute * 4);
      md.routeRanges.forEach((i, k) => {
        const c = mix(
          mix(
            routeColor(Math.floor(hash(i + (md.face === "upper" ? 68 : 109)) * 23)),
            palette["muted-foreground"],
            .35,
          ),
          palette.background,
          .16,
        );
        for (let j = 0; j < md.verticesPerRoute; j++) {
          const n = (k * md.verticesPerRoute + j) * 4;
          colors[n] = c.r;
          colors[n + 1] = c.g;
          colors[n + 2] = c.b;
          colors[n + 3] = 1;
        }
      });
      mesh.updateVerticesData(B.VertexBuffer.ColorKind, colors, false, false);
    });
    hiddenLines.color = mix(palette.orange, palette["muted-foreground"], .65);
    ringGuides.color = mix(palette["muted-foreground"], palette.background, .55);
    hemi.groundColor = palette.background;
    requestRender();
  }
  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateTheme);
  viewControl.addEventListener("change", () => setView(viewControl.value));
  lineControl.addEventListener("change", () => chooseLine(lineControl.value));
  $("it-station-form").addEventListener("submit", (event) => {
    event.preventDefault();
    inspectStation(Number(stationControl.value));
  });
  splitControl.addEventListener("input", () => {
    const value = Number(splitControl.value);
    $("it-split-value").textContent = String(value);
    upper.position.y = value / 2;
    lower.position.y = -value / 2;
    middle.setEnabled(value > 4 && currentView !== "cutaway");
    detail.textContent = stateDetail();
    if (activeObject) focusSelection();
    requestRender();
  });
  playControl.addEventListener("click", () => {
    playing = !playing;
    playControl.textContent = playing ? "Pause trains" : "Run trains";
    playControl.setAttribute("aria-pressed", String(playing));
  });
  scene.onPointerObservable.add((info) => {
    if (info.type === B.PointerEventTypes.POINTERDOWN) {
      cameraTween = null;
      requestRender();
    }
    if (info.type === B.PointerEventTypes.POINTERMOVE) requestRender();
    if (info.type !== B.PointerEventTypes.POINTERTAP) return;
    const rect = canvas.getBoundingClientRect(),
      near = nearbyTarget(
        info.event.clientX - rect.left,
        info.event.clientY - rect.top,
        "pointerType" in info.event ? String(info.event.pointerType) : "mouse",
      );
    if (near) {
      selectObject(near);
      return;
    }
    if (!info.pickInfo?.hit) return;
    const mesh = info.pickInfo.pickedMesh;
    if (!mesh) return;
    const md: PickMetadata = mesh.metadata || {};
    const object = targetFromMetadata(md);
    if (object) {
      selectObject(object);
      if (md.counterpart) {
        detail.textContent = "Opposite face of " + required(selectedRoute()).name +
          " · its color and identity are unconfirmed; pairing and alignment are reconstructed.";
      }
      return;
    }
    if (md.bulk) {
      const k = Math.floor(info.pickInfo.faceId / required(md.trianglesPerRoute)),
        i = required(md.routeRanges)[k];
      if (Number.isFinite(i)) chooseLine("unmapped-" + i + "-" + (md.face === "upper" ? 1 : -1));
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect(),
      object = nearbyTarget(event.clientX - rect.left, event.clientY - rect.top, event.pointerType);
    if (JSON.stringify(object) !== JSON.stringify(hoveredObject)) {
      hoveredObject = object;
      canvas.classList.toggle("cursor-interaction", !!object);
      requestRender();
    }
  });
  canvas.addEventListener("pointerleave", () => {
    hoveredObject = null;
    canvas.classList.remove("cursor-interaction");
    requestRender();
  });
  let previousAspectScale = 1,
    sceneRect = { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight };
  function resize() {
    engine.resize();
    const rect = canvas.getBoundingClientRect(),
      dpr = Math.min(globalThis.devicePixelRatio || 1, 2),
      small = ui.mobile.matches;
    const browser = $("it-browser"),
      viewbar = root.querySelector(".it-viewbar"),
      inspector = $("it-selection");
    const gutter = parseFloat(getComputedStyle(root).getPropertyValue("--gutter")) || 14;
    let left = gutter, right = rect.width - gutter;
    const top = Math.max(
      query(".it-topbar", root).getBoundingClientRect().bottom,
      required(viewbar).getBoundingClientRect().bottom,
    ) + 14 - rect.top;
    let bottom = query(".it-statusbar", root).getBoundingClientRect().top - rect.top - 18;
    if (!small && !browser.hidden) left = browser.getBoundingClientRect().right - rect.left + 18;
    if (!inspector.hidden && !inspector.inert) {
      const selectionRect = inspector.getBoundingClientRect();
      // Keep a focused object above a phone's details sheet or a narrow desktop's inspector.
      if (small && rect.height < 560 && rect.width > 600) {
        right = Math.min(right, selectionRect.left - rect.left - 18);
      } else if (small || selectionRect.left - rect.left < left + (right - left) * .56) {
        bottom = Math.min(bottom, selectionRect.top - rect.top - 18);
      }
    }
    const width = Math.max(80, right - left), height = Math.max(80, bottom - top);
    sceneRect = { x: left, y: top, width, height };
    camera.viewport = new B.Viewport(
      left / rect.width,
      (rect.height - top - height) / rect.height,
      width / rect.width,
      height / rect.height,
    );
    const scale = cameraAspectScale();
    camera.upperRadiusLimit = 760 * scale;
    camera.maxZ = Math.max(1600, camera.upperRadiusLimit + 450);
    const ratio = scale / previousAspectScale;
    camera.radius *= ratio;
    if (cameraTween) {
      cameraTween.r0 *= ratio;
      cameraTween.r1 *= ratio;
    }
    previousAspectScale = scale;
    overlay.width = Math.round(rect.width * dpr);
    overlay.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();
  root.addEventListener("iron:layout", resize);
  function drawLabels() {
    const w = overlay.clientWidth, h = overlay.clientHeight;
    ctx.clearRect(0, 0, w, h);
    screenTargets = [];
    labelTargets = [];
    const font = getComputedStyle($("it-font-probe"));
    ctx.font = font.fontWeight + " " + font.fontSize + " " + font.fontFamily;
    ctx.textBaseline = "middle";
    const candidates = currentView === "cutaway" ? sectionLabels : labels.filter((l) => {
      if (currentView === "logo") return l.kind === "logo" || l.node === "abyss436";
      if (l.kind === "logo") return false;
      if (currentView === "yard") return l.kind === "yard";
      if (currentView === "abyss") return l.node === "abyss436";
      if (l.kind === "service") return l.route === selected;
      if (l.kind === "yard" && selected === "homeward") return true;
      if (selected === "all") return l.priority <= 3;
      const r = selectedRoute();
      return l.node === "abyss436" && selected === "nightmare" || r?.namedNodes?.some((n) =>
        n === nodes[l.node || ""]
      ) ||
        selected === "nightmare" &&
          ["red83", "purple283", "green283", "plum83"].includes(l.node || "") ||
        selected === "dismemberment" && ["ochre149", "mauve281"].includes(l.node || "") ||
        selected === "eviscerator" && l.node === "cobalt271";
    }).sort((a, b) => a.priority - b.priority);
    const matrix = scene.getTransformMatrix(),
      viewport = new B.Viewport(sceneRect.x, sceneRect.y, sceneRect.width, sceneRect.height),
      boxes: { x: number; y: number; w: number; h: number }[] = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(sceneRect.x, sceneRect.y, sceneRect.width, sceneRect.height);
    ctx.clip();
    worldTargets().forEach((t) => {
      const p = V.Project(
        t.point.add(t.parent.position).add(new V(0, t.object.kind === "node" ? 2.3 : 1, 0)),
        B.Matrix.Identity(),
        matrix,
        viewport,
      );
      if (
        p.z < 0 || p.z > 1 || p.x < sceneRect.x + 8 || p.x > sceneRect.x + sceneRect.width - 8 ||
        p.y < sceneRect.y + 8 || p.y > sceneRect.y + sceneRect.height - 8
      ) return;
      screenTargets.push({ x: p.x, y: p.y, object: t.object });
      const emphasized = JSON.stringify(t.object) === JSON.stringify(hoveredObject) ||
        JSON.stringify(t.object) === JSON.stringify(activeObject);
      ctx.fillStyle = (emphasized ? palette.yellow : palette.foreground).toHexString();
      ctx.globalAlpha = emphasized ? 1 : .7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, emphasized ? 5 : 3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    const emphasized = hoveredObject || activeObject;
    const emphasisTarget = emphasized &&
      screenTargets.find((t) => JSON.stringify(t.object) === JSON.stringify(emphasized));
    if (emphasisTarget) {
      const text = objectTitle(emphasized),
        width = Math.min(sceneRect.width - 16, ctx.measureText(text).width + 12),
        x = clamp(
          emphasisTarget.x - width / 2,
          sceneRect.x + 8,
          sceneRect.x + sceneRect.width - width - 8,
        ),
        y = clamp(emphasisTarget.y - 35, sceneRect.y + 4, sceneRect.y + sceneRect.height - 28);
      ctx.fillStyle = palette.background.toHexString();
      ctx.globalAlpha = .94;
      ctx.fillRect(x, y, width, 24);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.foreground.toHexString();
      ctx.fillText(text, x + 6, y + 12, w - 28);
      boxes.push({ x, y, w: width, h: 24 });
      labelTargets.push({ x, y, w: width, h: 24, object: emphasized });
    }
    candidates.forEach((l) => {
      const world = l.point.add(l.parent.position),
        p = V.Project(world, B.Matrix.Identity(), matrix, viewport);
      if (
        p.z < 0 || p.z > 1 || p.x < sceneRect.x || p.x > sceneRect.x + sceneRect.width ||
        p.y < sceneRect.y || p.y > sceneRect.y + sceneRect.height
      ) return;
      const width = Math.min(sceneRect.width - 8, ctx.measureText(l.text).width + 8),
        x = clamp(p.x - width / 2, sceneRect.x + 4, sceneRect.x + sceneRect.width - width - 4),
        y = p.y - 17;
      if (y < sceneRect.y + 10 || y > sceneRect.y + sceneRect.height - 12) return;
      const rect = { x, y: y - 8, w: width, h: 18 };
      if (
        boxes.some((b) =>
          rect.x < b.x + b.w + 4 && rect.x + rect.w + 4 > b.x && rect.y < b.y + b.h + 3 &&
          rect.y + rect.h + 3 > b.y
        )
      ) return;
      boxes.push(rect);
      ctx.fillStyle = palette.background.toHexString();
      ctx.globalAlpha = .86;
      ctx.fillRect(x, y - 8, width, 18);
      ctx.globalAlpha = 1;
      const object: IronObject | null = l.node
        ? { kind: "node", id: l.node }
        : l.kind === "logo"
        ? { kind: "route", id: required(l.route) }
        : l.route
        ? { kind: "stop", route: l.route, t: l.t ?? 0, label: l.text }
        : l.kind === "yard"
        ? { kind: "yard", id: 3, face: 1 }
        : null;
      if (object) labelTargets.push({ ...rect, object });
      ctx.fillStyle = palette.foreground.toHexString();
      ctx.fillText(l.text, x + 4, y + 1, width - 8);
      ctx.strokeStyle = palette["muted-foreground"].toHexString();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 2);
      ctx.lineTo(clamp(p.x, x, x + width), y + 10);
      ctx.stroke();
    });
    if (selectedStation !== null && numberedLine() && activeObject?.kind !== "node") {
      const p = V.Project(
          selectedMarker.position.add(
            (required(selectedMarker.parent) as B.TransformNode).position,
          ),
          B.Matrix.Identity(),
          matrix,
          viewport,
        ),
        text = required(selectedRoute()).name + " " + selectedStation;
      const width = Math.min(sceneRect.width - 8, ctx.measureText(text).width + 10);
      if (
        p.z >= 0 && p.z <= 1 && p.x >= sceneRect.x && p.x <= sceneRect.x + sceneRect.width &&
        p.y >= sceneRect.y && p.y <= sceneRect.y + sceneRect.height
      ) {
        const x = clamp(
            p.x - width / 2,
            sceneRect.x + 4,
            sceneRect.x + sceneRect.width - width - 4,
          ),
          y = clamp(p.y - 32, sceneRect.y + 3, sceneRect.y + sceneRect.height - 25);
        ctx.fillStyle = palette.background.toHexString();
        ctx.fillRect(x, y, width, 22);
        ctx.fillStyle = palette.foreground.toHexString();
        ctx.fillText(text, x + 5, y + 11, width - 10);
        labelTargets.push({ x, y, w: width, h: 22, object: required(activeObject) });
      }
    }
    ctx.restore();
  }
  routeMeshes.forEach((m) => glow.addIncludedOnlyMesh(m));
  glow.addIncludedOnlyMesh(selectedMarker);
  updateTheme();
  applyView(false);
  camera.setTarget(new V(12, 8, -8));
  camera.radius = 365 * cameraAspectScale();
  camera.alpha = -1.48;
  camera.beta = .66;
  requestRender();
  const model = {
    engine,
    scene,
    camera,
    knownRoutes,
    namedRoutes,
    nodes,
    upper,
    lower,
    cutaway,
    chooseLine,
    inspectStation,
    selectObject,
    focusSelection,
    showOverview,
    zoom,
    objectTitle,
    get screenTargets() {
      return screenTargets;
    },
    logoRings,
    geometry: { axis, axisBase, yardBase, ringPoint, stationT, ringJunctions },
    stats: {
      coloredLines: 6246,
      pairedTunnels: 3123,
      hiddenPassages: 3123,
      modeledYardDecks: yards.length,
      stairChambers: 3470,
      stationMimics: bosses.length,
      documentedColors: 23,
      nightmareCars: 40,
    },
    get palette() {
      return palette;
    },
    routeColor,
    get runtimeObjects() {
      return Array.from(runtimeObjects.values(), (runtime) => ({ ...runtime.object }));
    },
    requestRender,
    updateTheme,
    get state() {
      return {
        selected,
        currentView,
        selectedStation,
        playing,
        split: Number(splitControl.value),
        object: activeObject || { kind: "overview" as const, view: currentView },
      };
    },
  };
  scene.executeWhenReady(() => {
    ready = true;
    $("it-loading").hidden = true;
    root.dataset.ready = "true";
    requestRender();
  });
  ["wheel", "keydown", "pointerdown", "pointermove", "pointerup"].forEach((event) =>
    canvas.addEventListener(event, requestRender, { passive: true })
  );
  engine.runRenderLoop(() => {
    if (document.hidden) return;
    const now = performance.now(), dt = Math.min((now - lastTime) / 1000, .1);
    lastTime = now;
    const cameraMoved = !!cameraTween;
    if (cameraTween) {
      const u = clamp((now - cameraTween.start) / 550, 0, 1), e = u * u * (3 - 2 * u);
      camera.setTarget(V.Lerp(cameraTween.from, cameraTween.to, e));
      camera.radius = cameraTween.r0 + (cameraTween.r1 - cameraTween.r0) * e;
      camera.alpha = cameraTween.a0 + (cameraTween.a1 - cameraTween.a0) * e;
      camera.beta = cameraTween.b0 + (cameraTween.b1 - cameraTween.b0) * e;
      if (u === 1) cameraTween = null;
    }
    if (playing) {
      motions.update(dt);
    }
    if (playing && activeObject?.kind === "train") {
      const location = objectLocation(activeObject);
      selectedMarker.position = required(location).point.clone();
    }
    const inertia = Math.abs(camera.inertialAlphaOffset) + Math.abs(camera.inertialBetaOffset) +
        Math.abs(camera.inertialRadiusOffset) + Math.abs(camera.inertialPanningX) +
        Math.abs(camera.inertialPanningY) > .0001;
    if (needsRender > 0 || playing || cameraMoved || inertia) {
      scene.render();
      if (ready) drawLabels();
      needsRender = Math.max(0, needsRender - 1);
    }
  });
  root.__ironModel = model;
  return model;
}
export type Model = NonNullable<ReturnType<typeof createModel>>;
