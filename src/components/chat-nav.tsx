import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, Users } from "lucide-react";

export function ChatNav({ active }: { active: "comunidad" | "ia" }) {
  const base =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors";
  const on = "border-primary bg-primary/15 text-primary";
  const off = "border-border bg-secondary text-muted-foreground hover:bg-accent";
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        <ArrowLeft className="size-4" /> Panel
      </Link>
      <nav className="flex items-center gap-2">
        <Link to="/comunidad" className={`${base} ${active === "comunidad" ? on : off}`}>
          <Users className="size-4" /> Comunidad
        </Link>
        <Link to="/chat" className={`${base} ${active === "ia" ? on : off}`}>
          <Bot className="size-4" /> Asistente IA
        </Link>
      </nav>
    </header>
  );
}

export function SignInPrompt({ text }: { text: string }) {
  return (
    <div className="surface mt-8 p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        to="/auth"
        className="gold-btn mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
      >
        Iniciar sesión
      </Link>
    </div>
  );
}
