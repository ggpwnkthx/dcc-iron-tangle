type HttpErrorCode = "bad_request" | "not_found" | "method_not_allowed" | "internal_error";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: HttpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function responseHeaders(): Headers {
  return new Headers({
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-cache",
  });
}

export function errorResponse(request: Request, error: HttpError): Response {
  const headers = responseHeaders();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (error.status === 405) headers.set("allow", "GET, HEAD");
  const body = JSON.stringify({ error: { code: error.code, message: error.message } });
  return new Response(request.method === "HEAD" ? null : body, { status: error.status, headers });
}

/** Decode once, reject hidden or ambiguous paths, and resolve strictly under the public URL. */
export function assetUrl(requestUrl: string, publicRoot: URL): URL {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname);
  } catch {
    throw new HttpError(400, "bad_request", "Invalid URL encoding.");
  }
  let hasControlCharacter = false;
  for (const character of pathname) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) {
      hasControlCharacter = true;
      break;
    }
  }
  if (pathname.includes("\\") || pathname.includes("%") || hasControlCharacter) {
    throw new HttpError(400, "bad_request", "Invalid asset path.");
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) {
    throw new HttpError(404, "not_found", "Not found.");
  }
  const relative = pathname === "/" ? "index.html" : segments.map(encodeURIComponent).join("/");
  return new URL(relative, publicRoot);
}

/** realPath resolves symlinks before this containment check. */
export function isInsideRoot(root: string, target: string): boolean {
  const normalize = (value: string): string => {
    const path = value.replaceAll("\\", "/").replace(/\/+$/, "");
    return Deno.build.os === "windows" ? path.toLowerCase() : path;
  };
  return normalize(target).startsWith(normalize(root) + "/");
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/plain; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  wasm: "application/wasm",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};

export function contentType(pathname: string): string {
  const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

export function matchesEtag(header: string | null, etag: string): boolean {
  const opaque = (tag: string): string => tag.trim().replace(/^W\//, "");
  return header?.split(",").some((tag) => tag.trim() === "*" || opaque(tag) === opaque(etag)) ??
    false;
}
