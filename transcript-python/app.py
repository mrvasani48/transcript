import hmac
import os
import re
import logging
from typing import Annotated, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcript-api")
app = FastAPI(title="YouTube Transcript API")
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")


class TranscriptRequest(BaseModel):
    video_id: str
    lang: Optional[str] = None


def get_proxy_config():
    webshare_username = os.getenv("YOUTUBE_TRANSCRIPT_PROXY_USERNAME")
    webshare_password = os.getenv("YOUTUBE_TRANSCRIPT_PROXY_PASSWORD")
    generic_proxy_url = os.getenv("YOUTUBE_TRANSCRIPT_PROXY_URL")

    if bool(webshare_username) != bool(webshare_password):
        raise ValueError("proxy_configuration_incomplete")

    if webshare_username and webshare_password:
        return WebshareProxyConfig(
            proxy_username=webshare_username,
            proxy_password=webshare_password,
        )

    if generic_proxy_url:
        return GenericProxyConfig(
            http_url=generic_proxy_url,
            https_url=generic_proxy_url,
        )

    require_proxy = os.getenv("REQUIRE_YOUTUBE_PROXY", "1" if os.getenv("VERCEL") else "0")
    if require_proxy.lower() in {"1", "true", "yes"}:
        raise ValueError("youtube_proxy_required")

    return None


def get_transcript_api():
    proxy_config = get_proxy_config()
    if proxy_config is None:
        return YouTubeTranscriptApi()
    return YouTubeTranscriptApi(proxy_config=proxy_config)


@app.get("/health")
def health():
    return {"ok": True}


@app.post(
    "/transcript",
    responses={
        400: {"description": "Invalid video ID"},
        401: {"description": "Invalid service token"},
        404: {"description": "No transcript available"},
        502: {"description": "YouTube transcript request failed"},
        503: {"description": "Service or proxy configuration is incomplete"},
    },
)
def get_transcript(
    body: TranscriptRequest,
    x_transcript_service_token: Annotated[Optional[str], Header()] = None,
):
    expected_token = os.getenv("TRANSCRIPT_SERVICE_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=503, detail="service_token_not_configured")
    if not x_transcript_service_token or not hmac.compare_digest(
        x_transcript_service_token, expected_token
    ):
        raise HTTPException(status_code=401, detail="unauthorized")
    if not VIDEO_ID_PATTERN.fullmatch(body.video_id):
        raise HTTPException(status_code=400, detail="invalid_video_id")

    try:
        transcript_api = get_transcript_api()
        transcript_list = transcript_api.list(body.video_id)
        if body.lang:
            selected = transcript_list.find_transcript([body.lang])
        else:
            selected = next(iter(transcript_list), None)
        if selected is None:
            raise HTTPException(status_code=404, detail="transcript_not_available")
        fetched = selected.fetch()
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
    except Exception as error:
        logger.warning("Transcript retrieval failed: %s", type(error).__name__)
        raise HTTPException(status_code=502, detail="youtube_transcript_unavailable") from None

    segments = [
        {
            "start": float(snippet.start),
            "duration": float(snippet.duration),
            "text": snippet.text,
        }
        for snippet in fetched.snippets
    ]
    return {
        "videoId": body.video_id,
        "language": fetched.language_code or body.lang or "unknown",
        "segments": segments,
        "fullText": " ".join(segment["text"] for segment in segments).strip(),
    }
