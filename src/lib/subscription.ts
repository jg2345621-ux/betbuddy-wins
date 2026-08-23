import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus = "free" | "vip";

export function useSubscription() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>("free");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setStatus("free");
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("user_id", uid)
      .maybeSingle();
    if (!data) {
      await supabase.from("profiles").insert({ user_id: uid }).select().maybeSingle();
      setStatus("free");
    } else {
      setStatus(data.subscription_status === "vip" ? "vip" : "free");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const activateVip = useCallback(async () => {
    if (!userId) return false;
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        subscription_status: "vip",
        vip_since: now.toISOString(),
        vip_expires_at: expires.toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return false;
    setStatus("vip");
    return true;
  }, [userId]);

  const cancelVip = useCallback(async () => {
    if (!userId) return false;
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_status: "free", vip_expires_at: null })
      .eq("user_id", userId);
    if (error) return false;
    setStatus("free");
    return true;
  }, [userId]);

  return {
    userId,
    isVip: status === "vip",
    status,
    loading,
    signedIn: Boolean(userId),
    activateVip,
    cancelVip,
  };
}
