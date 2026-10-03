/** Run Deno's browser bundler and local server together; forward CLI options to the server. */
const executable = Deno.execPath();
const command = (args: string[]): Deno.Command =>
  new Deno.Command(executable, {
    args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

const build = await command(["task", "build"]).spawn().status;
if (!build.success) Deno.exit(build.code);

const children = [
  command(["task", "build:watch"]).spawn(),
  command([
    "run",
    "--no-prompt",
    "--watch=src/main.ts,src/server.ts,src/lib",
    "--allow-read=public",
    "--allow-net=127.0.0.1",
    "src/main.ts",
    ...Deno.args,
  ]).spawn(),
];
let stopping = false;
function stop(): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch (error: unknown) {
      if (!(error instanceof Deno.errors.NotFound)) console.error(error);
    }
  }
}
Deno.addSignalListener("SIGINT", stop);
if (Deno.build.os !== "windows") Deno.addSignalListener("SIGTERM", stop);
try {
  const status = await Promise.race(children.map((child) => child.status));
  if (!stopping && !status.success) Deno.exitCode = status.code;
} finally {
  stop();
  await Promise.all(children.map((child) => child.status));
  Deno.removeSignalListener("SIGINT", stop);
  if (Deno.build.os !== "windows") Deno.removeSignalListener("SIGTERM", stop);
}
