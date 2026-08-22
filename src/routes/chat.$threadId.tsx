import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ChatNav, SignInPrompt } from "@/components/chat-nav";
import {
  deleteThread,
  loadThreadMessages,
  messageText,
  renameThread,
  saveThreadMessage,
  useSession,
} from "@/lib/chat-data";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversación con Coach BetRoll" },
      {
        name: "description",
        content:
          "Chat con el asistente de bankroll de BetRoll sobre stakes, límites y control de riesgo.",
      },
      { property: "og:title", content: "Conversación con Coach BetRoll" },
      {
        property: "og:description",
        content: "Asistente IA para gestionar tu bankroll de apuestas con disciplina.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { userId, ready } = useSession();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    setInitial(null);
    loadThreadMessages(threadId)
      .then(setInitial)
      .catch(() => {
        toast.error("No se pudo cargar la conversación");
        setInitial([]);
      });
  }, [threadId, userId]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 md:px-8">
      <ChatNav active="ia" />
      {ready && !userId ? (
        <SignInPrompt text="Inicia sesión para chatear con el asistente." />
      ) : initial === null ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <ChatWindow key={threadId} threadId={threadId} userId={userId!} initial={initial} />
      )}
    </main>
  );
}

function ChatWindow({
  threadId,
  userId,
  initial,
}: {
  threadId: string;
  userId: string;
  initial: UIMessage[];
}) {
  const navigate = useNavigate();
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: () => toast.error("El asistente no pudo responder. Intenta de nuevo."),
  });
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(new Set(initial.map((m) => m.id)));
  const titled = useRef(initial.length > 0);

  const busy = status === "submitted" || status === "streaming";

  // Guarda en la nube los mensajes nuevos cuando termina la respuesta
  useEffect(() => {
    if (status !== "ready") return;
    messages.forEach((m) => {
      if (saved.current.has(m.id)) return;
      saved.current.add(m.id);
      void saveThreadMessage(threadId, userId, m);
      if (!titled.current && m.role === "user") {
        titled.current = true;
        void renameThread(threadId, messageText(m) || "Nueva conversación");
      }
    });
  }, [messages, status, threadId, userId]);

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  };

  const remove = async () => {
    await deleteThread(threadId);
    navigate({ to: "/chat" });
  };

  return (
    <section className="surface mt-6 flex h-[68vh] flex-col p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4 text-primary" /> Coach BetRoll
        </p>
        <button
          onClick={remove}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <Trash2 className="size-3.5" /> Borrar chat
        </button>
      </div>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Pregunta algo como: “¿Qué stake me conviene con un bankroll de $5,000 y stop-loss del
              10%?”
            </p>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                <MessageResponse>{messageText(m)}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>Pensando…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={submit} className="mt-3">
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta sobre bankroll…"
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} disabled={busy || !input.trim()} />
        </PromptInputFooter>
      </PromptInput>
    </section>
  );
}
