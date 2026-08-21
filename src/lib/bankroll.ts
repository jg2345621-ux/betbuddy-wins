import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type BetResult = "won" | "lost" | "void";

export type Bet = {
  id: string;
  event: string;
  stake: number;
  odds: number;
  result: BetResult;
  createdAt: string;
};

export type Settings = {
  initialBankroll: number;
  stopLossPct: number;
  stopWinPct: number;
};

export type State = {
  settings: Settings;
  bets: Bet[];
};

export const DEFAULT_STATE: State = {
  settings: {
    initialBankroll: 1000,
    stopLossPct: 10,
    stopWinPct: 20,
  },
  bets: [],
};

const KEY = "betroll.state.v1";

export function profitOf(bet: Bet): number {
  if (bet.result === "won") return bet.stake * (bet.odds - 1);
  if (bet.result === "lost") return -bet.stake;
  return 0;
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export type Metrics = {
  initial: number;
  profit: number;
  bankroll: number;
  lossLimit: number;
  winLimit: number;
  lossUsedPct: number;
  winUsedPct: number;
  locked: boolean;
  lockReason: "loss" | "win" | null;
  settled: number;
  wins: number;
  losses: number;
  winRate: number;
  staked: number;
  roi: number;
};

export function computeMetrics(state: State): Metrics {
  const { initialBankroll, stopLossPct, stopWinPct } = state.settings;
  const bets = state.bets;
  const profit = bets.reduce((acc, b) => acc + profitOf(b), 0);
  const bankroll = initialBankroll + profit;
  const lossLimit = (initialBankroll * stopLossPct) / 100;
  const winLimit = (initialBankroll * stopWinPct) / 100;
  const lossUsedPct = lossLimit > 0 ? Math.min(100, (Math.max(0, -profit) / lossLimit) * 100) : 0;
  const winUsedPct = winLimit > 0 ? Math.min(100, (Math.max(0, profit) / winLimit) * 100) : 0;
  const settledBets = bets.filter((b) => b.result !== "void");
  const wins = bets.filter((b) => b.result === "won").length;
  const losses = bets.filter((b) => b.result === "lost").length;
  const staked = settledBets.reduce((acc, b) => acc + b.stake, 0);

  const lockReason: Metrics["lockReason"] =
    profit <= -lossLimit && lossLimit > 0 ? "loss" : profit >= winLimit && winLimit > 0 ? "win" : null;

  return {
    initial: initialBankroll,
    profit,
    bankroll,
    lossLimit,
    winLimit,
    lossUsedPct,
    winUsedPct,
    locked: lockReason !== null,
    lockReason,
    settled: settledBets.length,
    wins,
    losses,
    winRate: settledBets.length ? (wins / settledBets.length) * 100 : 0,
    staked,
    roi: staked ? (profit / staked) * 100 : 0,
  };
}

/** Riesgo proyectado de una apuesta antes de registrarla. */
export function projectRisk(
  state: State,
  bet: { stake: number; odds: number; result: BetResult },
): { lossUsedPct: number; wouldLock: boolean } {
  const next: State = {
    ...state,
    bets: [
      { ...bet, id: "preview", event: "", createdAt: new Date().toISOString() },
      ...state.bets,
    ],
  };
  const m = computeMetrics(next);
  return { lossUsedPct: m.lossUsedPct, wouldLock: m.lockReason === "loss" };
}

/** Peor escenario: la apuesta se pierde. */
export function projectWorstCase(state: State, stake: number) {
  return projectRisk(state, { stake, odds: 1, result: "lost" });
}

function readLocal(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as State;
    return {
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeLocal(state: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento no disponible */
  }
}

type Row = {
  id: string;
  event: string;
  stake: number | string;
  odds: number | string;
  result: string;
  created_at: string;
};

function rowToBet(r: Row): Bet {
  return {
    id: r.id,
    event: r.event ?? "",
    stake: Number(r.stake),
    odds: Number(r.odds),
    result: r.result as BetResult,
    createdAt: r.created_at,
  };
}

export function useBankroll() {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const cloud = !!session;
  const userId = session?.user.id ?? null;

  // Sesión de la nube
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Carga inicial local (siempre disponible aunque no haya sesión)
  useEffect(() => {
    setState(readLocal());
    setHydrated(true);
  }, []);

  // Carga / migración desde la nube
  useEffect(() => {
    if (!userId || !hydrated) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      const [{ data: settingsRow }, { data: betRows }] = await Promise.all([
        supabase.from("bankroll_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("bets").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const local = stateRef.current;
      let settings: Settings = settingsRow
        ? {
            initialBankroll: Number(settingsRow.initial_bankroll),
            stopLossPct: Number(settingsRow.stop_loss_pct),
            stopWinPct: Number(settingsRow.stop_win_pct),
          }
        : local.settings;

      let bets: Bet[] = (betRows ?? []).map((r) => rowToBet(r as Row));

      if (!settingsRow) {
        await supabase.from("bankroll_settings").upsert({
          user_id: userId,
          initial_bankroll: settings.initialBankroll,
          stop_loss_pct: settings.stopLossPct,
          stop_win_pct: settings.stopWinPct,
        });
      }

      // Primera sincronización: sube las apuestas locales
      if (bets.length === 0 && local.bets.length > 0) {
        const { data: inserted } = await supabase
          .from("bets")
          .insert(
            local.bets.map((b) => ({
              user_id: userId,
              event: b.event,
              stake: b.stake,
              odds: b.odds,
              result: b.result,
              created_at: b.createdAt,
            })),
          )
          .select();
        if (inserted) bets = inserted.map((r) => rowToBet(r as Row));
      }

      if (!cancelled) {
        setState({ settings, bets });
        setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hydrated]);

  // Respaldo local siempre activo (sobrevive a refrescos, incluso con sesión)
  useEffect(() => {
    if (!hydrated) return;
    writeLocal(state);
  }, [state, hydrated]);

  const addBet = useCallback(
    (bet: Omit<Bet, "id" | "createdAt">) => {
      const local: Bet = { ...bet, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      setState((s) => ({ ...s, bets: [local, ...s.bets] }));
      if (userId) {
        void supabase
          .from("bets")
          .insert({
            id: local.id,
            user_id: userId,
            event: local.event,
            stake: local.stake,
            odds: local.odds,
            result: local.result,
            created_at: local.createdAt,
          })
          .then(({ error }) => {
            if (error) console.error("[bets.insert]", error.message);
          });
      }
    },
    [userId],
  );

  const removeBet = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, bets: s.bets.filter((b) => b.id !== id) }));
      if (userId) void supabase.from("bets").delete().eq("id", id).eq("user_id", userId);
    },
    [userId],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setState((s) => {
        const settings = { ...s.settings, ...patch };
        if (userId) {
          void supabase.from("bankroll_settings").upsert({
            user_id: userId,
            initial_bankroll: settings.initialBankroll,
            stop_loss_pct: settings.stopLossPct,
            stop_win_pct: settings.stopWinPct,
          });
        }
        return { ...s, settings };
      });
    },
    [userId],
  );

  const resetSession = useCallback(() => {
    setState((s) => {
      const settings = {
        ...s.settings,
        initialBankroll: Math.max(0, computeMetrics(s).bankroll),
      };
      if (userId) {
        void supabase.from("bets").delete().eq("user_id", userId);
        void supabase.from("bankroll_settings").upsert({
          user_id: userId,
          initial_bankroll: settings.initialBankroll,
          stop_loss_pct: settings.stopLossPct,
          stop_win_pct: settings.stopWinPct,
        });
      }
      return { settings, bets: [] };
    });
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    state,
    hydrated,
    cloud,
    syncing,
    email: session?.user.email ?? null,
    addBet,
    removeBet,
    updateSettings,
    resetSession,
    signOut,
  };
}

export const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
