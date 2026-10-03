import {
  assetUrl,
  contentType,
  errorResponse,
  HttpError,
  isInsideRoot,
  matchesEtag,
  responseHeaders,
} from "./lib/http.ts";

export type RequestHandler = (request: Request) => Promise<Response>;

export interface HandlerOptions {
  readonly assetRoot?: URL;
  readonly onError?: (error: unknown) => void;
}

/** Stream generated site assets without buffering the Babylon bundle or exposing source files. */
export async function createHandler(options: HandlerOptions = {}): Promise<RequestHandler> {
  const assetRoot = options.assetRoot ?? new URL("../dist/", import.meta.url);
  if (assetRoot.protocol !== "file:" || !assetRoot.pathname.endsWith("/")) {
    throw new TypeError("The asset root must be an absolute file URL ending in /.");
  }
  const canonicalRoot = await Deno.realPath(assetRoot);
  const onError = options.onError ??
    ((error: unknown) => console.error("Asset request failed:", error));

  return async (request: Request): Promise<Response> => {
    let file: Deno.FsFile | undefined;
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        throw new HttpError(405, "method_not_allowed", "Only GET and HEAD are supported.");
      }
      const asset = assetUrl(request.url, assetRoot);
      const path = await Deno.realPath(asset);
      if (!isInsideRoot(canonicalRoot, path)) throw new HttpError(404, "not_found", "Not found.");
      file = await Deno.open(path, { read: true });
      const info = await file.stat();
      if (!info.isFile) throw new HttpError(404, "not_found", "Not found.");

      const etag = `W/"${info.size.toString(16)}-${(info.mtime?.getTime() ?? 0).toString(16)}"`;
      const headers = responseHeaders();
      headers.set("content-type", contentType(asset.pathname));
      headers.set("etag", etag);
      if (info.mtime) headers.set("last-modified", info.mtime.toUTCString());
      if (matchesEtag(request.headers.get("if-none-match"), etag)) {
        file.close();
        file = undefined;
        return new Response(null, { status: 304, headers });
      }
      headers.set("content-length", String(info.size));
      if (request.method === "HEAD") {
        file.close();
        file = undefined;
        return new Response(null, { headers });
      }
      // FsFile.readable closes its file on completion or cancellation, including client disconnects.
      const body = file.readable;
      file = undefined;
      return new Response(body, { headers });
    } catch (error: unknown) {
      file?.close();
      if (error instanceof HttpError) return errorResponse(request, error);
      if (
        error instanceof Deno.errors.NotFound || error instanceof Deno.errors.NotADirectory ||
        error instanceof Deno.errors.NotCapable || error instanceof Deno.errors.PermissionDenied
      ) {
        return errorResponse(request, new HttpError(404, "not_found", "Not found."));
      }
      onError(error);
      return errorResponse(
        request,
        new HttpError(500, "internal_error", "Unable to serve this asset."),
      );
    }
  };
}
