"use client";
import { Analytics } from "@vercel/analytics/next"
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
        body: JSON.stringify({ url }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(true);
        setStatus(json.error || "Something went wrong.");
        return;
      }

      setData(json);
      setStatus(`${json.segments.length} segments found.`);
    } catch {
      setError(true);
      setStatus("Couldn't reach the server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!data?.fullText) return;
    await navigator.clipboard.writeText(data.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="max-w-[760px] mx-auto px-6 pt-16 pb-24">
      <h1 className="text-3xl font-medium tracking-tight mb-1">Transcript</h1>
      <p className="text-muted mb-10 max-w-[46ch]">
        Paste a YouTube link. Get the spoken text back, timestamped.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          autoComplete="off"
          className="flex-1 bg-panel border border-line text-ink px-4 py-3 rounded-md font-mono-ui text-base focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-[#0c1615] font-semibold px-6 rounded-md disabled:opacity-50"
        >
          Fetch
        </button>
      </form>
      <p className="text-muted text-sm mb-10">
        Works with youtube.com and youtu.be links. The video needs captions enabled.
      </p>

      {status && (
        <p className={`text-sm mb-4 ${error ? "text-error" : "text-muted"}`}>{status}</p>
      )}

      {data && (
        <div>
          <div className="flex justify-between items-baseline border-b border-line pb-3 mb-5">
            <h2 className="font-mono-ui text-sm text-muted">{data.videoId}</h2>
            <button
              onClick={handleCopy}
              className="border border-line text-ink text-sm px-3.5 py-1.5 rounded-md hover:border-accent"
            >
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {data.segments.map((s, i) => (
              <div key={i} className="flex gap-4">
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
            <Analytics />
    </div>
  );
}
