import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calculator,
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
  Lock,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  computeMetrics,
  money,
  profitOf,
  projectWorstCase,
  useBankroll,
  type BetResult,
} from "@/lib/bankroll";

type PendingBet = { event: string; stake: number; odds: number; result: BetResult };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BetRoll — Gestor de bankroll con stop-loss y stop-win" },
      {
        name: "description",
        content:
          "Controla tu bankroll de apuestas con límites de pérdida y ganancia en porcentaje y estadísticas en tiempo real.",
      },
      { property: "og:title", content: "BetRoll — Gestor de bankroll de apuestas" },
      {
        property: "og:description",
        content:
          "Define stop-loss y stop-win en % de tu bankroll, registra apuestas y bloquea la sesión al alcanzar tus límites.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const {
    state,
    hydrated,
    cloud,
    syncing,
    email,
    addBet,
    removeBet,
    updateSettings,
    resetSession,
    signOut,
  } = useBankroll();
  const m = useMemo(() => computeMetrics(state), [state]);
  const [pending, setPending] = useState<PendingBet | null>(null);
  const notified = useRef(0);

  // Avisos automáticos al 50% y 80% del stop-loss
  useEffect(() => {
    if (!hydrated) return;
    const used = m.lossUsedPct;
    if (used < 50) {
      notified.current = 0;
      return;
    }
    if (m.locked) return;
    const level = used >= 80 ? 80 : 50;
    if (notified.current >= level) return;
    notified.current = level;
    const restante = Math.max(0, m.lossLimit + m.profit);
    if (level === 80) {
      toast.error("Estás al 80% de tu stop-loss", {
        description: `Solo te quedan ${money(restante)} antes de alcanzar el límite de pérdida.`,
      });
    } else {
      toast.warning("Vas al 50% de tu stop-loss", {
        description: `Te quedan ${money(restante)} de margen en esta sesión.`,
      });
    }
  }, [m.lossUsedPct, m.locked, m.lossLimit, m.profit, hydrated]);

  const requestAdd = (bet: PendingBet) => {
    if (m.locked) return;
    const risk = projectWorstCase(state, bet.stake);
    if (risk.wouldLock || risk.lossUsedPct >= 80) {
      setPending(bet);
      return;
    }
    addBet(bet);
  };

  const worst = pending ? projectWorstCase(state, pending.stake) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <Header
        onReset={resetSession}
        cloud={cloud}
        syncing={syncing}
        email={email}
        onSignOut={signOut}
      />

      {m.locked && <LockBanner reason={m.lockReason!} />}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Bankroll actual"
          value={money(m.bankroll)}
          hint={`Inicial ${money(m.initial)}`}
          icon={<Activity className="size-4" />}
        />
        <Stat
          label="Resultado"
          value={`${m.profit >= 0 ? "+" : ""}${money(m.profit)}`}
          hint={`ROI ${m.roi.toFixed(1)}%`}
          tone={m.profit > 0 ? "up" : m.profit < 0 ? "down" : "flat"}
          icon={m.profit < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
        />
        <Stat
          label="Acierto"
          value={`${m.winRate.toFixed(0)}%`}
          hint={`${m.wins}G · ${m.losses}P · ${m.settled} resueltas`}
          icon={<Trophy className="size-4" />}
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <Shield className="size-4 text-primary" /> Límites de la sesión
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <LimitBar
              title="Stop-loss"
              subtitle={`${state.settings.stopLossPct}% · ${money(m.lossLimit)}`}
              used={m.lossUsedPct}
              current={money(Math.max(0, -m.profit))}
              tone="down"
            />
            <LimitBar
              title="Stop-win"
              subtitle={`${state.settings.stopWinPct}% · ${money(m.winLimit)}`}
              used={m.winUsedPct}
              current={money(Math.max(0, m.profit))}
              tone="up"
            />
          </div>
          <EquityChart bets={state.bets} initial={m.initial} />
        </div>

        <SettingsCard settings={state.settings} onChange={updateSettings} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <BetForm locked={m.locked} onAdd={requestAdd} />
        <div className="surface p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <BarChart3 className="size-4 text-primary" /> Historial
          </h2>
          {!hydrated || state.bets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aún no registras apuestas en esta sesión.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {state.bets.map((b) => {
                const p = profitOf(b);
                return (
                  <li key={b.id} className="flex items-center gap-3 py-3">
                    <ResultTag result={b.result} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.event || "Apuesta"}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(b.stake)} @ {b.odds.toFixed(2)} ·{" "}
                        {new Date(b.createdAt).toLocaleString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        p > 0 ? "text-success" : p < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {p > 0 ? "+" : ""}
                      {money(p)}
                    </span>
                    <button
                      onClick={() => removeBet(b.id)}
                      aria-label="Eliminar apuesta"
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Juega con responsabilidad.{" "}
        {cloud
          ? "Tus datos se guardan en tu cuenta y en este navegador."
          : "Tus datos se guardan en este navegador; inicia sesión para conservarlos en la nube."}
      </p>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {worst?.wouldLock ? "Esta apuesta puede cerrar tu sesión" : "Te acercas a tu stop-loss"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `Si pierdes ${money(pending.stake)} llegarías al ${worst?.lossUsedPct.toFixed(0)}% de tu límite de pérdida (${money(m.lossLimit)}). ${
                    worst?.wouldLock
                      ? "Se bloquearán las nuevas apuestas de esta sesión."
                      : "Considera reducir el importe."
                  }`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) addBet(pending);
                setPending(null);
              }}
            >
              Registrar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Header({
  onReset,
  cloud,
  syncing,
  email,
  onSignOut,
}: {
  onReset: () => void;
  cloud: boolean;
  syncing: boolean;
  email: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="gold-btn flex size-11 items-center justify-center">
          <TrendingUp className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            BET<span className="gold-text">ROLL</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Gestiona tu bankroll de apuestas con inteligencia y precisión
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {cloud ? (
          <>
            <span
              title={email ?? undefined}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Cloud className="size-4 text-success" />
              )}
              <span className="max-w-[9rem] truncate">{email ?? "Sincronizado"}</span>
            </span>
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <LogOut className="size-4" /> Salir
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <CloudOff className="size-4" /> Guardar en la nube
          </Link>
        )}
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <RotateCcw className="size-4" /> Nueva sesión
        </button>
      </div>
    </header>
  );
}

function LockBanner({ reason }: { reason: "loss" | "win" }) {
  const loss = reason === "loss";
  return (
    <div
      className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${
        loss ? "border-destructive/40 bg-destructive/10" : "border-success/40 bg-success/10"
      }`}
    >
      {loss ? (
        <AlertTriangle className="mt-0.5 size-5 text-destructive" />
      ) : (
        <Trophy className="mt-0.5 size-5 text-success" />
      )}
      <div>
        <p className="text-sm font-semibold">
          {loss ? "Stop-loss alcanzado" : "Stop-win alcanzado"}
        </p>
        <p className="text-sm text-muted-foreground">
          {loss
            ? "Detén la sesión de hoy. Registrar nuevas apuestas está bloqueado hasta que inicies una nueva sesión."
            : "Objetivo cumplido: asegura la ganancia y cierra la sesión."}
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone = "flat",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "up" | "down" | "flat";
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function LimitBar({
  title,
  subtitle,
  used,
  current,
  tone,
}: {
  title: string;
  subtitle: string;
  used: number;
  current: string;
  tone: "up" | "down";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${
            tone === "down" ? "bg-destructive" : "bg-success"
          }`}
          style={{ width: `${used}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {current} usado · {used.toFixed(0)}% del límite
      </p>
    </div>
  );
}

function EquityChart({
  bets,
  initial,
}: {
  bets: ReturnType<typeof useBankroll>["state"]["bets"];
  initial: number;
}) {
  const data = useMemo(() => {
    let running = initial;
    const points = [{ i: 0, bankroll: initial }];
    [...bets].reverse().forEach((b, idx) => {
      running += profitOf(b);
      points.push({ i: idx + 1, bankroll: Number(running.toFixed(2)) });
    });
    return points;
  }, [bets, initial]);

  return (
    <div className="mt-6 h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 4, top: 8 }}>
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="i" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={60} />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(v: number) => [money(v), "Bankroll"]}
            labelFormatter={(l) => `Apuesta ${l}`}
          />
          <Area
            type="monotone"
            dataKey="bankroll"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#eq)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SettingsCard({
  settings,
  onChange,
}: {
  settings: ReturnType<typeof useBankroll>["state"]["settings"];
  onChange: (patch: Partial<ReturnType<typeof useBankroll>["state"]["settings"]>) => void;
}) {
  const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v)));
  return (
    <div className="surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <Calculator className="size-4 text-primary" /> Configuración
      </h2>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm text-muted-foreground">Bankroll inicial</span>
          <input
            type="number"
            className="field mt-1"
            value={settings.initialBankroll}
            onChange={(e) => onChange({ initialBankroll: num(e.target.value) })}
          />
        </label>
        <Slider
          label="Stop-loss (% del bankroll)"
          value={settings.stopLossPct}
          max={50}
          onChange={(v) => onChange({ stopLossPct: v })}
        />
        <Slider
          label="Stop-win (% del bankroll)"
          value={settings.stopWinPct}
          max={100}
          onChange={(v) => onChange({ stopWinPct: v })}
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <span className="font-semibold text-primary">{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
    </label>
  );
}

function BetForm({
  locked,
  onAdd,
}: {
  locked: boolean;
  onAdd: (bet: { event: string; stake: number; odds: number; result: BetResult }) => void;
}) {
  const [event, setEvent] = useState("");
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("1.90");
  const [result, setResult] = useState<BetResult>("won");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const s = Number(stake);
    const o = Number(odds);
    if (!s || !o) return;
    onAdd({ event: event.trim(), stake: s, odds: o, result });
    setEvent("");
    setStake("");
  };

  return (
    <form onSubmit={submit} className="surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <Plus className="size-4 text-primary" /> Registrar apuesta
      </h2>
      <div className="mt-4 space-y-3">
        <input
          className="field"
          placeholder="Evento (ej. Real Madrid vs Barça)"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="field"
            type="number"
            step="0.01"
            placeholder="Stake"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <input
            className="field"
            type="number"
            step="0.01"
            placeholder="Cuota"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["won", "lost", "void"] as BetResult[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResult(r)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                result === r
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              {r === "won" ? "Ganada" : r === "lost" ? "Perdida" : "Anulada"}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={locked}
          className="gold-btn flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {locked ? <Lock className="size-4" /> : <Plus className="size-4" />}
          {locked ? "Sesión bloqueada" : "Agregar apuesta"}
        </button>
      </div>
    </form>
  );
}

function ResultTag({ result }: { result: BetResult }) {
  const map = {
    won: { t: "G", c: "bg-success/15 text-success" },
    lost: { t: "P", c: "bg-destructive/15 text-destructive" },
    void: { t: "A", c: "bg-secondary text-muted-foreground" },
  } as const;
  const { t, c } = map[result];
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${c}`}>
      {t}
    </span>
  );
}
