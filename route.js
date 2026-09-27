import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

// Extracts a YouTube video ID from most common URL formats (watch, youtu.be, shorts, embed)
function extractVideoId(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
      const parts = parsed.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live");
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    }

    return null;
  } catch {
    // Not a full URL — maybe the user pasted a bare video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    return null;
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const url = body?.url;
  const lang = body?.lang;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Please provide a YouTube URL." }, { status: 400 });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "Couldn't find a valid YouTube video ID in that link." },
      { status: 400 }
    );
  }

  try {
    const options = lang ? { lang } : undefined;
    const items = await YoutubeTranscript.fetchTranscript(videoId, options);

    const fullText = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();

    return NextResponse.json({
      videoId,
      segments: items.map((i) => ({
        start: i.offset / 1000,
        duration: i.duration / 1000,
        text: i.text,
      })),
      fullText,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          "Couldn't fetch a transcript for this video. It may not have captions available, or they may be disabled.",
      },
      { status: 422 }
    );
  }
}
