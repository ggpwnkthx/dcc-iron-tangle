import { parseConfig, serverUrl } from "../src/lib/config.ts";
import { equal, throws } from "./assert.ts";

Deno.test("server defaults to a local listener on port 8000", () => {
  const config = parseConfig([]);
  equal(config.hostname, "127.0.0.1");
  equal(config.port, 8000);
  equal(serverUrl(config), "http://127.0.0.1:8000/");
});

Deno.test("options accept separate values and equals syntax", () => {
  const config = parseConfig(["--host", "0.0.0.0", "--port=8080"]);
  equal(config.hostname, "0.0.0.0");
  equal(config.port, 8080);
  equal(parseConfig(["--port", "65535"]).port, 65535);
  equal(serverUrl(parseConfig(["--host=::1"])), "http://[::1]:8000/");
});

Deno.test("invalid ports fail before opening a listener", () => {
  for (const value of ["0", "65536", "-1", "1.5", "1e3", "abc", "Infinity", " "]) {
    throws(() => parseConfig([`--port=${value}`]), "Port must");
  }
});

Deno.test("unknown, duplicate, and incomplete options are rejected", () => {
  throws(() => parseConfig(["--unknown"]), "Unknown option");
  throws(() => parseConfig(["--port=8000", "--port=8001"]), "Duplicate option");
  throws(() => parseConfig(["--port"]), "Missing value");
  throws(() => parseConfig(["--port", "--host", "localhost"]), "Missing value");
  throws(() => parseConfig(["--host="]), "Missing value");
  throws(() => parseConfig(["--host=example.com"]), "Host must");
});
