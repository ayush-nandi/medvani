import { create } from "zustand";

export type Role = "user" | "assistant";

export type MediaAttachment = {
  kind: "image" | "video" | "pdf" | "audio";
  content: string;
  name?: string;
};

export type ChatMessage = {
  role: Role;
  text: string;
  media?: MediaAttachment[];
};

export type SessionItem = {
  id: string;
  title: string;
  updated_at?: string;
};

type ChatState = {
  sessions: SessionItem[];
  activeSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  language: string;
  setLanguage: (lang: string) => void;
  setSessions: (sessions: SessionItem[]) => void;
  setActiveSession: (id: string | null) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  clearSessionMessages: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  language: "auto",
  setLanguage: (language) => set({ language }),
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setMessages: (sessionId, messages) =>
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
    })),
  appendMessage: (sessionId, message) =>
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [...(state.messagesBySession[sessionId] ?? []), message],
      },
    })),
  clearSessionMessages: (sessionId) =>
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: [] },
    })),
  removeSession: (sessionId) =>
    set((state) => {
      const nextSessions = state.sessions.filter((s) => s.id !== sessionId);
      const nextMessages = { ...state.messagesBySession };
      delete nextMessages[sessionId];
      const nextActive =
        state.activeSessionId === sessionId
          ? null
          : state.activeSessionId;
      return {
        sessions: nextSessions,
        messagesBySession: nextMessages,
        activeSessionId: nextActive,
      };
    }),
  updateSessionTitle: (sessionId, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, title } : s,
      ),
    })),
}));
