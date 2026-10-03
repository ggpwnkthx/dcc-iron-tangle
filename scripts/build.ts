import { syncSite } from "./site.ts";

await syncSite({ clean: true });

const projectRoot = new URL("../", import.meta.url);
const status = await new Deno.Command(Deno.execPath(), {
  cwd: projectRoot,
  args: [
    "bundle",
    "--check",
    "--platform=browser",
    "--format=iife",
    "--minify",
    "--output=dist/assets/app.js",
    "src/client/main.ts",
  ],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
}).spawn().status;

if (!status.success) Deno.exit(status.code);
