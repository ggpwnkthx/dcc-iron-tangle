import * as B from "@babylonjs/core";
import { context2D, element, required } from "../dom.ts";
import { LINE_SPECS, type PaletteKey } from "../scene_specs.ts";
import { mix } from "./math.ts";

interface MaterialEntry {
  m: B.StandardMaterial;
  colorFunction: () => B.Color3;
  emission: number;
  metal: boolean;
}

export function createTheme(scene: B.Scene) {
  const $ = element;
  const C = B.Color3;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = 1;
  const colorContext = context2D(colorCanvas);
  const palette: Record<PaletteKey, B.Color3> = {
    "background": C.Black(),
    "foreground": C.Black(),
    "muted-foreground": C.Black(),
    "border": C.Black(),
    "blue": C.Black(),
    "orange": C.Black(),
    "green": C.Black(),
    "red": C.Black(),
    "purple": C.Black(),
    "yellow": C.Black(),
  };
  const materials: MaterialEntry[] = [];
  const ordered = [...LINE_SPECS].sort((a, b) => a.axisIndex - b.axisIndex);
  const byAxis = new Map(ordered.map((spec) => [spec.axisIndex, spec]));

  function token(name: string) {
    $("it-color-probe").style.color = "var(" + name + ")";
    const css = getComputedStyle($("it-color-probe")).color;
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = css;
    colorContext.fillRect(0, 0, 1, 1);
    const p = colorContext.getImageData(0, 0, 1, 1).data;
    return new B.Color3(required(p[0]) / 255, required(p[1]) / 255, required(p[2]) / 255);
  }

  function readPalette() {
    ([
      "background",
      "foreground",
      "muted-foreground",
      "border",
      "blue",
      "orange",
      "green",
      "red",
      "purple",
      "yellow",
    ] as const).forEach((n) => palette[n] = token("--" + n));
  }

  function routeColor(index: number) {
    const d = required(byAxis.get(index) ?? ordered[index % ordered.length])
      .color;
    return d[1] ? mix(palette[d[0]], palette[d[1]], d[2] ?? 0) : palette[d[0]].clone();
  }

  function darkTone() {
    return palette.foreground.r + palette.foreground.g + palette.foreground.b <
        palette.background.r + palette.background.g + palette.background.b
      ? palette.foreground
      : palette.background;
  }

  function material(
    name: string,
    colorFunction: () => B.Color3,
    { emission = .15, alpha = 1, metal = false } = {},
  ) {
    const m = new B.StandardMaterial(name, scene);
    m.backFaceCulling = false;
    m.alpha = alpha;
    m.specularColor = metal ? palette.foreground.scale(.35) : palette.foreground.scale(.06);
    materials.push({ m, colorFunction, emission, metal });
    const c = colorFunction();
    m.diffuseColor = c;
    m.emissiveColor = c.scale(emission);
    return m;
  }

  function refreshMaterials() {
    readPalette();
    materials.forEach(({ m, colorFunction, emission, metal }) => {
      const c = colorFunction();
      m.diffuseColor = c;
      m.emissiveColor = c.scale(emission);
      m.specularColor = palette.foreground.scale(metal ? .35 : .06);
    });
  }

  readPalette();
  return {
    palette,
    lineSpecs: LINE_SPECS,
    routeColor,
    darkTone,
    material,
    refreshMaterials,
  };
}
