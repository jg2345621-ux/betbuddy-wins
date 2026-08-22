import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";

export type Thread = { id: string; title: string; updated_at: string };

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, email, ready };
}

export async function listThreads(): Promise<Thread[]> {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createThread(userId: string, title = "Nueva conversación") {
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ user_id: userId, title })
    .select("id, title, updated_at")
    .single();
  if (error) throw error;
  return data as Thread;
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("chat_threads").delete().eq("id", id);
  if (error) throw error;
}

export async function renameThread(id: string, title: string) {
  const { error } = await supabase
    .from("chat_threads")
    .update({ title: title.slice(0, 60) })
    .eq("id", id);
  if (error) throw error;
}

export async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as UIMessage["role"],
    parts: (row.parts ?? []) as UIMessage["parts"],
  }));
}

export async function saveThreadMessage(
  threadId: string,
  userId: string,
  message: UIMessage,
) {
  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    user_id: userId,
    role: message.role,
    parts: message.parts as unknown as never,
  });
  if (error) console.error("No se pudo guardar el mensaje", error);
  await supabase
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
}

export function messageText(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}
