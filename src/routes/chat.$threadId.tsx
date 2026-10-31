import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Plus, Printer, Trash2, ChartNoAxesCombined } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisExplorer } from "@/components/AnalysisExplorer";
import { FideMessage } from "@/components/fide/FideMessage";
import type { FideUIMessage } from "@/lib/fide/writer";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  createThread,
  deleteThread,
  ensureThread,
  loadThreads,
  tomarPreguntaPendiente,
  updateThread,
  type Thread,
} from "@/lib/threads";
import logo from "@/assets/fide.svg";
import logoFortaleza from "@/assets/logo-fortaleza.svg";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Fide · Habla con tus datos · Fortaleza" },
      { name: "description", content: "Conversación con Fide, el agente analítico de Fortaleza." },
      { property: "og:title", content: "Fide · Habla con tus datos" },
      {
        property: "og:description",
        content: "Pregunta sobre ventas, logística, mercado y operadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);

  useEffect(() => {
    setThread(ensureThread(threadId));
    setThreads(loadThreads());
    const h = () => setThreads(loadThreads());
    window.addEventListener("threads-changed", h);
    return () => window.removeEventListener("threads-changed", h);
  }, [threadId]);

  return (
    <div className="flex h-dvh min-h-0 print:block print:h-auto">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex print:hidden">
        <div className="p-3">
          <Button
            onClick={() => {
              const t = createThread();
              navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Nueva conversación
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center rounded-lg ${t.id === threadId ? "bg-secondary" : "hover:bg-muted"}`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 truncate px-3 py-2 text-sm"
              >
                {t.title}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title="Eliminar conversación"
                aria-label="Eliminar"
                onClick={() => {
                  deleteThread(t.id);
                  if (t.id === threadId) {
                    const next = loadThreads()[0] ?? createThread();
                    navigate({ to: "/chat/$threadId", params: { threadId: next.id } });
                  }
                }}
                className="px-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </aside>
      {thread && thread.id === threadId && <ChatWindow key={threadId} thread={thread} />}
    </div>
  );
}

function ChatWindow({ thread }: { thread: Thread }) {
  const [input, setInput] = useState("");
  const [explore, setExplore] = useState(false);
  const [modo, setModo] = useState<{ modo: "demo" | "claude"; modelo?: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const enviada = useRef(false);
  const navigate = useNavigate();
  const { messages, sendMessage, status, stop } = useChat<FideUIMessage>({
    id: thread.id,
    messages: thread.messages as FideUIMessage[],
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => {
      const m = e.message || "";
      // Sesión vencida: volver al login y regresar a esta conversación.
      if (m.includes("Sesión requerida")) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (m.includes("429")) toast.error("Demasiadas consultas, esperá un momento.");
      else toast.error(m || "No se pudo obtener respuesta de Fide.");
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then(setModo)
      .catch(() => setModo(null));
  }, []);

  useEffect(() => {
    if (status === "ready" || status === "error") {
      if (messages.length) updateThread(thread.id, messages);
      ref.current?.focus();
    }
  }, [status, messages, thread.id]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text });
    setInput("");
  };

  // Pregunta que llega desde un gráfico o una alerta: se envía una sola vez.
  useEffect(() => {
    if (enviada.current || messages.length) return;
    // Diferido: con StrictMode el primer montaje se descarta y el envío se perdería.
    const t = setTimeout(() => {
      const pendiente = tomarPreguntaPendiente(thread.id);
      if (pendiente) {
        enviada.current = true;
        send(pendiente);
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3 print:hidden">
        <img src={logo} alt="Fide" width={36} height={36} className="size-9 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display font-semibold">
            Fide
            {modo && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${modo.modo === "claude" ? "bg-success/15 text-success" : "bg-secondary text-secondary-foreground"}`}
                title={
                  modo.modo === "claude"
                    ? `Respuestas generadas con ${modo.modelo}`
                    : "Sin ANTHROPIC_API_KEY: respuestas calculadas con reglas, sin IA"
                }
              >
                {modo.modo === "claude" ? "Claude" : "Modo demo"}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Agente analítico de Fortaleza · Habla con tus datos
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            title="Exportar conversación a PDF"
            aria-label="Exportar conversación a PDF"
            onClick={() => window.print()}
          >
            <Printer />
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          title="Explorar preguntas y oportunidades"
          aria-label="Explorar preguntas y oportunidades"
          onClick={() => setExplore((v) => !v)}
        >
          <ChartNoAxesCombined />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="Nueva conversación"
          aria-label="Nueva conversación"
          onClick={() => {
            const t = createThread();
            void navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
          }}
        >
          <Plus />
        </Button>
      </header>
      <div className="hidden px-2 pb-4 print:block">
        <img src={logoFortaleza} alt="Fortaleza Inmuebles" width={160} height={48} />
        <h1 className="mt-3 text-xl font-bold">Informe de Fide · {thread.title}</h1>
        <p className="text-xs text-muted-foreground">
          Hub Analítico Fortaleza · retiros reales Ene 2024 – Abr 2026 + datos ilustrativos ·
          confidencial · {new Date().toLocaleDateString("es-PY")}
        </p>
      </div>
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <img
                src={logo}
                alt="Fide"
                width={80}
                height={80}
                className="mx-auto size-20 object-contain"
              />
              <h2 className="mt-2 text-2xl font-bold">Hola, soy Fide</h2>
              <p className="text-muted-foreground">
                Red de operadores · territorio · tendencias · forecast · mercado · B2B · sitios
              </p>
              <p className="mb-6 mt-2 text-xs text-muted-foreground">
                Retiros reales Ene 2024 – Abr 2026 · lo demás, ilustrativo
                {modo?.modo === "demo" && " · modo demo sin IA"}
              </p>
              <AnalysisExplorer onAsk={send} disabled={busy} />
            </ConversationEmptyState>
          ) : (
            messages.map((m, i) => (
              <FideMessage
                key={m.id}
                mensaje={m}
                ultimo={i === messages.length - 1}
                enCurso={busy && i === messages.length - 1}
                onPreguntar={send}
              />
            ))
          )}
          {status === "submitted" && <Shimmer>Fide está analizando los datos…</Shimmer>}
          {explore && messages.length > 0 && (
            <div className="mt-6 border-t pt-6 print:hidden">
              <AnalysisExplorer
                onAsk={(text) => {
                  send(text);
                  setExplore(false);
                }}
                disabled={busy}
              />
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4 print:hidden">
        <PromptInput onSubmit={(msg) => send(msg.text)}>
          <PromptInputTextarea
            ref={ref}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntale a Fide sobre tus datos…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
