import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Cierra la sesión de cualquier usuario marcado como desactivado por el admin.
export function SuspensionGuard() {
  useEffect(() => {
    const check = async (uid: string | undefined) => {
      if (!uid) return;
      const { data } = await supabase
        .from("suspended_users")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) {
        await supabase.auth.signOut();
        toast.error("Tu cuenta está desactivada", {
          description: "Contacta a xsaac para reactivar tu acceso.",
          duration: 10000,
        });
        if (window.location.pathname !== "/auth") window.location.assign("/auth");
      }
    };
    supabase.auth.getSession().then(({ data }) => void check(data.session?.user.id));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") void check(session?.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
