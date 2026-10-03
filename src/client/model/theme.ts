import * as B from "@babylonjs/core";
import { context2D, element, required } from "../dom.ts";
import { mix } from "./math.ts";

type PaletteKey =
  | "background"
  | "foreground"
  | "muted-foreground"
  | "border"
  | "blue"
  | "orange"
  | "green"
  | "red"
  | "purple"
  | "yellow";

export const COLOR_DEFINITIONS: [string, PaletteKey, PaletteKey?, number?][] = [
  ["Red", "red"],
  ["Orange", "orange"],
  ["Yellow", "yellow"],
  ["Indigo", "blue", "purple", .55],
  ["Azure", "blue"],
  ["Purple", "purple"],
  ["Brown", "orange", "muted-foreground", .6],
  ["Mauve", "purple", "red", .28],
  ["Green", "green"],
  ["Tangerine", "orange", "yellow", .25],
  ["Plum", "purple", "red", .42],
  ["Winter Sky", "blue", "background", .38],
  ["Ochre", "yellow", "orange", .55],
  ["Fulvous", "orange", "yellow", .45],
  ["Camel", "orange", "muted-foreground", .4],
  ["Cobalt", "blue", "purple", .2],
  ["Puce", "red", "purple", .45],
  ["Vermillion", "red", "orange", .4],
  ["Mango", "orange", "yellow", .65],
  ["Sinopia", "red", "orange", .7],
  ["Mindaro", "yellow", "green", .22],
  ["Grullo", "muted-foreground", "orange", .2],
  ["Zomp", "green", "blue", .35],

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
    const d = required(COLOR_DEFINITIONS[index % COLOR_DEFINITIONS.length]);
    return d[2] ? mix(palette[d[1]], palette[required(d[2])], d[3] ?? 0) : palette[d[1]].clone();
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
    colorDefinitions: COLOR_DEFINITIONS,
    routeColor,
    darkTone,
    material,
    refreshMaterials,
  };
}
