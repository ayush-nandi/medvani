"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Languages,
  Menu,
  MessageCircleHeart,
  Mic,
  Paperclip,
  Plus,
  Settings,
  Send,
  Trash2,
  Video,
  X,
  CircleUserRound,
  LogOut,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, updatePassword, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../firebaseConfig";
import { useChatStore, type MediaAttachment } from "./useChatStore";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const LANGS = [
  { code: "auto", label: "Auto" },
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "bn-IN", label: "Bengali" },
  { code: "te-IN", label: "Telugu" },
  { code: "mr-IN", label: "Marathi" },
];

type SessionApi = {
  id: string;
  title?: string;
  updated_at?: string;
};

type ChatApiResponse = {
  session_id: string;
  title: string;
  response?: string;
};

type SessionDetailApi = {
  id: string;
  title: string;
  updated_at: string;
  messages: Array<{ role: "user" | "assistant"; text: string; at: string }>;
};

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function truncate(value: string, limit = 20) {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function normalizeUiLanguage(code: string) {
  const lowered = (code || "").trim().toLowerCase();
  if (!lowered) return "en-IN";
  if (lowered === "auto") return "auto";
  const map: Record<string, string> = {
    en: "en-IN",
    "en-in": "en-IN",
    hi: "hi-IN",
    "hi-in": "hi-IN",
    ta: "ta-IN",
    "ta-in": "ta-IN",
    bn: "bn-IN",
    "bn-in": "bn-IN",
    te: "te-IN",
    "te-in": "te-IN",
    mr: "mr-IN",
    "mr-in": "mr-IN",
  };
  return map[lowered] ?? code;
}

export default function ChatInterface() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const [input, setInput] = useState("");
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountError, setAccountError] = useState("");

  const {
    sessions,
    activeSessionId,
    messagesBySession,
    language,
    setLanguage,
    setSessions,
    setActiveSession,
    appendMessage,
    setMessages,
    removeSession,
    updateSessionTitle,
  } = useChatStore();

  const messages = useMemo(
    () => (activeSessionId ? messagesBySession[activeSessionId] ?? [] : []),
    [activeSessionId, messagesBySession],
  );
  const isLanding = messages.length === 0;

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) return;
      setActiveSession(null);
      void loadSessions(nextUser.uid);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(180, textareaRef.current.scrollHeight)}px`;
  }, [input]);

  async function loadSessions(uid: string) {
    try {
      const res = await fetch(`${API_BASE}/sessions?user_id=${encodeURIComponent(uid)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SessionApi[];
      const normalized = data.map((s) => ({
        id: s.id,
        title: s.title ?? "New chat",
        updated_at: s.updated_at,
      }));
      setSessions(normalized);
    } catch {
      if (!activeSessionId) {
        const local = crypto.randomUUID();
        setSessions([{ id: local, title: "New chat" }]);
        setActiveSession(null);
      }
    }
  }

  async function loadSessionMessages(sessionId: string, uid: string) {
    try {
      const res = await fetch(
        `${API_BASE}/sessions/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(uid)}`,
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SessionDetailApi;
      setMessages(
        sessionId,
        data.messages.map((m) => ({ role: m.role, text: m.text })),
      );
      if (data.title) updateSessionTitle(sessionId, data.title);
    } catch {
      setMessages(sessionId, []);
    }
  }

  async function createSession() {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SessionApi;
      const next = {
        id: data.id,
        title: data.title ?? "New chat",
        updated_at: data.updated_at,
      };
      if (!sessions.some((s) => s.id === next.id)) {
        setSessions([next, ...sessions]);
      } else {
        setSessions(sessions.map((s) => (s.id === next.id ? { ...s, ...next } : s)));
      }
      setActiveSession(next.id);
      setMessages(next.id, []);
      setInput("");
      setMedia([]);
    } catch {
      const local = crypto.randomUUID();
      setSessions([{ id: local, title: "New chat" }, ...sessions]);
      setActiveSession(local);
      setMessages(local, []);
      setInput("");
      setMedia([]);
    }
  }

  async function deleteSession(id: string) {
    if (!user) return;
    try {
      await fetch(
        `${API_BASE}/sessions/${id}?user_id=${encodeURIComponent(user.uid)}`,
        { method: "DELETE" },
      );
    } catch {
      // ignore, keep local delete
    } finally {
      removeSession(id);
    }
  }

  async function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const out = String(reader.result ?? "");
        resolve(out.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const out = String(reader.result ?? "");
        resolve(out.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const converted = await Promise.all(
      files.map(async (file) => {
        const base64 = await fileToBase64(file);
        if (file.type.startsWith("image/")) return { kind: "image" as const, content: base64, name: file.name };
        if (file.type.startsWith("video/")) return { kind: "video" as const, content: base64, name: file.name };
        return { kind: "pdf" as const, content: base64, name: file.name };
      }),
    );
    setMedia((prev) => [...prev, ...converted]);
    event.target.value = "";
  }

  async function sendMessage() {
    if (!user) return;
    let sessionId = activeSessionId;
    if (!sessionId) {
      await createSession();
      sessionId = useChatStore.getState().activeSessionId;
    }
    if (!sessionId) return;
    if (!input.trim() && media.length === 0) return;

    const userText = input.trim() || "[Media attached]";
    const sentMedia = [...media];
    appendMessage(sessionId, {
      role: "user",
      text: userText,
      media: sentMedia.length > 0 ? sentMedia : undefined,
    });
    setInput("");
    setMedia([]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          session_id: sessionId,
          message: userText,
          language_lock: language === "auto" ? null : language,
          media: sentMedia.map((m) => ({ kind: m.kind === "pdf" ? "text" : m.kind, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as ChatApiResponse;
      appendMessage(sessionId, {
        role: "assistant",
        text: data.response ?? "No response.",
      });
      if (data.title) updateSessionTitle(sessionId, data.title);

      // Backend title generation runs in background; refresh sessions shortly after first prompt.
      setTimeout(() => {
        if (user) void loadSessions(user.uid);
      }, 1200);
    } catch {
      appendMessage(sessionId, {
        role: "assistant",
        text: "Network/server error. Try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function startVoiceRecording() {
    if (voiceBusy) return;
    setVoiceError("");

    const startBackendRecordingCapture = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setVoiceBusy(false);
    };

    const win = window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (SpeechCtor) {
      try {
        const rec = new SpeechCtor();
        rec.lang = language === "auto" ? "en-IN" : language;
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };
        rec.onerror = (event) => {
          // Chrome speech service can throw "network" even with a valid mic.
          // Fall back to backend STT recording path automatically.
          if (event.error === "network") {
            setVoiceError("Browser voice service unavailable. Falling back to in-app recording.");
            speechRef.current = null;
            setRecording(false);
            setVoiceBusy(true);
            void startBackendRecordingCapture().catch(() => {
              setVoiceBusy(false);
              setVoiceError("Microphone access denied or unavailable.");
            });
            return;
          }
          setVoiceError(`Voice recognition error: ${event.error}`);
        };
        rec.onend = () => {
          setRecording(false);
          setVoiceBusy(false);
          speechRef.current = null;
        };
        speechRef.current = rec;
        setRecording(true);
        setVoiceBusy(true);
        rec.start();
        return;
      } catch {
        // fall back to backend STT recording path
      }
    }

    try {
      await startBackendRecordingCapture();
    } catch {
      setVoiceError("Microphone access denied or unavailable.");
    }
  }

  async function stopVoiceRecording() {
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {
        // ignore stop errors
      }
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || !user) return;
    setVoiceBusy(true);
    setRecording(false);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;

    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch(`${API_BASE}/stt-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "stt",
          audio_base64: audioBase64,
        }),
      });
      const data = (await res.json()) as { text?: string; detected_lang?: string; detail?: string };
      if (!res.ok) {
        throw new Error(data.detail || "Voice transcription failed.");
      }
      if (data.text) {
        setInput((prev) => (prev ? `${prev} ${data.text}` : data.text || ""));
      }
      if (language === "auto" && data.detected_lang) {
        setLanguage(normalizeUiLanguage(data.detected_lang));
      }
    } catch (err: unknown) {
      setVoiceError(err instanceof Error ? err.message : "Voice transcription failed.");
    } finally {
      setVoiceBusy(false);
      audioChunksRef.current = [];
    }
  }

  async function onLogout() {
    if (!auth) return;
    await signOut(auth);
    document.cookie = "medvani_auth=; Path=/; Max-Age=0; SameSite=Lax";
    router.push("/auth/login");
  }

  async function onChangePassword() {
    if (!auth || !user || !user.email) return;
    setAccountError("");
    const currentPassword = window.prompt("Enter current password");
    if (!currentPassword) return;
    const newPassword = window.prompt("Enter new password (min 6 chars)");
    if (!newPassword) return;
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setAccountOpen(false);
      alert("Password updated successfully.");
    } catch (err: unknown) {
      setAccountError(err instanceof Error ? err.message : "Unable to update password.");
    }
  }

  function renderInputBar() {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-full border border-zinc-700 bg-[#2b2b2b] px-3 py-2 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              onClick={() => fileRef.current?.click()}
            >
              <Plus size={18} suppressHydrationWarning />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,video/*,.pdf"
              onChange={onPickFile}
            />
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Ask MedVani"
            rows={1}
            className="max-h-44 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-400"
          />

          <div className="flex items-center justify-end gap-1">
            <div className="relative">
              <Languages
                className="pointer-events-none absolute left-2 top-2.5 text-zinc-400"
                size={14}
                suppressHydrationWarning
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-full border border-zinc-600 bg-zinc-800 py-2 pl-7 pr-2 text-xs text-white outline-none"
              >
                {LANGS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void (recording ? stopVoiceRecording() : startVoiceRecording())}
              className={`rounded-full p-2 ${
                recording ? "bg-red-500 text-black" : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
              } ${voiceBusy ? "cursor-not-allowed opacity-60" : ""}`}
              disabled={voiceBusy}
              title={recording ? "Stop recording" : "Start voice input"}
            >
              <Mic size={18} suppressHydrationWarning />
            </button>
            <button
              type="button"
              onClick={() => void sendMessage()}
              className="rounded-full bg-emerald-500 p-2 text-black hover:bg-emerald-400"
            >
              <Send size={18} suppressHydrationWarning />
            </button>
          </div>
        </div>

        {media.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 pl-2">
            {media.map((m, idx) => (
              <div
                key={`${m.kind}-${idx}`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-200"
              >
                <Paperclip size={12} suppressHydrationWarning />
                <span>{m.name ?? m.kind}</span>
                <button
                  type="button"
                  className="text-zinc-400 hover:text-red-400"
                  onClick={() => setMedia((prev) => prev.filter((_, pIdx) => pIdx !== idx))}
                >
                  <X size={12} suppressHydrationWarning />
                </button>
              </div>
            ))}
          </div>
        )}
        {voiceError && (
          <p className="mt-2 pl-2 text-xs text-red-400">{voiceError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-[#121212] text-white">
      <div className="mx-auto flex h-full w-full max-w-screen-2xl overflow-hidden">
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.aside
                initial={{ x: -280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-y-0 left-0 z-30 w-64 border-r border-zinc-800 bg-[#1e1e1e] md:absolute"
              >
                <div className="border-b border-zinc-800 p-3">
                  <button
                    type="button"
                    onClick={createSession}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                  >
                    <Plus size={16} suppressHydrationWarning />
                    New Chat
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group mb-1 flex items-center justify-between rounded-lg px-2 py-2 ${
                        session.id === activeSessionId ? "bg-zinc-700/70" : "hover:bg-zinc-800/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSession(session.id);
                          if (user) void loadSessionMessages(session.id, user.uid);
                          setSidebarOpen(false);
                        }}
                        className="max-w-[180px] truncate text-left text-sm text-zinc-200"
                      >
                        {truncate(session.title)}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSession(session.id)}
                        className="invisible rounded p-1 text-zinc-400 hover:text-red-400 group-hover:visible"
                      >
                        <Trash2 size={14} suppressHydrationWarning />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.aside>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-20 bg-black/40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            </>
          )}
        </AnimatePresence>

        <main className={`relative flex h-full w-full flex-col transition-[margin] duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-0"}`}>
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <button
              type="button"
              className="rounded-md border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <Menu size={16} suppressHydrationWarning />
            </button>
            <h2 className="bg-gradient-to-r from-white to-emerald-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              MedVani
            </h2>
            <div className="relative">
              <button
                type="button"
                className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800"
                onClick={() => setAccountOpen((v) => !v)}
              >
                <CircleUserRound size={16} suppressHydrationWarning />
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-zinc-700 bg-[#1b1b1b] p-2 shadow-xl"
                  >
                    <p className="truncate px-2 py-1 text-xs text-zinc-400">{user?.email ?? "Account"}</p>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => void onChangePassword()}
                    >
                      <Settings size={14} suppressHydrationWarning />
                      Change Password
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-300 hover:bg-zinc-800"
                      onClick={() => void onLogout()}
                    >
                      <LogOut size={14} suppressHydrationWarning />
                      Logout
                    </button>
                    {accountError && (
                      <p className="px-2 pt-1 text-xs text-red-400">{accountError}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-32 md:px-10">
            <AnimatePresence mode="wait">
              {isLanding ? (
                <motion.div
                  key="hero"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -28 }}
                  transition={{ duration: 0.35 }}
                  className="flex h-full flex-col items-center justify-center text-center"
                >
                  <h1 className="bg-gradient-to-r from-white via-zinc-100 to-emerald-300 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
                    MedVani
                  </h1>
                  <p className="mt-4 text-3xl font-medium text-gray-400">
                    Your personalized health chatbot
                  </p>
                  <div className="mt-8 w-full">{renderInputBar()}</div>
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="mx-auto mt-3 max-w-4xl space-y-6"
                >
                  {messages.map((m, idx) =>
                    m.role === "user" ? (
                      <div key={`${m.role}-${idx}`} className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl bg-[#303030] px-4 py-3 text-sm text-zinc-100">
                          {m.media && m.media.length > 0 && (
                            <div className="mb-3 grid gap-2">
                              {m.media.map((item, mIdx) => (
                                <div
                                  key={`${item.kind}-${mIdx}`}
                                  className="rounded-xl border border-zinc-600 bg-zinc-800 p-2 text-xs text-zinc-300"
                                >
                                  {item.kind === "image" && <span>Image: {item.name ?? "attachment"}</span>}
                                  {item.kind === "video" && (
                                    <span className="inline-flex items-center gap-1">
                                      <Video size={12} suppressHydrationWarning />
                                      Video: {item.name ?? "attachment"}
                                    </span>
                                  )}
                                  {item.kind === "pdf" && <span>PDF: {item.name ?? "attachment"}</span>}
                                  {item.kind === "audio" && <span>Audio attached</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={`${m.role}-${idx}`} className="flex items-start gap-3">
                        <div className="mt-1 rounded-full bg-emerald-500/15 p-2 text-emerald-400">
                          <MessageCircleHeart size={16} suppressHydrationWarning />
                        </div>
                        <p className="max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                          {m.text}
                        </p>
                      </div>
                    ),
                  )}
                  {loading && <p className="text-sm text-amber-400">Analyzing...</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isLanding && (
            <div className="sticky bottom-0 z-20 border-t border-zinc-800/50 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent px-4 py-3 md:px-8">
              {renderInputBar()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
