import base64
import importlib
import logging
import os
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from vector_service import VectorService

try:  # pragma: no cover
    _groq_module = importlib.import_module("groq")
    Groq = getattr(_groq_module, "Groq", None)
except ModuleNotFoundError:  # pragma: no cover
    Groq = None

try:  # pragma: no cover
    # Sarvam currently imports pydantic.v1 internals that warn on Python 3.14+.
    warnings.filterwarnings(
        "ignore",
        message=r"Core Pydantic V1 functionality isn't compatible with Python 3\.14 or greater\.",
        category=UserWarning,
        module=r"sarvamai\.core\.pydantic_utilities",
    )
    _sarvam_module = importlib.import_module("sarvamai")
    SarvamAI = getattr(_sarvam_module, "SarvamAI", None)
except ModuleNotFoundError:  # pragma: no cover
    SarvamAI = None

try:  # pragma: no cover
    _dotenv_module = importlib.import_module("dotenv")
    load_dotenv = getattr(_dotenv_module, "load_dotenv", None)
except ModuleNotFoundError:  # pragma: no cover
    load_dotenv = None

try:  # pragma: no cover
    firebase_admin = importlib.import_module("firebase_admin")
    firebase_credentials = importlib.import_module("firebase_admin.credentials")
    firebase_firestore = importlib.import_module("firebase_admin.firestore")
except ModuleNotFoundError:  # pragma: no cover
    firebase_admin = None
    firebase_credentials = None
    firebase_firestore = None
except Exception:  # pragma: no cover
    firebase_admin = None
    firebase_credentials = None
    firebase_firestore = None

try:  # pragma: no cover
    _firestore_query_module = importlib.import_module("google.cloud.firestore_v1.base_query")
    FieldFilter = getattr(_firestore_query_module, "FieldFilter", None)
except Exception:  # pragma: no cover
    FieldFilter = None

if load_dotenv:
    # Always load env from backend/.env, independent of current working directory.
    backend_env = Path(__file__).resolve().with_name(".env")
    load_dotenv(backend_env)


app = FastAPI(title="MedVani API", version="0.1.0")
logger = logging.getLogger("medvani")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")

VALID_SARVAM_MODELS = {
    "saarika:v2.5",
    "saaras:v3",
    "saaras-v3-realtime",
    "saarika:v1",
}

DEFAULT_SARVAM_STT_MODEL = "saarika:v2.5"
DEFAULT_SARVAM_TTS_MODEL = "saaras:v3"

VALID_AUDIO_CODECS = {
    "wav",
    "x-wav",
    "wave",
    "mp3",
    "mpeg",
    "mpeg3",
    "x-mp3",
    "x-mpeg-3",
    "aac",
    "x-aac",
    "aiff",
    "x-aiff",
    "ogg",
    "opus",
    "flac",
    "x-flac",
    "mp4",
    "x-m4a",
    "amr",
    "x-ms-wma",
    "webm",
    "pcm_s16le",
    "pcm_l16",
    "pcm_raw",
}

MIME_TO_AUDIO_CODEC = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/wav": "wav",
    "audio/x-wav": "x-wav",
    "audio/wave": "wave",
    "audio/mpeg": "mpeg",
    "audio/mp3": "mp3",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "audio/x-flac": "x-flac",
    "audio/mp4": "mp4",
    "audio/x-m4a": "x-m4a",
    "audio/amr": "amr",
    "audio/x-ms-wma": "x-ms-wma",
}

CODEC_TO_FILE_EXT = {
    "wav": "wav",
    "x-wav": "wav",
    "wave": "wav",
    "mp3": "mp3",
    "mpeg": "mp3",
    "mpeg3": "mp3",
    "x-mp3": "mp3",
    "x-mpeg-3": "mp3",
    "aac": "aac",
    "x-aac": "aac",
    "aiff": "aiff",
    "x-aiff": "aiff",
    "ogg": "ogg",
    "opus": "opus",
    "flac": "flac",
    "x-flac": "flac",
    "mp4": "mp4",
    "x-m4a": "m4a",
    "amr": "amr",
    "x-ms-wma": "wma",
    "webm": "webm",
    "pcm_s16le": "pcm",
    "pcm_l16": "pcm",
    "pcm_raw": "pcm",
}

