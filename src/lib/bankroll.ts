import { useCallback, useEffect, useState } from "react";

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

export function useBankroll() {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        setState({
          settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
          bets: Array.isArray(parsed.bets) ? parsed.bets : [],
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addBet = useCallback((bet: Omit<Bet, "id" | "createdAt">) => {
    setState((s) => ({
      ...s,
      bets: [
        { ...bet, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
        ...s.bets,
      ],
    }));
  }, []);

  const removeBet = useCallback((id: string) => {
    setState((s) => ({ ...s, bets: s.bets.filter((b) => b.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const resetSession = useCallback(() => {
    setState((s) => ({
      settings: { ...s.settings, initialBankroll: Math.max(0, computeMetrics(s).bankroll) },
      bets: [],
    }));
  }, []);

  return { state, hydrated, addBet, removeBet, updateSettings, resetSession };
}

export const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
