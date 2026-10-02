export function extractFirstPostImage(body?: string): string | null {
  if (!body) return null;

  const markdownImage = body.match(
    /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/
  );

  if (markdownImage) {
    return markdownImage[1] ?? markdownImage[2] ?? null;
  }

  const htmlImage = body.match(
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i
  );

  return htmlImage?.[1] ?? null;
}
