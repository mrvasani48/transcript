import { NextResponse } from "next/server";
import { YoutubeTranscript, YoutubeTranscriptDisabledError } from "youtube-transcript";
import OpenAI, { toFile } from "openai";
import { Innertube } from "youtubei.js";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    return null;
  }
}

async function transcribeAudio(videoId, language) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const chunks = [];
  let totalBytes = 0;
  const youtube = await Innertube.create({ retrieve_player: false });
  const info = await youtube.getInfo(videoId, { client: "IOS" });
  const format = info.chooseFormat({ type: "audio", quality: "best", format: "any" });
  const audioStream = await info.download({
    itag: format.itag,
    type: "audio",
    format: "any",
  });
  const reader = audioStream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new Error("Audio file is larger than Whisper's 25 MB limit");
    }
    chunks.push(Buffer.from(value));
  }

  const client = new OpenAI({ apiKey });
  const result = await client.audio.transcriptions.create({
    file: await toFile(
      Buffer.concat(chunks),
      `youtube-audio.${format.mime_type.split("/")[1].split(";")[0]}`
    ),
    model: "whisper-1",
    response_format: "verbose_json",
    ...(language && { language }),
  });

  const segments = (result.segments || []).map((segment) => ({
    start: segment.start,
    duration: segment.end - segment.start,
    text: segment.text.trim(),
  }));

  return {
    language: result.language || language || "unknown",
    segments,
    fullText: result.text.trim(),
  };
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
    const detectedLanguage = items[0]?.lang || lang || "unknown";

    return NextResponse.json({
      videoId,
      language: detectedLanguage,
      segments: items.map((i) => ({
        start: i.offset / 1000,
        duration: i.duration / 1000,
        text: i.text,
      })),
      fullText,
    });
  } catch (err) {
    console.error("Caption fetch failed:", {
      videoId,
      name: err?.name,
      message: err?.message,
      status: err?.status,
    });

    try {
      const audioTranscript = await transcribeAudio(videoId, lang);
      return NextResponse.json({ videoId, source: "audio", ...audioTranscript });
    } catch (audioError) {
      const upstreamStatus = audioError.info?.response?.status;
      console.error("Audio transcription failed:", {
        message: audioError.message,
        status: audioError.status || upstreamStatus,
        type: audioError.info?.error_type,
      });
      let error = "Couldn't fetch captions or transcribe the video's audio.";

      if (audioError.message === "OPENAI_API_KEY is not configured") {
        error = "Captions are unavailable. Add OPENAI_API_KEY to .env.local and restart the server.";
      } else if (audioError.message.includes("25 MB")) {
        error = "This video's audio is larger than Whisper's 25 MB limit.";
      } else if (audioError.status === 401 || audioError.name === "AuthenticationError") {
        error = "The OpenAI API key is invalid. Replace it in .env.local and restart the server.";
      } else if (audioError.status === 429) {
        error = "OpenAI rejected the request because the account has no available quota.";
      } else if (upstreamStatus === 403) {
        error = "YouTube denied the audio download from this server. Try a video with captions or another video.";
      } else if (audioError.message === "Streaming data not available") {
        error = "This server couldn't retrieve the video's captions or audio stream. Try again or use a video with captions.";
      } else if (audioError.message.includes("Sign in") || audioError.message.includes("403")) {
        error = "YouTube blocked the audio download for this video. Try another video.";
      } else if (err instanceof YoutubeTranscriptDisabledError) {
        error = "Captions are disabled, and audio transcription failed. Check the server error log for details.";
      }

      return NextResponse.json({ error }, { status: 422 });
    }
  }
}