import { useState } from "react";
import { Check, Crown, Loader2, X } from "lucide-react";

const BENEFITS = [
  "Picks VIP de xsaac antes que nadie",
  "Análisis de cuotas y valor esperado",
  "Alertas de gestión de bankroll",
  "Sala privada de la comunidad",
];

const METHODS = [
  { id: "patreon", label: "Patreon", note: "Suscripción mensual" },
  { id: "discord", label: "Discord VIP", note: "Acceso al canal privado" },
  { id: "stripe", label: "Tarjeta (Stripe)", note: "Pago con tarjeta" },
] as const;

export function VipModal({
  open,
  onClose,
  onActivate,
  signedIn,
}: {
  open: boolean;
  onClose: () => void;
  onActivate: (method: string) => Promise<void>;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!open) return null;

  const pay = async (method: string) => {
    setBusy(method);
    await new Promise((r) => setTimeout(r, 900));
    await onActivate(method);
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="surface relative w-full max-w-md p-6">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <span className="gold-btn inline-flex size-11 items-center justify-center">
          <Crown className="size-6" />
        </span>
        <h2 className="mt-3 text-xl font-bold tracking-tight">
          Pase <span className="gold-text">VIP de xsaac</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Desbloquea todos los picks oficiales del streamer y el seguimiento premium de bankroll.
        </p>

        <ul className="mt-4 space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> {b}
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              disabled={!signedIn || busy !== null}
              onClick={() => pay(m.label)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.note}</span>
              </span>
              {busy === m.label ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <span className="text-xs font-bold text-primary">Activar</span>
              )}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {signedIn
            ? "Pago simulado con fines de demostración. No se realiza ningún cargo real."
            : "Inicia sesión para activar tu pase VIP."}
        </p>
      </div>
    </div>
  );
}
