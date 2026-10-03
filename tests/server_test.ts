import { createHandler } from "../src/server.ts";
import { isInsideRoot } from "../src/lib/http.ts";
import { assert, equal } from "./assert.ts";

const handler = await createHandler();
const request = (path: string, init?: RequestInit): Request =>
  new Request(`http://127.0.0.1:8000${path}`, init);

Deno.test("GET / serves the complete viewer with the correct content type", async () => {
  const response = await handler(request("/"));
  equal(response.status, 200);
  equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  equal(response.headers.get("x-content-type-options"), "nosniff");
  const html = await response.text();
  assert(html.includes('id="it-canvas"'));
  assert(html.includes('src="assets/app.js"'));
});

Deno.test("CSS and JavaScript have executable browser MIME types", async () => {
  for (
    const [path, type] of [
      ["/assets/model.css", "text/css; charset=utf-8"],
      ["/assets/app.js", "text/javascript; charset=utf-8"],
    ] as const
  ) {
    const response = await handler(request(path));
    equal(response.status, 200);
    equal(response.headers.get("content-type"), type);
    assert((await response.text()).length > 100);
  }
});

Deno.test("the compiled browser bundle is streamed and can be cancelled without leaking its file", async () => {
  const response = await handler(request("/assets/app.js"));
  equal(response.status, 200);
  assert(Number(response.headers.get("content-length")) > 1_000_000);
  assert(response.body);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert(first.value && first.value.byteLength > 0);
  await reader.cancel();
  reader.releaseLock();
});

Deno.test("HEAD returns asset metadata without opening a response stream", async () => {
  const response = await handler(request("/assets/app.js", { method: "HEAD" }));
  equal(response.status, 200);
  equal(response.body, null);
  assert(Number(response.headers.get("content-length")) > 1_000_000);
  assert(response.headers.has("etag"));
});

Deno.test("query strings do not change the asset path", async () => {
  const response = await handler(request("/index.html?v=123"));
  equal(response.status, 200);
  await response.body?.cancel();
});

Deno.test("ETag revalidation returns 304 and accepts weak, strong, list, and wildcard tags", async () => {
  const initial = await handler(request("/assets/model.css", { method: "HEAD" }));
  const etag = initial.headers.get("etag");
  assert(etag);
  for (const tag of [etag, etag.replace(/^W\//, ""), `"unrelated", ${etag}`, "*"]) {
    const response = await handler(
      request("/assets/model.css", { headers: { "if-none-match": tag } }),
    );
    equal(response.status, 304);
    equal(response.body, null);
    equal(response.headers.get("etag"), etag);
  }
});

Deno.test("a nonmatching ETag returns the current asset", async () => {
  const response = await handler(request("/assets/model.css", {
    headers: { "if-none-match": 'W/"outdated"' },
  }));
  equal(response.status, 200);
  await response.body?.cancel();
});

Deno.test("missing assets and source files outside public return typed 404 responses", async () => {
  for (const path of ["/missing.js", "/src/main.ts", "/deno.json", "/README.md", "/.gitignore"]) {
    const response = await handler(request(path));
    equal(response.status, 404);
    equal(
      await response.text(),
      JSON.stringify({ error: { code: "not_found", message: "Not found." } }),
    );
  }
});

Deno.test("directories do not expose file listings", async () => {
  const response = await handler(request("/assets/"));
  equal(response.status, 404);
  await response.text();
});

Deno.test("encoded traversal, backslashes, control characters, and malformed encoding are rejected", async () => {
  for (const path of ["/%252e%252e/README.md", "/assets/%5cmodel.js", "/%00", "/%0a", "/%zz"]) {
    const response = await handler(request(path));
    equal(response.status, 400);
    await response.text();
  }
  const normalized = await handler(request("/%2e%2e/deno.json"));
  equal(normalized.status, 404);
  await normalized.text();
});

Deno.test("non-GET methods return 405 with the supported methods", async () => {
  const response = await handler(request("/", { method: "POST", body: "ignored" }));
  equal(response.status, 405);
  equal(response.headers.get("allow"), "GET, HEAD");
  assert((await response.text()).includes("method_not_allowed"));
});

Deno.test("HEAD errors have no response body", async () => {
  const response = await handler(request("/missing.js", { method: "HEAD" }));
  equal(response.status, 404);
  equal(response.body, null);
});

Deno.test("canonical root checks reject neighboring and parent directories", () => {
  assert(isInsideRoot("/app/public", "/app/public/assets/app.js"));
  assert(!isInsideRoot("/app/public", "/app/public-copy/private.txt"));
  assert(!isInsideRoot("/app/public", "/app/src/main.ts"));
  assert(!isInsideRoot("/app/public", "/app/public"));
});

Deno.test("invalid public roots fail at startup", async () => {
  for (const publicRoot of [new URL("https://example.com/"), new URL("file:///not-a-directory")]) {
    let failed = false;
    try {
      await createHandler({ publicRoot });
    } catch (error: unknown) {
      assert(error instanceof TypeError);
      failed = true;
    }
    assert(failed);
  }
});
