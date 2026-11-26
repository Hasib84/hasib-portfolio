// Classifies a pasted video link the way the admin panel promises:
// YouTube (watch / shorts / youtu.be / embed / live) plays through the
// youtube-nocookie embed, Facebook (video / reel / watch / fb.watch) plays
// through the Facebook embed plugin, and a direct .mp4 plays natively.

export type ParsedVideo =
  | { kind: "youtube"; id: string }
  | { kind: "facebook"; url: string }
  | { kind: "mp4"; url: string };

export function parseVideo(raw: string): ParsedVideo | null {
  const url = raw.trim();
  if (!url) return null;

  const ytPatterns = [
    /youtube\.com\/watch\?[^#]*v=([\w-]{6,})/,
    /youtu\.be\/([\w-]{6,})/,
    /youtube\.com\/shorts\/([\w-]{6,})/,
    /youtube\.com\/embed\/([\w-]{6,})/,
    /youtube\.com\/live\/([\w-]{6,})/,
    /youtube-nocookie\.com\/embed\/([\w-]{6,})/,
  ];
  for (const pattern of ytPatterns) {
    const match = url.match(pattern);
    if (match?.[1]) return { kind: "youtube", id: match[1] };
  }

  if (/facebook\.com|fb\.watch/.test(url)) {
    return { kind: "facebook", url };
  }

  if (/\.mp4($|\?)/i.test(url)) {
    return { kind: "mp4", url };
  }

  return null;
}

export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
