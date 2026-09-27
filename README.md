# YouTube Transcript App (Next.js)

One app, one server — the API route and the page both run inside Next.js.

## Run it

```bash
cd yt-transcript-next
npm install
npm run dev
```

Open http://localhost:3000

## Structure

- `app/api/transcript/route.js` — Route Handler (`POST /api/transcript`).
  Takes `{ url }`, extracts the video ID, pulls the caption track with the
  `youtube-transcript` package. No API key needed.
- `app/page.jsx` — the UI: paste a link, see the timestamped transcript,
  copy the full text.
- `app/layout.jsx`, `app/globals.css` — Tailwind setup.

## Notes

- Uses YouTube captions when available. If captions are disabled or unavailable,
  it can transcribe the video's audio with OpenAI Whisper.
- The language selector supports automatic detection, English (`en`), Hindi
  (`hi`), and Gujarati (`gu`). Automatic detection uses the video's first
  available caption track and reports the detected language.
- For another language, send `{ url, lang: "es" }` from the client;
  `youtube-transcript` will try that caption track.
- To enable audio fallback, create a `.env.local` file with
  `OPENAI_API_KEY=your_key_here`, then restart the dev server. Audio uploads are
  limited to 25 MB by the Whisper API.
- Deploys anywhere Next.js does (Vercel, Node server, Docker) since the
  transcript fetch runs server-side in the Route Handler, not the browser.
