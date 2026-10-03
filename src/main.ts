import { parseConfig, serverUrl } from "./lib/config.ts";
import { createHandler } from "./server.ts";

if (import.meta.main) {
  try {
    const config = parseConfig(Deno.args);
    const handler = await createHandler();
    Deno.serve({
      hostname: config.hostname,
      port: config.port,
      onListen: () => console.log(`The Iron Tangle → ${serverUrl(config)}`),
    }, handler);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
