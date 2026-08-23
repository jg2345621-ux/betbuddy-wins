import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChatNav, SignInPrompt } from "@/components/chat-nav";
import { useSession } from "@/lib/chat-data";

type Msg = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

export const Route = createFileRoute("/comunidad")({
  head: () => ({
    meta: [
      { title: "Chat de la comunidad — BetRoll" },
      {
        name: "description",
        content:
          "Sala en vivo de BetRoll para compartir picks, estrategias de bankroll y disciplina con otros apostadores.",
      },
      { property: "og:title", content: "Chat de la comunidad — BetRoll" },
      {
        property: "og:description",
        content: "Habla en tiempo real con otros apostadores sobre picks y gestión de bankroll.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityChat,
});

function CommunityChat() {
  const { userId, email, ready } = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = email?.split("@")[0] ?? "Apostador";

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from("community_messages")
      .select("id, user_id, display_name, content, created_at")
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          toast.error("No se pudieron cargar los mensajes");
          return;
        }
        if (alive) setMessages((data ?? []) as Msg[]);
      });

    const channel = supabase
      .channel("community-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_messages" },
        (payload) =>
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Msg).id)),
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (userId) inputRef.current?.focus();
  }, [userId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !userId || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("community_messages")
      .insert({ user_id: userId, display_name: name, content: content.slice(0, 500) });
    if (error) {
      toast.error("No se pudo enviar el mensaje");
      setText(content);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const remove = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("community_messages").delete().eq("id", id);
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 md:px-8">
      <ChatNav active="comunidad" />

      <h1 className="mt-6 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Users className="size-6 text-primary" /> Chat de la comunidad
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Comparte picks y estrategias en tiempo real. Juega con responsabilidad.
      </p>

      {ready && !userId ? (
        <SignInPrompt text="Inicia sesión para participar en la sala de la comunidad." />
      ) : (
        <section className="surface mt-6 flex h-[60vh] flex-col p-4">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Todavía no hay mensajes. Rompe el hielo.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.user_id === userId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className="group max-w-[80%]">
                      <p className="mb-1 text-xs text-muted-foreground">
                        {mine ? "Tú" : m.display_name} ·{" "}
                        {new Date(m.created_at).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <div
                        className={`rounded-xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-secondary text-foreground"
                        }`}
                      >
                        {m.content}
                      </div>
                      {mine && (
                        <button
                          onClick={() => remove(m.id)}
                          aria-label="Eliminar mensaje"
                          className="mt-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="inline size-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottom} />
          </div>

          <form onSubmit={send} className="mt-4 flex items-center gap-2">
            <input
              ref={inputRef}
              className="field flex-1"
              placeholder="Escribe un mensaje…"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="gold-btn flex size-11 shrink-0 items-center justify-center disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
