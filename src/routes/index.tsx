import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  Crown,
  DollarSign,
  Eye,
  Flame,
  Lock,
  LogIn,
  MessageCircle,
  Pencil,
  Plus,
  Shield,
  Star,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  X,
  Zap,
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
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XSAAC BANKROLL — Picks verificados y gestión de banca" },
      {
        name: "description",
        content:
          "Comunidad oficial de xsaac: picks free y VIP, bankroll con ROI real, gráfica de profit y chat en vivo. Acceso VIP por $300 MXN.",
      },
      { property: "og:title", content: "XSAAC BANKROLL — Picks verificados" },
      {
        property: "og:description",
        content:
          "Picks VIP de xsaac, bankroll automatizado con ROI verificado y gráfica de profit en tiempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const VIP_PRICE = 300;

type PickType = "free" | "vip";
type ResultType = "win" | "loss" | "pending";

type Pick = {
  id: string;
  type: PickType;
  league: string;
  match: string;
  market: string;
  odds: number;
  stake: string;
  confidence: number;
  roi: number;
  analysis: string;
  event_time: string;
  verified: boolean;
  is_active: boolean;
};

type BetRow = {
  id: string;
  event: string;
  odds: number;
  stake: number;
  result: ResultType;
  created_at: string;
};

const BASE_BANKROLL = 25000;

const emptyPick = (): Omit<Pick, "id"> => ({
  type: "free",
  league: "",
  match: "",
  market: "",
  odds: 1.9,
  stake: "2% bankroll",
  confidence: 7,
  roi: 0,
  analysis: "",
  event_time: "",
  verified: false,
  is_active: true,
});

function profitOf(bet: BetRow) {
  if (bet.result === "win") return Math.round(bet.stake * (bet.odds - 1));
  if (bet.result === "loss") return -bet.stake;
  return 0;
}

function Dashboard() {
  const [tab, setTab] = useState<"picks" | "bankroll" | "chat">("picks");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [showVip, setShowVip] = useState(false);
  const [editing, setEditing] = useState<(Omit<Pick, "id"> & { id?: string }) | null>(null);
  const [activating, setActivating] = useState(false);
  const [baseBankroll, setBaseBankroll] = useState(BASE_BANKROLL);


  const signedIn = Boolean(userId);

  /* ---------- sesión + perfil ---------- */
  const syncProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("subscription_status,bankroll_total")
      .eq("user_id", uid)
      .maybeSingle();

    if (!data) {
      await supabase
        .from("profiles")
        .upsert(
          { user_id: uid, subscription_status: "free", bankroll_total: BASE_BANKROLL },
          { onConflict: "user_id" },
        );
      setIsVip(false);
      setBaseBankroll(BASE_BANKROLL);
    } else {
      setIsVip(data.subscription_status === "vip");
      setBaseBankroll(Number(data.bankroll_total ?? BASE_BANKROLL));
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
  }, []);


  useEffect(() => {
    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      setEmail(session?.user.email ?? null);
      if (uid) void syncProfile(uid);
      else {
        setIsVip(false);
        setIsAdmin(false);
        setBets([]);
      }
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, [syncProfile]);

  /* ---------- picks ---------- */
  const loadPicks = useCallback(async () => {
    const { data, error } = await supabase
      .from("picks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No se pudieron cargar los picks");
      return;
    }
    setPicks((data ?? []) as unknown as Pick[]);
  }, []);

  useEffect(() => {
    void loadPicks();
  }, [loadPicks, isAdmin]);

  /* ---------- bankroll ---------- */
  const loadBets = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("bets")
      .select("id,event,odds,stake,result,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    setBets(
      (data ?? []).map((b) => ({
        id: b.id,
        event: b.event,
        odds: Number(b.odds),
        stake: Number(b.stake),
        result: (b.result as ResultType) ?? "pending",
        created_at: b.created_at,
      })),
    );
  }, []);

  useEffect(() => {
    if (userId) void loadBets(userId);
  }, [userId, loadBets]);

  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.result !== "pending");
    const wins = settled.filter((b) => b.result === "win").length;
    const totalProfit = bets.reduce((acc, b) => acc + profitOf(b), 0);
    const winRate = settled.length ? Math.round((wins / settled.length) * 100) : 0;
    const totalStaked = settled.reduce((acc, b) => acc + b.stake, 0);
    const roi = totalStaked ? Number(((totalProfit / totalStaked) * 100).toFixed(1)) : 0;
    return {
      bankrollTotal: baseBankroll + totalProfit,
      totalProfit,
      winRate,
      roi,
      count: bets.length,
      totalStaked,
    };
  }, [bets, baseBankroll]);


  const chartData = useMemo(() => {
    let acc = 0;
    const points = bets.map((b, i) => {
      acc += profitOf(b);
      return {
        name: `#${i + 1}`,
        profit: acc,
        label: b.event,
      };
    });
    return [{ name: "Inicio", profit: 0, label: "Inicio" }, ...points];
  }, [bets]);

  /* ---------- acciones ---------- */
  const addToBankroll = async (pick: Pick) => {
    if (pick.type === "vip" && !isVip) {
      setShowVip(true);
      return;
    }
    if (!userId) {
      toast.info("Inicia sesión para guardar tus apuestas");
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("bankroll_total")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      toast.error("No se pudo leer tu bankroll", { description: profileError.message });
      return;
    }

    const total = Number(profile?.bankroll_total ?? baseBankroll);
    const stakePercent = Number(pick.stake.replace(/[^0-9.]/g, "")) || 2;
    const stakeValue = Math.max(50, Math.round((total * stakePercent) / 100));

    const { data, error } = await supabase
      .from("bets")
      .insert({
        user_id: userId,
        pick_id: pick.id,
        event: `${pick.match} · ${pick.market}`,
        selection: pick.market,
        odds: pick.odds,
        stake: stakeValue,
        stake_percent: stakePercent,
        result: "pending",
      })
      .select("id,event,odds,stake,result,created_at")
      .maybeSingle();

    if (error || !data) {
      toast.error("No se pudo agregar al bankroll", {
        description: error?.message ?? "La base de datos no devolvió la apuesta.",
      });
      return;
    }

    setBets((prev) => [
      ...prev,
      {
        id: data.id,
        event: data.event,
        odds: Number(data.odds),
        stake: Number(data.stake),
        result: "pending",
        created_at: data.created_at,
      },
    ]);
    setTab("bankroll");
    toast.success("Pick agregado a tu bankroll");
  };

  const updateResult = async (id: string, result: ResultType) => {
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, result } : b)));
    const { error } = await supabase.from("bets").update({ result }).eq("id", id);
    if (error) toast.error("No se pudo actualizar el resultado");
  };

  const deleteBet = async (id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("bets").delete().eq("id", id);
  };

  const activateVip = async () => {
    if (!userId) {
      toast.info("Crea tu cuenta para activar el VIP");
      return;
    }
    setActivating(true);
    const now = new Date();
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        subscription_status: "vip",
        vip_since: now.toISOString(),
        vip_expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
      },
      { onConflict: "user_id" },
    );
    setActivating(false);
    if (error) {
      toast.error("No se pudo activar el VIP");
      return;
    }
    setIsVip(true);
    setShowVip(false);
    toast.success(`VIP activado · $${VIP_PRICE} MXN`);
  };

  const savePick = async () => {
    if (!editing) return;
    const { id, ...payload } = editing;
    const res = id
      ? await supabase.from("picks").update(payload).eq("id", id)
      : await supabase.from("picks").insert(payload);
    if (res.error) {
      toast.error("No se pudo guardar el pick");
      return;
    }
    setEditing(null);
    await loadPicks();
    toast.success(id ? "Pick actualizado" : "Pick publicado");
  };

  const deletePick = async (id: string) => {
    const { error } = await supabase.from("picks").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar el pick");
      return;
    }
    setPicks((prev) => prev.filter((p) => p.id !== id));
  };

  const money = (n: number) => `$${n.toLocaleString("es-MX")}`;

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="gold-btn grid size-9 place-items-center text-lg font-extrabold">X</div>
            <div className="leading-none">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-extrabold tracking-tight">XSAAC BANKROLL</span>
                <span className="gold-btn hidden items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-bold sm:flex">
                  <Crown className="size-3" /> OFICIAL
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Comunidad Oficial de xsaac</span>
                <span className="hidden items-center gap-1 text-[11px] text-success sm:flex">
                  <span className="size-2 animate-pulse rounded-full bg-success" /> live
                </span>
              </div>
            </div>
          </div>

          <div className="mx-4 hidden flex-1 flex-col items-end leading-none md:flex">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Bankroll total
            </span>
            <span className="text-[26px] font-extrabold tracking-tight text-[#FFD60A]">
              {money(stats.bankrollTotal)} MXN
            </span>
          </div>

          <div className="flex items-center gap-2">

            <Link
              to="/comunidad"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-[12px] font-medium sm:flex"
            >
              <MessageCircle className="size-4" /> Comunidad
            </Link>
            <Link
              to="/chat"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-[12px] font-medium sm:flex"
            >
              <Bot className="size-4" /> Asistente
            </Link>
            {!signedIn ? (
              <Link
                to="/auth"
                className="gold-btn flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold"
              >
                <LogIn className="size-4" /> Entrar
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-[12px]">
                  <span className="max-w-[10ch] truncate font-medium">
                    {email?.split("@")[0] ?? "usuario"}
                  </span>
                  {isVip && (
                    <span className="gold-btn rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                      VIP
                    </span>
                  )}
                </div>
                <button
                  aria-label="Cerrar sesión"
                  onClick={() => supabase.auth.signOut()}
                  className="grid size-9 place-items-center rounded-full border border-border bg-secondary hover:bg-accent"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-baseline justify-between border-t border-border px-4 py-2 md:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bankroll total
          </span>
          <span className="text-[22px] font-extrabold tracking-tight text-[#FFD60A]">
            {money(stats.bankrollTotal)} MXN
          </span>
        </div>
      </header>


      {/* STATS */}
      <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="surface relative overflow-hidden p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bankroll Total
              </span>
              <DollarSign className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight">
              {money(stats.bankrollTotal)} MXN
            </div>
            <div className="mt-1 flex items-center gap-1 text-[12px] text-success">
              <TrendingUp className="size-3.5" /> {stats.totalProfit >= 0 ? "+" : ""}
              {money(stats.totalProfit)}
            </div>
          </div>
          <div className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Profit Neto
              </span>
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div
              className={`mt-2 text-[22px] font-bold tracking-tight ${stats.totalProfit >= 0 ? "text-success" : "text-destructive"}`}
            >
              {stats.totalProfit >= 0 ? "+" : ""}
              {money(stats.totalProfit)}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              ROI {stats.roi > 0 ? "+" : ""}
              {stats.roi}%
            </div>
          </div>
          <div className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Win Rate
              </span>
              <Target className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight">{stats.winRate}%</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-success" style={{ width: `${stats.winRate}%` }} />
            </div>
          </div>
          <div className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                ROI Verificado
              </span>
              <BarChart3 className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-[22px] font-bold tracking-tight text-primary">
              {stats.roi > 0 ? "+" : ""}
              {stats.roi}%
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {stats.count} apuestas registradas
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="mt-6 flex items-center gap-2">
          {(
            [
              { k: "picks", label: "Picks", icon: Zap },
              { k: "bankroll", label: "Mi Bankroll", icon: BarChart3, count: stats.count },
              { k: "chat", label: "Comunidad", icon: MessageCircle },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition ${
                tab === t.k
                  ? "gold-btn border-transparent"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
              {"count" in t && t.count !== undefined && (
                <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
            <Timer className="size-3.5" /> Datos en vivo
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 py-6 pb-24 sm:px-6">
        {/* PICKS */}
        {tab === "picks" && (
          <>
            {isAdmin && (
              <div className="surface mb-4 flex items-center justify-between p-4">
                <div>
                  <div className="font-bold">Panel de administración</div>
                  <div className="text-[12px] text-muted-foreground">
                    Publica, edita o elimina los picks de la comunidad.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/admin"
                    className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Shield className="size-4" /> Panel completo
                  </Link>
                  <button
                    onClick={() => setEditing(emptyPick())}
                    className="gold-btn flex h-10 items-center gap-2 px-4 text-[13px]"
                  >
                    <Plus className="size-4" /> Nuevo pick
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {picks.map((pick) => {
                const locked = pick.type === "vip" && !isVip;
                return (
                  <div key={pick.id} className="surface group relative overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide ${
                            pick.type === "vip"
                              ? "gold-btn border-transparent"
                              : "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          {pick.league}
                        </span>
                        {pick.type === "vip" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                            <Crown className="size-3" /> PICK OFICIAL DE XSAAC
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{pick.event_time}</span>
                        {pick.verified && <Shield className="size-3.5 text-success" />}
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <div className="text-[16px] font-bold leading-tight tracking-tight">
                        {pick.match}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-bold">
                          {pick.market}
                          <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px]">
                            @{pick.odds}
                          </span>
                        </div>
                        <div
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                            pick.confidence >= 9
                              ? "border-border bg-secondary text-success"
                              : "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          Confianza {pick.confidence}/10
                        </div>
                      </div>

                      <div
                        className={`mt-3 rounded-xl border border-border bg-secondary p-3 text-[12.5px] leading-relaxed text-muted-foreground ${locked ? "select-none blur-[5px]" : ""}`}
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                          <Flame className="size-3.5 text-warning" /> Análisis exclusivo
                        </div>
                        {pick.analysis}
                      </div>

                      <div className={`mt-3 grid grid-cols-2 gap-2 ${locked ? "select-none blur-[6px]" : ""}`}>
                        <div className="rounded-xl border border-border bg-secondary p-2.5">
                          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Stake sugerido
                          </div>
                          <div className="mt-1 text-[13px] font-bold">{pick.stake}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary p-2.5">
                          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                            ROI histórico
                          </div>
                          <div className="mt-1 text-[13px] font-bold text-success">+{pick.roi}%</div>
                        </div>
                      </div>

                      <button
                        onClick={() => addToBankroll(pick)}
                        className="gold-btn mt-4 flex h-11 w-full items-center justify-center gap-2 text-[13px]"
                      >
                        <Plus className="size-4" /> Agregar a mi bankroll
                      </button>

                      {isAdmin && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setEditing({ ...pick })}
                            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary text-[12px] font-semibold hover:bg-accent"
                          >
                            <Pencil className="size-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => deletePick(pick.id)}
                            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary text-[12px] font-semibold text-destructive hover:bg-accent"
                          >
                            <Trash2 className="size-3.5" /> Borrar
                          </button>
                        </div>
                      )}
                    </div>

                    {locked && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[22px] bg-black/85 p-6 text-center backdrop-blur-[20px]">
                        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/15 px-3 py-1 text-[11px] font-extrabold text-success">
                            <Star className="size-3.5" /> ROI +{pick.roi}% VERIFICADO
                          </div>

                          <Lock className="size-4 text-muted-foreground" />
                        </div>
                        <div className="grid size-12 place-items-center rounded-2xl border border-border bg-secondary">
                          <Lock className="size-6" />
                        </div>
                        <div className="mt-4 text-[18px] font-extrabold tracking-tight">
                          Pick VIP bloqueado
                        </div>
                        <div className="mt-1 max-w-[26ch] text-[13px] leading-snug text-muted-foreground">
                          Desbloquea todos los picks de xsaac por ${VIP_PRICE} MXN.
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Eye className="size-3.5" /> Acceso inmediato tras activar
                        </div>
                        <button
                          onClick={() => setShowVip(true)}
                          className="gold-btn mt-5 flex h-11 items-center gap-2 px-6 text-[13px] font-extrabold"
                        >
                          <Crown className="size-4" /> Desbloquear por ${VIP_PRICE}
                          <ArrowUpRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {picks.length === 0 && (
                <div className="surface p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay picks publicados.
                </div>
              )}
            </div>
          </>
        )}

        {/* BANKROLL */}
        {tab === "bankroll" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <div className="font-bold tracking-tight">Historial verificado</div>
                  <div className="text-[11px] text-muted-foreground">
                    Calcula profit y ROI automáticamente
                  </div>
                </div>
                <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-bold text-success">
                  {stats.roi > 0 ? "+" : ""}
                  {stats.roi}% ROI
                </span>
              </div>

              {!signedIn && (
                <div className="m-4 flex items-center justify-between rounded-xl border border-border bg-secondary p-3">
                  <div className="text-[13px]">
                    <span className="font-bold">Inicia sesión para guardar tu historial</span>
                    <span className="text-muted-foreground"> — se guarda en tu cuenta.</span>
                  </div>
                  <Link to="/auth" className="gold-btn flex h-8 items-center px-3 text-[12px]">
                    Entrar
                  </Link>
                </div>
              )}

              <div className="overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Apuesta</th>
                      <th className="text-left font-semibold">Stake</th>
                      <th className="text-left font-semibold">Resultado</th>
                      <th className="pr-4 text-right font-semibold">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.map((row) => (
                      <tr key={row.id} className="border-b border-border hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <div className="max-w-[24ch] truncate font-semibold leading-tight">
                            {row.event}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(row.created_at).toLocaleDateString("es-MX")} • @{row.odds}
                          </div>
                        </td>
                        <td>{money(row.stake)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {(["win", "loss", "pending"] as ResultType[]).map((r) => (
                              <button
                                key={r}
                                onClick={() => updateResult(row.id, r)}
                                className={`h-7 rounded-full border px-2.5 text-[11px] font-bold transition ${
                                  row.result === r
                                    ? r === "win"
                                      ? "border-success bg-success text-success-foreground"
                                      : r === "loss"
                                        ? "border-destructive bg-destructive text-destructive-foreground"
                                        : "gold-btn border-transparent"
                                    : "border-border bg-secondary text-muted-foreground hover:bg-accent"
                                }`}
                              >
                                {r === "win" ? "Win" : r === "loss" ? "Loss" : "Pend"}
                              </button>
                            ))}
                            <button
                              aria-label="Eliminar apuesta"
                              onClick={() => deleteBet(row.id)}
                              className="grid size-7 place-items-center rounded-full border border-border bg-secondary text-muted-foreground hover:bg-accent"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td
                          className={`pr-4 text-right font-bold ${
                            row.result === "win"
                              ? "text-success"
                              : row.result === "loss"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {row.result === "pending"
                            ? "—"
                            : `${profitOf(row) >= 0 ? "+" : ""}${money(profitOf(row))}`}
                        </td>
                      </tr>
                    ))}
                    {bets.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground">
                          Aún no registras apuestas. Agrega un pick para empezar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-border p-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Profit total
                  </div>
                  <div
                    className={`text-[15px] font-bold ${stats.totalProfit >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {stats.totalProfit >= 0 ? "+" : ""}
                    {money(stats.totalProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Invertido
                  </div>
                  <div className="text-[15px] font-bold">{money(stats.totalStaked)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    ROI real
                  </div>
                  <div className="text-[15px] font-bold text-primary">
                    {stats.roi > 0 ? "+" : ""}
                    {stats.roi}%
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="surface p-5">
                <div className="font-bold">Gráfica real de profit</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Curva acumulada calculada con tus apuestas reales
                </div>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={54}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 12,
                          fontSize: 12,
                          color: "var(--color-foreground)",
                        }}
                        formatter={(value: number) => [`${money(Number(value))} MXN`, "Profit"]}
                        labelFormatter={(_l, p) => p?.[0]?.payload?.label ?? ""}
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="var(--color-primary)"
                        strokeWidth={2.4}
                        fill="url(#profitFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface p-5">
                <div className="flex items-center gap-2 font-extrabold tracking-tight">
                  <Crown className="size-5 text-primary" /> Pase VIP de xsaac
                </div>
                <div className="mt-2 text-[13px] leading-snug text-muted-foreground">
                  Acceso completo a los picks oficiales, análisis y sala VIP por{" "}
                  <span className="font-bold text-primary">${VIP_PRICE} MXN</span>.
                </div>
                <button
                  onClick={() => setShowVip(true)}
                  className="gold-btn mt-4 h-10 w-full px-4 text-[13px]"
                >
                  {isVip ? "Tu VIP está activo" : `Activar por $${VIP_PRICE} MXN`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/comunidad" className="surface flex items-center gap-4 p-6 hover:bg-accent/30">
              <MessageCircle className="size-8 text-primary" />
              <div>
                <div className="font-bold">Sala de la comunidad</div>
                <div className="text-[13px] text-muted-foreground">
                  Chat en vivo con todos los apostadores de xsaac.
                </div>
              </div>
            </Link>
            <Link to="/chat" className="surface flex items-center gap-4 p-6 hover:bg-accent/30">
              <Bot className="size-8 text-primary" />
              <div>
                <div className="font-bold">Coach BetRoll (IA)</div>
                <div className="text-[13px] text-muted-foreground">
                  Asistente de bankroll, límites y gestión de riesgo.
                </div>
              </div>
            </Link>
          </div>
        )}
      </main>

      {/* MODAL VIP */}
      {showVip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowVip(false)} />
          <div className="surface relative w-full max-w-[520px] overflow-hidden p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="gold-btn grid size-11 place-items-center rounded-2xl">
                <Crown className="size-6" />
              </div>
              <button
                aria-label="Cerrar"
                onClick={() => setShowVip(false)}
                className="grid size-9 place-items-center rounded-full border border-border bg-secondary hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>

            <h2 className="mt-5 text-[24px] font-extrabold leading-tight tracking-tight">
              VIP ADD-ON de xsaac por <span className="gold-text">${VIP_PRICE} MXN</span>
            </h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Un solo pago de ${VIP_PRICE} MXN con acceso total durante 30 días.
            </p>

            <div className="mt-5 grid gap-2.5">
              {[
                `Todos los picks oficiales de xsaac incluidos en los $${VIP_PRICE} MXN`,
                "Bankroll con profit, ROI y gráfica real verificada",
                "Análisis completo y stake sugerido en cada pick",
                "Sala privada de la comunidad VIP",
              ].map((txt) => (
                <div key={txt} className="flex items-start gap-2.5 text-[13px] leading-snug">
                  <span className="mt-0.5 grid size-5 place-items-center rounded-full bg-secondary text-success">
                    <Check className="size-3.5" />
                  </span>
                  <span>{txt}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex h-12 items-center justify-between rounded-full border border-border bg-secondary px-4 text-[13px] font-bold">
              <span className="text-muted-foreground">Total a pagar</span>
              <span className="text-primary">${VIP_PRICE} MXN</span>
            </div>

            <button
              onClick={activateVip}
              disabled={activating || isVip}
              className="gold-btn mt-5 flex h-[52px] w-full items-center justify-center gap-2 text-[15px] font-extrabold disabled:opacity-60"
            >
              <Zap className="size-5" />
              {isVip ? "VIP activo" : `Activar VIP por $${VIP_PRICE} MXN`}
            </button>
            <div className="mt-3 text-center text-[11px] text-muted-foreground">
              Pago simulado con fines de demostración. No se realiza ningún cargo real.
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMIN PICK */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setEditing(null)} />
          <div className="surface relative max-h-[90vh] w-full max-w-[520px] overflow-auto p-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{editing.id ? "Editar pick" : "Nuevo pick"}</div>
              <button
                aria-label="Cerrar"
                onClick={() => setEditing(null)}
                className="grid size-9 place-items-center rounded-full border border-border bg-secondary hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Tipo
                <select
                  className="field mt-1"
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as PickType })}
                >
                  <option value="free">Free</option>
                  <option value="vip">VIP</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Liga
                <input
                  className="field mt-1"
                  value={editing.league}
                  onChange={(e) => setEditing({ ...editing, league: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">
                Partido
                <input
                  className="field mt-1"
                  value={editing.match}
                  onChange={(e) => setEditing({ ...editing, match: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Mercado
                <input
                  className="field mt-1"
                  value={editing.market}
                  onChange={(e) => setEditing({ ...editing, market: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Cuota
                <input
                  className="field mt-1"
                  type="number"
                  step="0.01"
                  value={editing.odds}
                  onChange={(e) => setEditing({ ...editing, odds: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Stake sugerido
                <input
                  className="field mt-1"
                  value={editing.stake}
                  onChange={(e) => setEditing({ ...editing, stake: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Confianza (1-10)
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={10}
                  value={editing.confidence}
                  onChange={(e) => setEditing({ ...editing, confidence: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                ROI histórico (%)
                <input
                  className="field mt-1"
                  type="number"
                  step="0.1"
                  value={editing.roi}
                  onChange={(e) => setEditing({ ...editing, roi: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Horario
                <input
                  className="field mt-1"
                  value={editing.event_time}
                  onChange={(e) => setEditing({ ...editing, event_time: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">
                Análisis
                <textarea
                  className="field mt-1 min-h-24"
                  value={editing.analysis}
                  onChange={(e) => setEditing({ ...editing, analysis: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editing.verified}
                  onChange={(e) => setEditing({ ...editing, verified: e.target.checked })}
                />
                Verificado
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Visible para la comunidad
              </label>
            </div>

            <button onClick={savePick} className="gold-btn mt-5 h-11 w-full text-[14px]">
              Guardar pick
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