CODEC_TO_MIME = {
    "wav": "audio/wav",
    "x-wav": "audio/x-wav",
    "wave": "audio/wave",
    "mp3": "audio/mpeg",
    "mpeg": "audio/mpeg",
    "mpeg3": "audio/mpeg",
    "x-mp3": "audio/mp3",
    "x-mpeg-3": "audio/mp3",
    "aac": "audio/aac",
    "x-aac": "audio/aac",
    "aiff": "audio/aiff",
    "x-aiff": "audio/x-aiff",
    "ogg": "audio/ogg",
    "opus": "audio/opus",
    "flac": "audio/flac",
    "x-flac": "audio/x-flac",
    "mp4": "audio/mp4",
    "x-m4a": "audio/x-m4a",
    "amr": "audio/amr",
    "x-ms-wma": "audio/x-ms-wma",
    "webm": "audio/webm",
    "pcm_s16le": "audio/pcm",
    "pcm_l16": "audio/pcm",
    "pcm_raw": "audio/pcm",
}


def _safe_sarvam_model(env_key: str, default: str) -> str:
    configured = (os.getenv(env_key) or "").strip()
    if not configured:
        return default
    if configured in VALID_SARVAM_MODELS:
        return configured
    logger.warning(
        "Invalid %s model '%s'. Falling back to '%s'.",
        env_key,
        configured,
        default,
    )
    return default


SARVAM_STT_MODEL = _safe_sarvam_model("SARVAM_STT_MODEL", DEFAULT_SARVAM_STT_MODEL)
SARVAM_TTS_MODEL = _safe_sarvam_model("SARVAM_TTS_MODEL", DEFAULT_SARVAM_TTS_MODEL)

SCHEDULE_HX_BLOCKLIST = {
    "alprazolam",
    "codeine",
    "morphine",
    "fentanyl",
    "zolpidem",
    "diazepam",
}

MEDICAL_SAFETY_PROMPT = (
    "You are MedVani, a medical support assistant. "
    "You support broad medical questions including symptoms, diseases, medicines, tests, prevention, vaccines, nutrition, lifestyle, and when-to-seek-care guidance. "
    "You must avoid definitive diagnoses and use language like 'Potential indications suggest...'. "
    "Always advise in-person consultation with a licensed physician. "
    "If asked for dosage of Schedule H/X medicines, refuse and offer safe alternatives. "
    "You may explain medicine purpose, common side effects, contraindications, and interactions at a high level, but do not provide restricted dosage instructions. "
    "Keep reasoning concise and clinically grounded in retrieved context."
)
DEFAULT_FIREBASE_SERVICE_ACCOUNT = Path(__file__).resolve().with_name("firebase_service_account.json")

LANGUAGE_CODE_MAP = {
    "en": "en-IN",
    "en-in": "en-IN",
    "english": "en-IN",
    "hi": "hi-IN",
    "hi-in": "hi-IN",
    "hindi": "hi-IN",
    "ta": "ta-IN",
    "ta-in": "ta-IN",
    "tamil": "ta-IN",
    "bn": "bn-IN",
    "bn-in": "bn-IN",
    "bengali": "bn-IN",
    "te": "te-IN",
    "te-in": "te-IN",
    "telugu": "te-IN",
    "mr": "mr-IN",
    "mr-in": "mr-IN",
    "marathi": "mr-IN",
}


def normalize_language_code(code: Optional[str], fallback: str = "en-IN") -> str:
    raw = (code or "").strip()
    if not raw:
        return fallback
    lowered = raw.lower()
    if lowered == "auto":
        return fallback
    if lowered in LANGUAGE_CODE_MAP:
        return LANGUAGE_CODE_MAP[lowered]
    # Keep unknown BCP-47-ish codes as-is (e.g., kn-IN), normalize separator/case.
    if "-" in raw:
        parts = raw.split("-", 1)
        return f"{parts[0].lower()}-{parts[1].upper()}"
    return fallback


