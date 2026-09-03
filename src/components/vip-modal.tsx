import { useState } from "react";
import { Check, Crown, ExternalLink, Loader2, X } from "lucide-react";

const BENEFITS = [
  "Picks VIP de xsaac antes que nadie",
  "Análisis de cuotas y valor esperado",
  "Alertas de gestión de bankroll",
  "Sala privada de la comunidad",
];

const MERCADO_PAGO_LINK = "https://mpago.la/xsaac";

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
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const pay = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    await onActivate("Mercado Pago");
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md rounded-[22px] border border-white/[0.08] bg-[#131314] p-6">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <span className="grid size-11 place-items-center rounded-xl bg-[#FFD60A] text-black">
          <Crown className="size-6" />
        </span>
        <h2 className="mt-3 text-xl font-bold tracking-tight">
          Pase <span className="text-[#FFD60A]">VIP de xsaac</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paga con <span className="font-semibold text-foreground">Mercado Pago de xsaac</span> —
          link directo. Acceso inmediato por $300 MXN al mes.
        </p>

        <ul className="mt-4 space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> {b}
            </li>
          ))}
        </ul>

        <a
          href={MERCADO_PAGO_LINK}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFD60A] text-[14px] font-extrabold text-black transition hover:brightness-110"
        >
          Pagar $300 MXN con Mercado Pago <ExternalLink className="size-4" />
        </a>

        <button
          disabled={!signedIn || busy}
          onClick={pay}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[13px] font-semibold transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin text-[#FFD60A]" />}
          Ya pagué, activar mi VIP
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {signedIn
            ? "Tras confirmar tu pago con xsaac, activa aquí tu acceso VIP."
            : "Inicia sesión para activar tu pase VIP."}
        </p>
      </div>
    </div>
  );
}
