import type { UIMessage } from "ai";

export type Thread = { id: string; title: string; updatedAt: number; messages: UIMessage[] };
const KEY = "fortaleza-fide-hilos";

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Thread[];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  localStorage.setItem(KEY, JSON.stringify(threads));
  window.dispatchEvent(new Event("threads-changed"));
}

export function createThread(): Thread {
  const t: Thread = {
    id: crypto.randomUUID().slice(0, 8),
    title: "Nueva conversación",
    updatedAt: Date.now(),
    messages: [],
  };
  saveThreads([t, ...loadThreads()]);
  return t;
}

export function ensureThread(id: string): Thread {
  const all = loadThreads();
  const found = all.find((t) => t.id === id);
  if (found) return found;
  const t: Thread = { id, title: "Nueva conversación", updatedAt: Date.now(), messages: [] };
  saveThreads([t, ...all]);
  return t;
}

export function updateThread(id: string, messages: UIMessage[]) {
  const all = loadThreads();
  const firstText = messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text");
  const title =
    firstText && "text" in firstText ? firstText.text.slice(0, 48) : "Nueva conversación";
  saveThreads(
    all
      .map((t) => (t.id === id ? { ...t, messages, title, updatedAt: Date.now() } : t))
      .sort((a, b) => b.updatedAt - a.updatedAt),
  );
}

export function deleteThread(id: string) {
  saveThreads(loadThreads().filter((t) => t.id !== id));
}

// Pregunta pendiente para una conversación nueva (desde un gráfico o alerta). Se pasa por
// sessionStorage para no depender de la URL, que al cambiar remonta la ventana del chat.
const PENDIENTE = "fortaleza-fide-pendiente";

export function guardarPreguntaPendiente(threadId: string, pregunta: string) {
  sessionStorage.setItem(PENDIENTE, JSON.stringify({ threadId, pregunta }));
}

export function tomarPreguntaPendiente(threadId: string): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDIENTE) ?? "null") as {
      threadId: string;
      pregunta: string;
    } | null;
    if (v?.threadId !== threadId) return null;
    sessionStorage.removeItem(PENDIENTE);
    return v.pregunta;
  } catch {
    return null;
  }
}
