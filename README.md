# Floor 4: The Iron Tangle

An interactive Babylon.js fan reconstruction of the Iron Tangle from **Dungeon Crawler Carl**,
created by Matt Dinniman. Contains spoilers for Floor 4.

## Run with Deno

Requires **Deno 2.9 or newer** and a modern WebGL browser. See the
[official installation guide](https://docs.deno.com/runtime/getting_started/installation/).

Extract the ZIP and start development:

```sh
cd iron-tangle
deno task dev
```

Open **http://127.0.0.1:8000/**. Development mode first builds the browser app into the ignored
`dist/` directory, then runs Deno's bundler in watch mode alongside the local server. TypeScript
edits rebuild `dist/assets/app.js`; HTML and CSS edits under `src/site/` are mirrored into `dist/`.
Server edits restart the listener. Refresh the browser after frontend changes. Use
`deno task dev --port 8080` to change the port. Ctrl+C stops both development processes.

For a release build and server:

```sh
deno task build
deno task start
```

`deno task build` recreates `dist/` from the authored files in `src/site/` and the TypeScript
client. `deno task start` serves that existing build without rebuilding it. You can also open
`dist/index.html` directly for the standalone browser version. Saved objects and themes are stored
per browser origin; HTTP and file origins have separate storage.

### TypeScript and packages

All application logic is genuine TypeScript under `src/client/`: typed scene construction,
discriminated selection objects, routes, trains, DOM access, navigation, storage validation, and UI
controls. There are no handwritten application JavaScript files in `dist/`; `app.js` is generated.
HTML and CSS remain authored in their native formats under `src/site/`.

### Scene authoring

Frequently edited scene definitions live in `src/client/scene_specs.ts`: colored lines, named
stations, train services and stops, yards, Mimics, landmarks, ring geometry, and motion settings.
`src/client/object_definitions.ts` derives discovery entries, service connections, and validation
registries from those definitions. Authored IDs and references are checked for duplicates and
dangling connections before scene construction.

Colored lines have permanent IDs such as `line:red` and `line:tangerine`. Their `axisIndex` is a
separate, stable layout slot; changing display order does not change identities or geometry.
Existing `color-N` bookmarks migrate through the fixed `LEGACY_LINE_IDS` map and are rewritten to
permanent IDs. Never renumber that map or reuse a deleted ID for different content. Geometry and
palette lookup use layout slots instead of array positions.

To add or change content, edit the relevant specs and refresh after rebuilding with `deno task dev`
or `deno task build`. Services define their geometry recipe and connected stops together. Station
positions use ring or Nightmare-path recipes. Babylon mesh construction stays in `model.ts` and
`model/meshes.ts`; custom appearances can still require renderer changes. Removing a definition also
requires updating any definitions that refer to it.

Runtime resources use `RuntimeObjectRegistry` and idempotent `ResourceScope` owners in
`src/client/runtime_objects.ts`. Authored route tracks, trains, stations, yards, Mimics, landmark
groups, and service platforms register owned handles. Shared materials, prototypes, and the batched
background network belong to the scene. The background rails remain batched rather than allocating a
logical runtime handle for every rail.

A moving handle prepares its meshes before activation and acquires its motion ID in `activate()`.
`registry.replace(object, prepare)` builds the replacement while the old object is still live,
releases the old owner, then activates the new owner. A preparation failure leaves the old object
intact. An activation failure disposes the replacement and reports removal; it does not pretend to
restore an already-disposed object. Resource cleanup runs in reverse order and continues after
individual errors.

Selecting another unmapped line releases the previous temporary expansion and its train together.
That release preserves the logical line and its bookmarks. `model.rebuildInferredRoute()` exercises
same-identity replacement; `model.dispose()` stops rendering, releases owned resources, and detaches
model/navigation listeners and observers. The render loop advances one shared clock through
`src/client/motion.ts`.

Permanent definition changes and runtime resource changes are separate events. Navigation responds
to `iron:objects-changed` by refreshing temporary discovery entries. After an integration changes
authored definitions and their scene resources, `iron:definitions-changed` reconciles saved objects,
recent selections, history, the current selection, and connection shortcuts. Source edits take
effect on reload; this is an authoring API foundation, not an in-browser scene editor.

The renderer keeps scene construction, selection, camera, and render-loop orchestration in
`model.ts`. Reusable numerical helpers, Babylon primitive builders, palette/material lifecycle, and
inferred ring/station geometry live under `src/client/model/`.

Babylon uses its typed ES module package, resolved by Deno's import map:

```json
{
  "imports": {
    "@babylonjs/core": "npm:@babylonjs/core@9.29.0"
  }
}
```

The renderer imports it with `import * as B from "@babylonjs/core"`. There is no `window.BABYLON`,
CDN script, vendored UMD bundle, `package.json`, npm command, or Node.js application API.
`deno.lock` pins the package's integrity. Deno caches dependencies itself; `node_modules` is
disabled. Babylon publishes this package on npm, so Deno's native `npm:` specifier is used.

`deno bundle --platform=browser` compiles and bundles the source and package into browser
JavaScript. The build uses IIFE output, retaining direct `file://` support. First-time dependency
resolution and the bundler's platform binary need internet access; later builds/checks can use
Deno's cache. The browser uses only local assets and does not fetch packages at runtime.

### Tasks

| Command                 | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `deno task dev`         | Initial build, watched browser rebuilds, and watched local server       |
| `deno task build`       | Recreate `dist/`, copy site assets, and build the minified browser app  |
| `deno task build:watch` | Watch and rebuild browser TypeScript with type checking                 |
| `deno task start`       | Serve the existing browser build                                        |
| `deno task fmt`         | Format all TypeScript, configuration, and documentation                 |
| `deno task lint`        | Lint server, browser source, development script, and tests              |
| `deno task typecheck`   | Strict TypeScript checks for all application code and tests             |
| `deno task test`        | Deno tests for HTTP serving, configuration, and saved object validation |
| `deno task check`       | Check formatting, lint, types, and tests together                       |

Strict mode, checked indexed access, and exact optional properties apply to the browser source as
well as the server. The generated `dist/` tree is excluded from version control, formatting, and
linting. `deno task test` builds it before running server tests, so tests work from a clean
checkout.

### Permissions and serving

The server uses `Deno.serve` and streams generated `dist/` assets. It supports GET, HEAD, MIME
types, and ETag revalidation. Canonical path checks reject source/config files, directory listings,
and escaping symlinks. Typed JSON errors handle rejected requests.

The start task grants read access only to `dist/` and network access only to `127.0.0.1`.
Development additionally grants read access to `src/site/`, write access to `dist/`, and subprocess
access to `deno` so it can synchronize static assets, run the bundler, and start the server. Tests
build the site first and then grant read access only to `dist/`. Dependency downloads are managed by
Deno's CLI, separately from the application's runtime network permission.

CLI host options are `127.0.0.1`, `localhost`, `::1`, and `0.0.0.0`; another host needs an explicit
matching permission, for example:

```sh
deno run --no-prompt --allow-read=dist --allow-net=localhost:8000 src/main.ts --host localhost
```

Large assets are streamed instead of read entirely into server memory; file handles close when
transfers finish or cancel. The browser still constructs the full rail network in memory, which is
the main rendering cost. Saved JSON is validated and stripped of unrelated fields before use.

## Controls

The **3D viewer fills the page**. Navigation panels float over the scene and can be closed to make
more space. The camera adapts to the available area so a focused object stays clear of the object
browser and phone details sheet.

- **Explore** opens or closes the object browser. Search all 80 cataloged stations, hubs, trains,
  colored lines, trainyards, bosses, landmarks, and cutaways. Try `Syndicate`, `83`, `Trainyard Q`,
  `Mimic 4`, or `Red 24`. A line name plus a number also finds unrecorded stops on that line. The
  full result list scrolls; there is no pagination.
- **All / Stations / Trains / Lines / Yards / Bosses / Landmarks** filters by object type.
  **Discover** groups the catalog and begins with six suggested starting points.
- **Saved** holds objects marked with a star in a result or the details panel. **Recent** shows the
  last 20 selected objects, including numbered stations and objects selected directly in the scene.
  Saved places, recent selections, and your theme are stored locally in the browser. If browser
  storage is blocked, saving still works for the current session.
- Select a result, scene dot, label, or object to bring it into view and highlight it. The details
  panel shows its identity, reconstruction notes, and **Stops & connections** shortcuts to related
  routes, hubs, stairwells, and access points.
- The arrows next to the **matches** counter step through the current search, category, or
  collection. **Back / Forward** revisits selection history, using the header buttons on desktop or
  the details panel on phones. **Focus** recenters the selected object. Close its details without
  clearing the selection; click the object-name button to reopen them.
- The camera's target button returns to the **Whole Tangle**. **+ / −** provides button access to
  zoom. Drag to orbit; scroll or pinch to zoom. Right-drag or use two fingers to pan.
- **View** switches between the whole Tangle, route inspection, overhead, and the Syndicate logo.
  **Cutaways** opens trainyard, Abyss, and paired-tunnel presets on desktop. On smaller screens all
  presets are in the view selector. Any cutaway can also be found in Explore.
- **Syndicate** reveals the named-route meshes from above, with the colored subway web hidden. Click
  a route label or its connected-route shortcut to inspect it. The ring arrangement is interpreted.
- **Routes** hides the thousands of unidentified background rails and displays the identified
  colored lines and named services. Selecting a line isolates it. Faint neutral guides show the ring
  backbone. Routes follow circular arcs and change rings at reconstructed intersections; short
  access sections converge on the Abyss.
- **Tools** opens the line picker, **Jump to station** for stops 10–436 on a selected colored line,
  and **Separate tunnel faces**. Separation values are display offsets, not canonical distances. The
  panel can be closed after inspection.
- Clicking an unidentified background rail selects that inferred line; it can also be saved and
  revisited.
- **Run trains** starts train motion; click again to pause.
- **Fullscreen** toggles browser fullscreen while keeping navigation controls available. Its icon
  and label update when fullscreen ends. If the browser or an embedded view does not allow
  fullscreen, the button is disabled; the viewer still fills the page.
- The sun / moon button switches between **dark and light themes**. Dark is the default for scene
  contrast.
- On phones and touch tablets, Explore begins closed and folds away after selection. Details appear
  in a scrollable sheet. Controls adapt to portrait and landscape layouts.

### Keyboard shortcuts

| Key                               | Action                              |
| --------------------------------- | ----------------------------------- |
| `/`                               | Open Explore and focus search       |
| `↑` / `↓` in search or results    | Browse matching objects             |
| `Enter` in search                 | Select the first result             |
| `Enter` on a result               | Select that result                  |
| `Home` / `End` in results         | Jump to the first / last result     |
| `Esc` in search                   | Clear the query, then close Explore |
| `F`                               | Toggle fullscreen                   |
| `Esc` in fullscreen               | Exit fullscreen                     |
| `Home` outside inputs and results | Return to the whole Tangle          |
| `+` / `−`                         | Zoom in / out                       |
| `Alt` + `←` / `→`                 | Back / Forward through selections   |
| `?`                               | Open navigation help                |

All buttons and inputs also support native Tab navigation. Hidden and covered panels are removed
from the tab order.

## Canon accuracy notes

> **Book-accuracy boundary:** Floor 4 has **9,375 stairwells**. The viewer's **6,246 rendered rail
> faces / 3,123 paired visual tunnels** and **24 yard decks** remain fan-derived display-density
> assumptions; they are not a canonical line, tunnel, or stairwell count.

The reconstruction keeps textual constraints separate from geometry that the novel does not fix:

- Ordinary stairwell stations are **12, 24, 36, 48, and 72**. Station **433** contains a hidden
  stairwell revealed after the Station Mimic is removed.
- The documented station-24 hub has **five stairwells and ten platform exits**, including an
  **Escape Velocity III** platform. Stations **36 and 48** are described as matching station 24.
- Station **60** provides a selector for **twelve Homeward Bound platforms**. The rendered E-24-60
  path remains representative; the complete employee network and yard assignments are unknown.
- Prime-numbered transfer stations are represented as transfer/saferoom locations. Documented
  Desperado/Vanquisher and Exit-only-cavern rules are annotations, not invented junction geometry.

These constraints live in `src/client/canon.ts` and are covered by `tests/canon_test.ts`. The model
does not synthesize thousands of stairwell coordinates, exact yard pairings, or missing route
intersections where the text does not provide them.

## What is reconstructed

The complete modeled network has **6,246 colored lines in 3,123 paired tunnels**, with 3,123
concealed passage centerlines, 24 yard decks, stair chambers, named train routes, and six Station
Mimic markers. **Those network totals and the yard pairing are fan-derived assumptions, not official
counts.**

Documented line names and recorded connections guide the model. Unrecorded connections, coordinates,
scale, trainyard arrangement, many route shapes, and architectural or creature appearances are
inferred. This is an explorable reconstruction, not an authoritative canonical blueprint.

In **The Dungeon Anarchist’s Cookbook, Chapter 30**, Mordecai identifies the named train circuits
with the Syndicate logo: overlapping circles of different sizes, recognizable from above. The Abyss
represents the galaxy’s center, and the circuits represent wormhole paths. This model therefore uses
an **unequal overlapping-ring backbone**, woven at different heights. The ordinary subway bundles
follow that backbone before reaching the central Abyss. The previous radial spiral geometry and
decorative unidentified-loop overlay have been removed.

The displayed four loop families are an interpretation based on the modeled Nightmare,
Dismemberment, and Eviscerator circuits. **Four is not asserted to be the canonical number of logo
rings.** The ring arrangement, relative sizes, elevations, and trainyard positions are inferred,
rather than an exact reproduction of an official emblem. Escape Velocity and Homeward Bound show
representative access portions; their unrecorded complete circuits are not invented as documented
routes.

The 23 identified colored routes now use the same ring backbone as the full model. Their recorded
station connections are preserved exactly. Unrecorded links are routed along the ring arcs through
geometric intersections, with elevation changes at the joins. Those inferred joins do **not** assert
additional canonical stations or transfers between named trains. Individual colored services remain
open routes toward the Abyss; they need not be closed circles themselves.

The rendered colored rails, opposite tunnel faces, concealed passages, train movement, and selection
markers share one sampled path per line. Sampling follows arc length within each station interval,
including intervals between closely numbered recorded stops, so rendering and trains do not cut
across an intervening arc.

The Nightmare Express follows its recorded five-stop figure-eight sequence: Red/Yellow 83 →
Purple/Mauve 283 → the Abyss 436 → Green/Yellow 283 → Tangerine/Plum 83 → the starting stop. The
modeled Dismemberment Limited includes Ochre 149 and Mauve 281; its remaining loop is inferred.
Eviscerator, Escape Velocity, and Homeward Bound also use reconstructed route geometry.

The Abyss cutaway and opposing-gravity tunnel section illustrate the described floor mechanics.
Their dimensions and shapes are interpretive. Unknown opposing lines remain explicitly unidentified
in the interface.

## Project structure

```text
iron-tangle/
├── deno.json
├── deno.lock
├── README.md
├── .gitignore
├── .vscode/settings.json
├── scripts/
│   ├── build.ts
│   ├── dev.ts
│   └── site.ts
├── src/
│   ├── main.ts
│   ├── server.ts
│   ├── site/
│   │   ├── index.html
│   │   └── assets/
│   │       ├── model.css
│   │       └── ui.css
│   ├── lib/
│   │   ├── config.ts
│   │   └── http.ts
│   └── client/
│       ├── main.ts
│       ├── model.ts
│       ├── interface.ts
│       ├── navigation.ts
│       ├── types.ts
│       ├── objects.ts
│       └── dom.ts
├── tests/
│   ├── assert.ts
│   ├── config_test.ts
│   ├── server_test.ts
│   └── objects_test.ts
└── licenses/
    ├── babylonjs-LICENSE.md
    └── babylonjs-NOTICE.md
```

## Files and editing

| File                                           | Purpose                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `deno.json`, `deno.lock`                       | Deno tasks, pinned package mapping, strict compiler configuration, integrity lock  |
| `scripts/build.ts`, `scripts/site.ts`          | Reproducible `dist/` generation and static-site synchronization                    |
| `scripts/dev.ts`                               | Build/watch/server orchestration and process cleanup                               |
| `src/main.ts`, `src/server.ts`                 | Typed streaming HTTP server                                                        |
| `src/lib/`                                     | Server CLI validation, path containment, MIME types, HTTP errors                   |
| `src/client/main.ts`                           | Explicit UI → scene → navigation initialization                                    |
| `src/client/model.ts`                          | Typed Babylon geometry, routes, trains, camera, picking, animation                 |
| `src/client/interface.ts`                      | Responsive panels, keyboard access, themes, fullscreen, browser storage            |
| `src/client/navigation.ts`                     | Catalog, search, filters, saved/recent selections, history, connections            |
| `src/client/types.ts`                          | Shared domain objects, route/train types, scene metadata and targets               |
| `src/client/objects.ts`                        | Stored JSON validation, legacy ID migration, reference reconciliation, stable keys |
| `src/client/scene_specs.ts`                    | Shared authored object identities, connections, placement, and movement settings   |
| `src/client/object_definitions.ts`             | Discovery entries, identity registries, and definition validation                  |
| `src/client/runtime_objects.ts`                | Runtime resource ownership, staged replacement, and cleanup                        |
| `src/client/dom.ts`                            | Typed DOM lookup and required-value/context helpers                                |
| `src/site/index.html`, `src/site/assets/*.css` | Page markup and styles                                                             |
| `dist/`                                        | Generated site artifact; ignored by git and deployed by GitHub Actions             |
| `tests/`                                       | Deno configuration, server, and object validation tests                            |
| `licenses/`                                    | Babylon license and notice                                                         |

Geometry is generated in TypeScript; there are no missing mesh files or remote textures. The
searchable catalog covers identified points and representative landmarks. Thousands of unnamed rail
faces remain selectable in the scene, with their identities and connections marked as inferred.

## References

- [Fourth Floor](https://dungeon-crawler-carl.fandom.com/wiki/Fourth_Floor)
- [Syndicate — logo description](https://dungeon-crawler-carl.fandom.com/wiki/Syndicate)
- Matt Dinniman, _The Dungeon Anarchist’s Cookbook_, Chapter 30 — the named circuits, Syndicate
  symbol, and galaxy map reveal.
- [Untangling the Iron Tangle](https://dungeon-crawler-carl.fandom.com/wiki/Untangling_the_Iron_Tangle)
- [Nightmare Express](https://dungeon-crawler-carl.fandom.com/wiki/Nightmare_Express)
- [Dismemberment Limited](https://dungeon-crawler-carl.fandom.com/wiki/Dismemberment_Limited)
- [Fan reconstruction and network estimate](https://www.reddit.com/r/DungeonCrawlerCarl/comments/1s05zu7/untangling_the_iron_tangle/)
- [Babylon.js](https://www.babylonjs.com/) —
  [source repository](https://github.com/BabylonJS/Babylon.js)

Unofficial fan project; not affiliated with or endorsed by the author or publisher.
