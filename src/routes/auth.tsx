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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="gold-btn flex size-11 items-center justify-center">
          <TrendingUp className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            BET<span className="gold-text">ROLL</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Guarda tu bankroll y tus límites en la nube
          </p>
        </div>
      </div>

      <div className="surface p-6">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-muted-foreground">Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="field mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              disabled={mode === "update"}
            />
          </label>
          {mode !== "reset" && (
            <label className="block">
              <span className="text-sm text-muted-foreground">
                {mode === "update" ? "Nueva contraseña" : "Contraseña"}
              </span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="field mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </label>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="gold-btn flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {mode === "signup"
              ? "Crear cuenta"
              : mode === "reset"
                ? "Enviar enlace"
                : mode === "update"
                  ? "Guardar contraseña"
                  : "Entrar"}
          </Button>
        </form>

        {mode !== "update" && (
          <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              {mode === "signup" ? "¿Ya tienes cuenta?" : mode === "reset" ? "¿Recordaste tu contraseña?" : "¿Aún no tienes cuenta?"}{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-semibold text-primary"
                onClick={() => setMode(mode === "signup" || mode === "reset" ? "signin" : "signup")}
              >
                {mode === "signup" || mode === "reset" ? "Entrar" : "Crear una"}
              </Button>
            </p>
            {mode === "signin" && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setMode("reset")}
              >
                Olvidé mi contraseña
              </Button>
            )}
          </div>
        )}
      </div>

      <Link to="/" className="mt-6 text-center text-xs text-muted-foreground hover:underline">
        Seguir sin cuenta (datos solo en este navegador)
      </Link>
    </main>
  );
}
