import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChatNav, SignInPrompt } from "@/components/chat-nav";
import { createThread, listThreads, useSession, type Thread } from "@/lib/chat-data";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Asistente IA de bankroll — BetRoll" },
      {
        name: "description",
        content:
          "Conversa con el Coach BetRoll: stakes, stop-loss, valor esperado y disciplina en tus apuestas.",
      },
      { property: "og:title", content: "Asistente IA de bankroll — BetRoll" },
      {
        property: "og:description",
        content: "Consejos de gestión de bankroll y control de riesgo con inteligencia artificial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatHome,
});

function ChatHome() {
  const { userId, ready } = useSession();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    listThreads()
      .then(setThreads)
      .catch(() => toast.error("No se pudieron cargar tus conversaciones"))
      .finally(() => setLoading(false));
  }, [userId]);

  const startNew = async () => {
    if (!userId || creating) return;
    setCreating(true);
    try {
      const t = await createThread(userId);
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    } catch {
      toast.error("No se pudo crear la conversación");
      setCreating(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <ChatNav active="ia" />

      <h1 className="mt-6 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Bot className="size-6 text-primary" /> Coach BetRoll
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tu asistente de gestión de bankroll: stakes, límites, cuotas y disciplina.
      </p>

      {ready && !userId ? (
        <SignInPrompt text="Inicia sesión para guardar tus conversaciones con el asistente." />
      ) : (
        <section className="surface mt-6 p-5">
          <button
            onClick={startNew}
            disabled={creating}
            className="gold-btn flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Nueva conversación
          </button>

          <ul className="mt-4 divide-y divide-border">
            {loading ? (
              <li className="py-8 text-center text-sm text-muted-foreground">Cargando…</li>
            ) : threads.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">
                Aún no tienes conversaciones.
              </li>
            ) : (
              threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() =>
                      navigate({ to: "/chat/$threadId", params: { threadId: t.id } })
                    }
                    className="w-full py-3 text-left transition-colors hover:text-primary"
                  >
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.updated_at).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