def normalize_audio_codec(value: Optional[str]) -> Optional[str]:
    raw = (value or "").strip().lower()
    if not raw:
        return None
    base = raw.split(";", 1)[0].strip()
    codec = MIME_TO_AUDIO_CODEC.get(base, base)
    return codec if codec in VALID_AUDIO_CODECS else None


def safe_stt_error_message(exc: Exception) -> str:
    msg = str(exc)
    lower = msg.lower()
    if "failed to read the file" in lower or "check the audio format" in lower:
        return "Unable to read recorded audio format. Try Chrome/Edge and allow microphone access."
    if "invalid_request_error" in lower and "model" in lower:
        return "STT request model was rejected by provider."
    return "Speech-to-text request failed. Check backend logs for details."


class MediaInput(BaseModel):
    kind: Literal["text", "image", "video", "audio"]
    content: str = Field(..., description="Text, base64 image/audio, or URL for video")


class ChatRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    message: str
    language_lock: Optional[str] = None
    media: List[MediaInput] = Field(default_factory=list)


class ChatResponse(BaseModel):
    session_id: str
    title: str
    response: str
    target_lang: str
    citations: List[Dict[str, Any]]


class UploadMediaRequest(BaseModel):
    user_id: str
    media: MediaInput
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UploadMediaResponse(BaseModel):
    media_id: str
    extracted_text: str


class STTTTSRequest(BaseModel):
    mode: Literal["stt", "tts"]
    audio_base64: Optional[str] = None
    audio_codec: Optional[str] = None
    text: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None


class STTTTSResponse(BaseModel):
    text: Optional[str] = None
    audio_base64: Optional[str] = None
    detected_lang: Optional[str] = None


class SessionSummary(BaseModel):
    id: str
    title: str
    updated_at: str


class SessionMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str
    at: str


class SessionDetail(BaseModel):
    id: str
    title: str
    updated_at: str
    messages: List[SessionMessage]


class NewSessionRequest(BaseModel):
    user_id: str


