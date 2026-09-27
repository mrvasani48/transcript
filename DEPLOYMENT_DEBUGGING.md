# Deployment Debugging Progress

## Changes Made

- Added Vercel Web Analytics using `@vercel/analytics` in the root layout. Web Analytics still needs to be enabled in the Vercel project dashboard.
- Set the transcript API route to the Node.js runtime.
- Replaced `youtube-dl-exec` and its Python-based `yt-dlp` executable with `youtubei.js` for audio fallback. Removed the unused downloader packages.
- Added sanitized logging for caption-fetch failures. Audio errors log the message, status, and error type without logging signed Googlevideo media URLs.
- Added clearer handling for upstream 403 and missing streaming data errors.

## What We Found

- Vercel initially failed with `spawn .../yt-dlp ENOENT` because the executable was not bundled at the path used by the package.
- After the binary path was corrected, `yt-dlp` exited with code 127. Its executable is a Python zipapp, which is not a reliable dependency for a Vercel Node.js function.
- For YouTube media, tests showed that a 1 MB audio range could work while larger or later requests returned HTTP 403. The full audio response also returned 403 in local testing, so audio fallback is not reliable for every video or server network.
- The video `EEPKv7ciUQY` returned 45 Hindi caption segments locally through `youtube-transcript`. This confirms captions exist for that video, even though the Vercel route has been falling through to audio fallback.
- `youtubei.js`'s transcript-panel endpoint returned HTTP 400 in local tests. However, its iOS video metadata included a Hindi caption-track URL for `EEPKv7ciUQY`; the existing caption XML parser recovered 45 segments from that track. The API now tries these InnerTube caption tracks after the primary caption lookup fails and before attempting audio transcription.
- The production build passed after the changes.

## Next Diagnostic Step

Deploy the latest code, then check Vercel logs for `Caption fetch failed`. The log includes the caption error name, message, status, and video ID. That is the original failure currently hidden by the subsequent audio fallback error. The live domain could not be reached from the development environment during testing, so the Vercel-side caption failure remains unverified.

If the caption request is blocked from Vercel, the code alone may not resolve it; YouTube may restrict requests from the function's egress IP. Audio fallback may likewise be denied. A proxy or a transcript provider accessible from the deployment environment may be required.

## Local Verification

```bash
npm run build
```

The production build completed successfully.

## Security Reminder

An OpenAI API key was present in the local `.env.local` file during debugging. Rotate it, then update the local environment and Vercel environment variables. Do not add the key to this document or commit it.
