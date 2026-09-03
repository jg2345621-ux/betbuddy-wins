import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceder — BetRoll" },
      {
        name: "description",
        content:
          "Inicia sesión en BetRoll para guardar tu bankroll, tus apuestas y tus límites en la nube.",
      },
      { property: "og:title", content: "Acceder — BetRoll" },
      {
        property: "og:description",
        content: "Guarda tu bankroll y tus límites en la nube con tu cuenta de BetRoll.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "update">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && mode !== "update") navigate({ to: "/", replace: true });
    });

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Revisa tu correo", {
          description: "Te enviamos un enlace para crear una contraseña nueva.",
        });
        setMode("signin");
      } else if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Contraseña actualizada", { description: "Ya puedes usar tu cuenta." });
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Cuenta creada", { description: "Tu bankroll ya se guarda en la nube." });
          navigate({ to: "/", replace: true });
        } else {
          toast.success("Cuenta creada", {
            description: "Revisa tu correo para confirmar la cuenta.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const description = message.toLowerCase().includes("invalid login credentials")
        ? "El correo o la contraseña no coinciden. Restablece tu contraseña si no la recuerdas."
        : message.toLowerCase().includes("user already registered")
          ? "Este correo ya tiene una cuenta. Entra o restablece tu contraseña."
          : message || "Intenta de nuevo.";
      toast.error("No se pudo continuar", {
        description,
      });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (err) {
      toast.error("No se pudo abrir Google", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      });
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-[#FFD60A] text-black">
          <TrendingUp className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            XSAAC <span className="text-[#FFD60A]">BANKROLL</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Entra para guardar tus picks, tu banca y tu historial
          </p>
        </div>
      </div>

      <div className="rounded-[22px] border border-white/[0.08] bg-[#131314] p-6">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white text-[15px] font-bold text-black transition hover:brightness-95 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.4z"
              />
              <path
                fill="#FBBC05"
                d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6.1C.9 16.7 0 20.2 0 24s.9 7.3 2.6 10.4l7.8-5.7z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.3 0-11.7-3.7-13.6-9.3l-7.8 5.7C6.5 42.6 14.6 48 24 48z"
              />
            </svg>
          )}
          Continuar con Google
        </button>

        <button
          type="button"
          disabled
          className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#229ED9]/25 text-[15px] font-bold text-[#8ed3f0] disabled:cursor-not-allowed"
        >
          <Send className="size-5" /> Entrar con Telegram (pronto)
        </button>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          Al continuar aceptas que esto es información de entretenimiento, no asesoría financiera.
          +18.
        </p>
      </div>

      <Link to="/" className="mt-6 text-center text-xs text-muted-foreground hover:underline">
        Volver al dashboard
      </Link>
    </main>
  );
}

