const projectRoot = new URL("../", import.meta.url);

export const siteSource = new URL("src/site/", projectRoot);
export const siteOutput = new URL("dist/", projectRoot);

const siteFiles = [
  "index.html",
  "assets/model.css",
  "assets/ui.css",
] as const;

export async function syncSite(options: { readonly clean?: boolean } = {}): Promise<void> {
  if (options.clean) {
    try {
      await Deno.remove(siteOutput, { recursive: true });
    } catch (error: unknown) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }

  await Deno.mkdir(new URL("assets/", siteOutput), { recursive: true });
  await Promise.all(
    siteFiles.map((path) =>
      Deno.copyFile(new URL(path, siteSource), new URL(path, siteOutput))
    ),
  );
}
