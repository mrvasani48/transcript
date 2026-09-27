"use client";

import { useState } from "react";

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(false);
    setStatus("Fetching transcript…");
    setData(null);

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...(language !== "auto" && { lang: language }) }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(true);
        setStatus(json.error || "Something went wrong.");
        return;
      }

      setData(json);
      setStatus(
        `${json.segments.length} segments found (${json.language})${
          json.source === "audio" ? " from audio" : ""
        }.`
      );
    } catch {
      setError(true);
      setStatus("Couldn't reach the server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setError(true);
        setStatus("Your clipboard is empty.");
        return;
      }

      setUrl(clipboardText.trim());
      setError(false);
      setStatus("YouTube link pasted from clipboard.");
    } catch {
      setError(true);
      setStatus("Clipboard access was blocked. Paste the link into the field manually.");
    }
  }

  async function handleCopy() {
    if (!data?.fullText) return;
    await navigator.clipboard.writeText(data.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function handleDownload() {
    if (!data) return;

    const transcript = data.segments?.length
      ? data.segments
          .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
          .join("\n")
      : data.fullText;
    if (!transcript?.trim()) return;

    const file = new Blob([`${transcript.trim()}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${data.videoId || "transcript"}.txt`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  return (
    <div className="max-w-[760px] mx-auto px-6 pt-16 pb-24">
      <h1 className="text-3xl font-medium tracking-tight mb-1">Transcript</h1>
      <p className="text-muted mb-10 max-w-[46ch]">
        Paste a YouTube link. Get the spoken text back, timestamped.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-2 sm:flex-row">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          autoComplete="off"
          className="flex-1 bg-panel border border-line text-ink px-4 py-3 rounded-md font-mono-ui text-base focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={handlePaste}
          disabled={loading}
          className="border border-line text-ink px-4 py-3 rounded-md hover:border-accent disabled:opacity-50"
          title="Paste from clipboard"
        >
          Paste
        </button>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Transcript language"
          className="bg-panel border border-line text-ink px-3 py-3 rounded-md font-mono-ui text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="auto">Auto-detect</option>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="gu">Gujarati</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-[#0c1615] font-semibold px-6 rounded-md disabled:opacity-50"
        >
          Fetch
        </button>
      </form>
      <p className="text-muted text-sm mb-10">
        Works with youtube.com and youtu.be links. If captions are disabled, an audio transcription service is required.
      </p>

      {status && (
        <p className={`text-sm mb-4 ${error ? "text-error" : "text-muted"}`}>{status}</p>
      )}

      {data && (
        <div>
          <div className="flex flex-wrap justify-between items-baseline gap-3 border-b border-line pb-3 mb-5">
            <h2 className="font-mono-ui text-sm text-muted">{data.videoId}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="border border-line text-ink text-sm px-3.5 py-1.5 rounded-md hover:border-accent"
              >
                {copied ? "Copied" : "Copy text"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="border border-line text-ink text-sm px-3.5 py-1.5 rounded-md hover:border-accent"
              >
                Download .txt
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {data.segments.map((s) => (
              <div key={`${s.start}-${s.duration}-${s.text}`} className="flex gap-4">
                <span className="w-14 shrink-0 text-accent font-mono-ui text-xs pt-0.5">
                  {formatTime(s.start)}
                </span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="mt-12 text-muted text-xs">
        Runs on your own server — nothing is stored.
      </footer>
    </div>
  );
}