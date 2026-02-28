import base64
import hashlib
import importlib
import os
from typing import Any, Dict, List, Optional
from uuid import uuid4

try:  # pragma: no cover
    _aead_module = importlib.import_module("cryptography.hazmat.primitives.ciphers.aead")
    AESGCM = getattr(_aead_module, "AESGCM", None)
except ModuleNotFoundError:  # pragma: no cover
    AESGCM = None

Pinecone = None
LEGACY_PINECONE = None
try:  # pragma: no cover
    _pinecone_module = importlib.import_module("pinecone")
    Pinecone = getattr(_pinecone_module, "Pinecone", None)
    if Pinecone is None:
        LEGACY_PINECONE = _pinecone_module
except Exception:  # pragma: no cover
    Pinecone = None
    LEGACY_PINECONE = None


class VectorService:
    def __init__(self) -> None:
        self.index_name = os.getenv("PINECONE_INDEX", "medvani-trust-layer")
        self.namespace = os.getenv("PINECONE_NAMESPACE", "default")
        self.environment = os.getenv("PINECONE_ENVIRONMENT", "us-east-1-aws")
        self.pc = None
        self.index = None
        self._aes_key = self._load_aes_key()
        self._init_pinecone()

    @staticmethod
    def _load_aes_key() -> Optional[bytes]:
        raw = os.getenv("MEDVANI_AES256_KEY", "").strip()
        if not raw or AESGCM is None:
            return None
        try:
            key = base64.b64decode(raw)
        except Exception:
            key = raw.encode("utf-8")
        return key if len(key) == 32 else None

    def _encrypt(self, plaintext: str) -> Dict[str, str]:
        if not self._aes_key or AESGCM is None:
            return {"enc": "none", "cipher_text": plaintext}
        aesgcm = AESGCM(self._aes_key)
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return {
            "enc": "aes-256-gcm",
            "cipher_text": base64.b64encode(nonce + ct).decode("utf-8"),
        }

    def _decrypt(self, enc: str, cipher_text: str) -> str:
        if enc != "aes-256-gcm" or not self._aes_key or AESGCM is None:
            return cipher_text
        try:
            blob = base64.b64decode(cipher_text)
            nonce, ct = blob[:12], blob[12:]
            aesgcm = AESGCM(self._aes_key)
            pt = aesgcm.decrypt(nonce, ct, None)
            return pt.decode("utf-8")
        except Exception:
            return ""

    def _init_pinecone(self) -> None:
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            return

        if Pinecone is not None:
            self.pc = Pinecone(api_key=api_key)
            self.index = self.pc.Index(self.index_name)
            return

        if LEGACY_PINECONE is not None:
            LEGACY_PINECONE.init(api_key=api_key, environment=self.environment)
            self.index = LEGACY_PINECONE.Index(self.index_name)

    @staticmethod
    def _pseudo_embed(text: str, dim: int = 128) -> List[float]:
        # Replace with production embeddings model; deterministic fallback for local scaffold.
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        vals = []
        for i in range(dim):
            vals.append(((digest[i % len(digest)] / 255.0) * 2.0) - 1.0)
        return vals

    def upsert_user_event(
        self,
        user_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        event_id: Optional[str] = None,
    ) -> str:
        event_id = event_id or str(uuid4())
        enc_payload = self._encrypt(text)
        payload = {
            "id": event_id,
            "values": self._pseudo_embed(text),
            "metadata": {
                "user_id": user_id,
                "text_enc": enc_payload["enc"],
                "text_cipher": enc_payload["cipher_text"],
                **(metadata or {}),
            },
        }
        if self.index:
            self.index.upsert(vectors=[payload], namespace=self.namespace)
        return event_id

    def hybrid_search(self, query: str, user_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not query.strip():
            return []

        dense = self._pseudo_embed(query)

        if not self.index:
            return [
                {
                    "id": "local-fallback",
                    "score": 0.0,
                    "text": "No Pinecone connection configured. Add medical corpus docs to enable trust layer grounding.",
                    "source": "local",
                }
            ]

        result = self.index.query(
            namespace=self.namespace,
            vector=dense,
            top_k=top_k,
            include_metadata=True,
            filter={"user_id": {"$eq": user_id}},
        )

        matches = []
        for match in getattr(result, "matches", []):
            md = match.get("metadata", {}) if isinstance(match, dict) else getattr(match, "metadata", {})
            text = self._decrypt(md.get("text_enc", "none"), md.get("text_cipher", ""))
            matches.append(
                {
                    "id": match.get("id") if isinstance(match, dict) else getattr(match, "id", ""),
                    "score": match.get("score") if isinstance(match, dict) else getattr(match, "score", 0.0),
                    "text": text,
                    "source": md.get("source", "user-history"),
                }
            )
        return matches
