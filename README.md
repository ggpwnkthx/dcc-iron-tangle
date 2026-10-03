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

Open **http://127.0.0.1:8000/**. Development mode first builds the browser app, then runs Deno's
bundler in watch mode alongside the local server. TypeScript edits rebuild `public/assets/app.js`;
server edits restart the listener. Refresh the browser after frontend changes. HTML and CSS are
served directly, so they need only a browser refresh. Use `deno task dev --port 8080` to change the
port. Ctrl+C stops both development processes.

For a release build and server:

```sh
deno task build
deno task start
```

The ZIP includes the generated browser bundle. `deno task start` serves that existing build without
rebuilding it. You can also open `public/index.html` directly for the standalone browser version.
Saved objects and themes are stored per browser origin; HTTP and file origins have separate storage.

### TypeScript and packages

All application logic is genuine TypeScript under `src/client/`: typed scene construction,
discriminated selection objects, routes, trains, DOM access, navigation, storage validation, and UI
controls. There are no handwritten application JavaScript files in `public/`; `app.js` is generated.
HTML and CSS remain their native formats.

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
| `deno task build`       | Strictly check and create a minified browser bundle                     |
| `deno task build:watch` | Watch and rebuild browser TypeScript with type checking                 |
| `deno task start`       | Serve the existing browser build                                        |
| `deno task fmt`         | Format all TypeScript, configuration, and documentation                 |
| `deno task lint`        | Lint server, browser source, development script, and tests              |
| `deno task typecheck`   | Strict TypeScript checks for all application code and tests             |
| `deno task test`        | Deno tests for HTTP serving, configuration, and saved object validation |
| `deno task check`       | Check formatting, lint, types, and tests together                       |

Strict mode, checked indexed access, and exact optional properties apply to the browser source as
well as the server. The generated bundle is excluded from formatting/linting. Rebuild before running
tests in a fresh git checkout, where generated output is ignored.

### Permissions and serving

The server uses `Deno.serve` and streams `public/` assets. It supports GET, HEAD, MIME types, and
ETag revalidation. Canonical path checks reject source/config files, directory listings, and
escaping symlinks. Typed JSON errors handle rejected requests.

The start task grants read access only to `public/` and network access only to `127.0.0.1`.
Development additionally grants subprocess access to `deno`, so it can run the bundler and server;
it does not grant application-wide write or network access. The bundler CLI writes only its declared
output. Tests need read access only to `public/`. Dependency downloads are managed by Deno's CLI,
separately from the application's runtime network permission.

CLI host options are `127.0.0.1`, `localhost`, `::1`, and `0.0.0.0`; another host needs an explicit
matching permission, for example:

```sh
deno run --no-prompt --allow-read=public --allow-net=localhost:8000 src/main.ts --host localhost
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
├── scripts/dev.ts
├── src/
│   ├── main.ts
│   ├── server.ts
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
├── public/
│   ├── index.html
│   └── assets/
│       ├── app.js (generated)
│       ├── model.css
│       └── ui.css
└── licenses/
    ├── babylonjs-LICENSE.md
    └── babylonjs-NOTICE.md
```

## Files and editing

| File                                       | Purpose                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `deno.json`, `deno.lock`                   | Deno tasks, pinned package mapping, strict compiler configuration, integrity lock |
| `scripts/dev.ts`                           | Build/watch/server orchestration and process cleanup                              |
| `src/main.ts`, `src/server.ts`             | Typed streaming HTTP server                                                       |
| `src/lib/`                                 | Server CLI validation, path containment, MIME types, HTTP errors                  |
| `src/client/main.ts`                       | Explicit UI → scene → navigation initialization                                   |
| `src/client/model.ts`                      | Typed Babylon geometry, routes, trains, camera, picking, animation                |
| `src/client/interface.ts`                  | Responsive panels, keyboard access, themes, fullscreen, browser storage           |
| `src/client/navigation.ts`                 | Catalog, search, filters, saved/recent selections, history, connections           |
| `src/client/types.ts`                      | Shared domain objects, route/train types, scene metadata and targets              |
| `src/client/objects.ts`                    | Stored JSON validation and stable object keys                                     |
| `src/client/dom.ts`                        | Typed DOM lookup and required-value/context helpers                               |
| `public/index.html`, `public/assets/*.css` | Page markup and styles                                                            |
| `public/assets/app.js`                     | Generated browser artifact; edit TypeScript sources instead                       |
| `tests/`                                   | Deno configuration, server, and object validation tests                           |
| `licenses/`                                | Babylon license and notice                                                        |

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