class MedVaniService:
    def __init__(self) -> None:
        self.vector = VectorService()
        self.llm = self._init_groq()
        self.sarvam = self._init_sarvam()
        self.firestore = self._init_firestore()
        self.sessions_backend = "firestore"
        self.llm_status = self._llm_status()

    @staticmethod
    def _firebase_service_account_path() -> Path:
        raw = (os.getenv("FIREBASE_SERVICE_ACCOUNT") or "").strip()
        if not raw:
            return DEFAULT_FIREBASE_SERVICE_ACCOUNT
        candidate = Path(raw)
        if candidate.is_absolute():
            return candidate
        return (Path(__file__).resolve().parent / candidate).resolve()

    @staticmethod
    def _now_utc() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _to_iso(value: Any) -> str:
        if isinstance(value, datetime):
            dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        return str(value or "")

    @staticmethod
    def _where_equals(query: Any, field_name: str, value: Any) -> Any:
        if FieldFilter is None:
            return query.where(field_name, "==", value)
        return query.where(filter=FieldFilter(field_name, "==", value))

    def _init_firestore(self):
        if (
            firebase_admin is None
            or firebase_credentials is None
            or firebase_firestore is None
        ):
            raise RuntimeError(
                "Firestore dependencies are missing. Install firebase-admin in the backend environment."
            )

        key_path = self._firebase_service_account_path()
        if not key_path.exists():
            raise RuntimeError(f"Firestore service account key not found at {key_path}")

        try:
            apps = getattr(firebase_admin, "_apps", None)
            if not apps:
                cred = firebase_credentials.Certificate(str(key_path))
                firebase_admin.initialize_app(cred)

            client = firebase_firestore.client()
            # Probe once so startup fails fast when Firestore DB is not reachable.
            next(client.collection("medvani_probe").limit(1).stream(), None)
            return client
        except Exception as exc:
            raise RuntimeError(f"Firestore initialization failed: {exc}") from exc

    def list_sessions(self, user_id: str) -> List[SessionSummary]:
        docs = (
            self._where_equals(
                self.firestore.collection("sessions"),
                "user_id",
                user_id,
            ).stream()
        )
        out: List[SessionSummary] = []
        for doc in docs:
            data = doc.to_dict() or {}
            out.append(
                SessionSummary(
                    id=doc.id,
                    title=data.get("title", "New chat"),
                    updated_at=self._to_iso(data.get("updated_at")),
                )
            )
        out.sort(key=lambda item: item.updated_at, reverse=True)
        return out

    def new_session(self, user_id: str) -> SessionSummary:
        docs = (
            self._where_equals(
                self.firestore.collection("sessions"),
                "user_id",
                user_id,
            ).stream()
        )
        for doc in docs:
            data = doc.to_dict() or {}
            title = data.get("title", "New chat")
            count = int(data.get("message_count", 0) or 0)
            if title == "New chat" and count == 0:
                return SessionSummary(
                    id=doc.id,
                    title="New chat",
                    updated_at=self._to_iso(data.get("updated_at")),
                )

        session_id = str(uuid4())
        now = self._now_utc()
        self.firestore.collection("sessions").document(session_id).set(
            {
                "user_id": user_id,
                "title": "New chat",
                "updated_at": now,
                "created_at": now,
                "message_count": 0,
            }
        )
        return SessionSummary(
            id=session_id,
            title="New chat",
            updated_at=now.isoformat(),
        )

    def delete_session(self, session_id: str, user_id: str) -> None:
        session_ref = self.firestore.collection("sessions").document(session_id)
        snapshot = session_ref.get()
        if not snapshot.exists:
            return
        data = snapshot.to_dict() or {}
        if data.get("user_id") != user_id:
            return

        for msg_doc in session_ref.collection("messages").stream():
            msg_doc.reference.delete()

        session_ref.delete()

    def _upsert_session_message(
        self, session_id: str, user_id: str, user_text: str, assistant_text: str
    ) -> None:
        now = self._now_utc()
        session_ref = self.firestore.collection("sessions").document(session_id)
        snapshot = session_ref.get()

        if snapshot.exists:
            current = snapshot.to_dict() or {}
            existing_user_id = current.get("user_id")
            if existing_user_id and existing_user_id != user_id:
                logger.warning(
                    "Ignoring write to session '%s' for mismatched user.",
                    session_id,
                )
                return
        else:
            session_ref.set(
                {
                    "user_id": user_id,
                    "title": "New chat",
                    "updated_at": now,
                    "created_at": now,
                    "message_count": 0,
                }
            )

        session_ref.collection("messages").add(
            {
                "at": now,
                "user": user_text,
                "assistant": assistant_text,
            }
        )

        updates: Dict[str, Any] = {"updated_at": now}
        increment = (
            getattr(firebase_firestore, "Increment", None)
            if firebase_firestore is not None
            else None
        )
        if increment is not None:
            updates["message_count"] = increment(1)
        else:
            base_count = 0
            if snapshot.exists:
                base_count = int((snapshot.to_dict() or {}).get("message_count", 0) or 0)
            updates["message_count"] = base_count + 1

        session_ref.set(updates, merge=True)

    def get_session_detail(self, session_id: str, user_id: str) -> Optional[SessionDetail]:
        session_ref = self.firestore.collection("sessions").document(session_id)
        snapshot = session_ref.get()
        if not snapshot.exists:
            return None

        data = snapshot.to_dict() or {}
        if data.get("user_id") != user_id:
            return None

        rows = session_ref.collection("messages").order_by("at").stream()
        messages: List[SessionMessage] = []
        for row_doc in rows:
            row = row_doc.to_dict() or {}
            at = self._to_iso(row.get("at"))
            messages.append(SessionMessage(role="user", text=row.get("user", ""), at=at))
            messages.append(
                SessionMessage(role="assistant", text=row.get("assistant", ""), at=at)
            )

        return SessionDetail(
            id=snapshot.id,
            title=data.get("title", "New chat"),
            updated_at=self._to_iso(data.get("updated_at")),
            messages=messages,
        )

    def _session_title(self, session_id: str) -> str:
        snapshot = self.firestore.collection("sessions").document(session_id).get()
        if not snapshot.exists:
            return "New chat"
        return (snapshot.to_dict() or {}).get("title", "New chat")

    def _needs_title_generation(self, session_id: str) -> bool:
        session_ref = self.firestore.collection("sessions").document(session_id)
        snapshot = session_ref.get()
        if not snapshot.exists:
            return True

        data = snapshot.to_dict() or {}
        if data.get("title", "New chat") != "New chat":
            return False

        count = data.get("message_count")
        if count is None:
            rows = list(session_ref.collection("messages").limit(2).stream())
            return len(rows) <= 1
        return int(count) <= 1

    def _generate_title(self, prompt: str) -> str:
        fallback = truncate_title(prompt)
        if not self.llm:
            return fallback
        try:
            title_prompt = (
                "Summarize the following medical user prompt into 3-4 words. "
                "Return title case only, no punctuation, no quotes.\n\n"
                f"Prompt: {prompt}"
            )
            out = self.llm.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": title_prompt}],
            )
            text = out.choices[0].message.content.strip() if out.choices else ""
            cleaned = " ".join((text or fallback).replace('"', "").replace(".", "").split())
            return truncate_title(cleaned, limit=40)
        except Exception:
            return fallback

    def update_session_title_from_prompt(self, session_id: str, prompt: str) -> None:
        title = self._generate_title(prompt)

        session_ref = self.firestore.collection("sessions").document(session_id)
        snapshot = session_ref.get()
        if not snapshot.exists:
            return
        data = snapshot.to_dict() or {}
        if data.get("title", "New chat") != "New chat":
            return
        session_ref.set(
            {
                "title": title,
                "updated_at": self._now_utc(),
            },
            merge=True,
        )

    @staticmethod
    def _init_groq():
        key = os.getenv("GROQ_API_KEY")
        if not key or Groq is None:
            return None
        return Groq(api_key=key)

    @staticmethod
    def _llm_status() -> str:
        has_key = bool(os.getenv("GROQ_API_KEY"))
        has_sdk = Groq is not None
        if has_key and has_sdk:
            return "ready"
        if not has_key and not has_sdk:
            return "missing_groq_key_and_sdk"
        if not has_key:
            return "missing_groq_key"
        return "missing_groq_sdk_or_wrong_python_env"

    @staticmethod
    def _init_sarvam():
        key = os.getenv("SARVAM_API_KEY")
        if not key or SarvamAI is None:
            return None
        return SarvamAI(api_subscription_key=key)

    def detect_language(self, text: str) -> str:
        if not text.strip():
            return "en-IN"
        if self.sarvam:
            try:
                out = self.sarvam.text.translate(
                    input=text,
                    source_language_code="auto",
                    target_language_code="en-IN",
                )
                detected = getattr(out, "source_language_code", None)
                if detected:
                    return normalize_language_code(detected, "en-IN")
            except Exception:
                pass

        devanagari_range = any("\u0900" <= ch <= "\u097F" for ch in text)
        tamil_range = any("\u0B80" <= ch <= "\u0BFF" for ch in text)
        bengali_range = any("\u0980" <= ch <= "\u09FF" for ch in text)
        if devanagari_range:
            return "hi-IN"
        if tamil_range:
            return "ta-IN"
        if bengali_range:
            return "bn-IN"
        return "en-IN"

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        source_lang = normalize_language_code(source_lang, "en-IN")
        target_lang = normalize_language_code(target_lang, "en-IN")
        if source_lang == target_lang:
            return text
        if not self.sarvam:
            return text
        try:
            out = self.sarvam.text.translate(
                input=text,
                source_language_code=source_lang,
                target_language_code=target_lang,
            )
            return getattr(out, "translated_text", text)
        except Exception:
            return text

    def _image_to_clinical_text(self, b64_data: str) -> str:
        if not self.llm:
            return "Image uploaded. No LLM visual model configured."
        prompt = "Describe this medical image factually for clinical triage notes. Do not diagnose. Mention visible findings only."
        try:
            result = self.llm.chat.completions.create(
                model=GROQ_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}},
                        ],
                    }
                ],
            )
            content = result.choices[0].message.content if result.choices else ""
            return content or "No extractable findings."
        except Exception as exc:
            logger.exception("Groq image analysis failed: %s", exc)
            return "Unable to parse image safely."

    def _run_medical_guardrails(self, text: str) -> None:
        lower = text.lower()
        if "dosage" in lower or "dose" in lower:
            if any(med in lower for med in SCHEDULE_HX_BLOCKLIST):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot provide dosage guidance for restricted Schedule H/X medications.",
                )

    @staticmethod
    def _llm_error_message(exc: Exception) -> str:
        msg = str(exc).lower()
        if "quota" in msg or "rate_limit_exceeded" in msg or "resource_exhausted" in msg:
            return "Groq quota/rate limit exceeded. Please check Groq usage limits and retry."
        if "api key" in msg or "unauthorized" in msg or "authentication" in msg:
            return "Groq API key is invalid or unauthorized. Update GROQ_API_KEY in .env and restart backend."
        if "rate" in msg:
            return "Groq rate limit hit. Please wait a moment and retry."
        return "LLM request failed. Check backend logs for the exact Groq error."

    def handle_chat(self, req: ChatRequest) -> ChatResponse:
        self._run_medical_guardrails(req.message)

        detected_lang = self.detect_language(req.message)
        target_lang = normalize_language_code(req.language_lock, detected_lang)

        normalized_context = req.message
        for item in req.media:
            if item.kind == "image":
                normalized_context += "\nImage context: " + self._image_to_clinical_text(item.content)
            elif item.kind == "video":
                normalized_context += f"\nVideo URL provided: {item.content}"
            elif item.kind == "audio":
                normalized_context += "\nAudio attached."

        retrieved = self.vector.hybrid_search(
            query=normalized_context,
            user_id=req.user_id,
            top_k=5,
        )

        rag_context = "\n".join(x.get("text", "") for x in retrieved)

        english_prompt = (
            f"{MEDICAL_SAFETY_PROMPT}\n\n"
            f"User input (possibly multilingual): {req.message}\n\n"
            f"Retrieved context:\n{rag_context}\n\n"
            "Respond in English first with cautious clinical support and clear doctor-referral guidance."
        )

        if not self.llm:
            english_answer = (
                "LLM is not initialized. "
                f"Status: {self.llm_status}. "
                f"Python: {sys.executable}. "
                "Ensure backend/.env has GROQ_API_KEY, Groq SDK is installed in the same Python environment, and restart backend."
            )
        else:
            try:
                answer = self.llm.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": MEDICAL_SAFETY_PROMPT},
                        {"role": "user", "content": english_prompt},
                    ],
                )
                english_answer = answer.choices[0].message.content if answer.choices else ""
                english_answer = english_answer or "Please consult a physician in person."
            except Exception as exc:
                logger.exception("Groq chat completion failed: %s", exc)
                english_answer = self._llm_error_message(exc)

        final_answer = self.translate(english_answer, "en-IN", target_lang)
        session_id = req.session_id or str(uuid4())
        self._upsert_session_message(session_id, req.user_id, req.message, final_answer)

        self.vector.upsert_user_event(
            user_id=req.user_id,
            text=normalized_context,
            metadata={"detected_lang": detected_lang, "target_lang": target_lang},
        )

        return ChatResponse(
            session_id=session_id,
            title=self._session_title(session_id),
            response=final_answer,
            target_lang=target_lang,
            citations=retrieved,
        )

    def handle_upload_media(self, req: UploadMediaRequest) -> UploadMediaResponse:
        media_id = str(uuid4())
        extracted_text = ""

        if req.media.kind == "image":
            extracted_text = self._image_to_clinical_text(req.media.content)
        elif req.media.kind == "video":
            extracted_text = f"Video URL noted for analysis: {req.media.content}"
        elif req.media.kind == "audio":
            extracted_text = "Audio uploaded. Use /stt-tts to transcribe with Sarvam Saaras."
        else:
            extracted_text = req.media.content

        self.vector.upsert_user_event(
            user_id=req.user_id,
            text=extracted_text,
            metadata={"media_kind": req.media.kind, **req.metadata},
            event_id=media_id,
        )

        return UploadMediaResponse(media_id=media_id, extracted_text=extracted_text)

    def handle_stt_tts(self, req: STTTTSRequest) -> STTTTSResponse:
        if not self.sarvam:
            raise HTTPException(status_code=500, detail="Sarvam SDK is not configured.")

        if req.mode == "stt":
            if not req.audio_base64:
                raise HTTPException(status_code=400, detail="audio_base64 is required for STT")
            try:
                audio_bytes = base64.b64decode(req.audio_base64)
                codec = normalize_audio_codec(req.audio_codec)
                ext = CODEC_TO_FILE_EXT.get(codec or "", "webm")
                mime = CODEC_TO_MIME.get(codec or "", "audio/webm")
                file_payload: Any = (
                    (f"recording.{ext}", audio_bytes, mime)
                    if codec
                    else audio_bytes
                )
                stt_kwargs: Dict[str, Any] = {}
                if codec:
                    stt_kwargs["input_audio_codec"] = codec
                stt_model = _safe_sarvam_model("SARVAM_STT_MODEL", DEFAULT_SARVAM_STT_MODEL)
                try:
                    out = self.sarvam.speech_to_text.transcribe(
                        file=file_payload,
                        model=stt_model,
                        **stt_kwargs,
                    )
                except Exception as model_exc:
                    err = str(model_exc)
                    if (
                        stt_model != DEFAULT_SARVAM_STT_MODEL
                        and ("invalid_request_error" in err or "body model" in err.lower())
                    ):
                        out = self.sarvam.speech_to_text.transcribe(
                            file=file_payload,
                            model=DEFAULT_SARVAM_STT_MODEL,
                            **stt_kwargs,
                        )
                    else:
                        raise
                text = getattr(out, "transcript", "")
                detected = self.detect_language(text)
                return STTTTSResponse(text=text, detected_lang=detected)
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"STT failed: {safe_stt_error_message(exc)}",
                ) from exc

        if not req.text:
            raise HTTPException(status_code=400, detail="text is required for TTS")

        try:
            out = self.sarvam.text_to_speech.convert(
                text=req.text,
                target_language_code=req.target_lang or "en-IN",
                model=SARVAM_TTS_MODEL,
            )
            audio_blob = getattr(out, "audio", b"")
            encoded = base64.b64encode(audio_blob).decode("utf-8") if audio_blob else None
            return STTTTSResponse(audio_base64=encoded)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"TTS failed: {exc}") from exc


svc = MedVaniService()


def truncate_title(value: str, limit: int = 20) -> str:
    clean = (value or "").strip()
    if not clean:
        return "New chat"
    return clean[:limit]


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "llm_initialized": svc.llm is not None,
        "llm_status": svc.llm_status,
        "groq_key_present": bool(os.getenv("GROQ_API_KEY")),
        "sarvam_initialized": svc.sarvam is not None,
        "session_backend": svc.sessions_backend,
        "firestore_initialized": svc.firestore is not None,
        "python_executable": sys.executable,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, background_tasks: BackgroundTasks) -> ChatResponse:
    response = svc.handle_chat(req)
    if svc._needs_title_generation(response.session_id):
        background_tasks.add_task(
            svc.update_session_title_from_prompt, response.session_id, req.message
        )
    return response


@app.get("/sessions", response_model=List[SessionSummary])
def get_sessions(user_id: str) -> List[SessionSummary]:
    return svc.list_sessions(user_id)


@app.post("/session/new", response_model=SessionSummary)
def post_session_new(req: NewSessionRequest) -> SessionSummary:
    return svc.new_session(req.user_id)


@app.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session_detail(session_id: str, user_id: str) -> SessionDetail:
    detail = svc.get_session_detail(session_id, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found")
    return detail


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, user_id: str) -> Dict[str, str]:
    svc.delete_session(session_id, user_id)
    return {"status": "ok"}


@app.post("/upload-media", response_model=UploadMediaResponse)
def upload_media(req: UploadMediaRequest) -> UploadMediaResponse:
    return svc.handle_upload_media(req)


@app.post("/stt-tts", response_model=STTTTSResponse)
def stt_tts(req: STTTTSRequest) -> STTTTSResponse:
    return svc.handle_stt_tts(req)
