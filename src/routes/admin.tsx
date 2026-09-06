import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel admin — XSAAC BANKROLL" },
      {
        name: "description",
        content:
          "Panel de administración de xsaac: publica, edita, activa y elimina los picks free y VIP de la comunidad.",
      },
      { property: "og:title", content: "Panel admin — XSAAC BANKROLL" },
      {
        property: "og:description",
        content: "Gestión completa de picks free y VIP de la comunidad de xsaac.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type PickType = "free" | "vip";

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
  created_at: string;
};

type Draft = Omit<Pick, "id" | "created_at"> & { id?: string };

const emptyDraft = (): Draft => ({
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

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string;
  bankroll_total: number;
  subscription_status: string;
  is_vip: boolean;
  created_at: string;
};

type BetRow = {
  id: string;
  user_id: string | null;
  event: string;
  stake: number;
  odds: number;
  result: string;
  created_at: string;
};

function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<"picks" | "users" | "bets">("picks");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [oldBets, setOldBets] = useState<BetRow[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | PickType>("all");


  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) {
        if (alive) {
          setIsAdmin(false);
          setChecking(false);
        }
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!alive) return;
      setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
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

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No se pudieron cargar los usuarios");
      return;
    }
    setProfiles((data ?? []) as unknown as ProfileRow[]);
  }, []);

  const loadOldBets = useCallback(async () => {
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No se pudieron cargar los picks antiguos");
      return;
    }
    setOldBets((data ?? []) as unknown as BetRow[]);
  }, []);

  const setUserPlan = async (row: ProfileRow, value: string) => {
    const vip = value === "VIP";
    setProfiles((prev) =>
      prev.map((p) =>
        p.user_id === row.user_id ? { ...p, subscription_status: value, is_vip: vip } : p,
      ),
    );
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_status: value, is_vip: vip })
      .eq("user_id", row.user_id);
    if (error) {
      toast.error("No se pudo actualizar el plan");
      void loadUsers();
      return;
    }
    toast.success(vip ? "Usuario ahora es VIP" : "Usuario ahora es FREE");
  };

  const removeBet = async (id: string) => {
    if (!confirm("¿Borrar?")) return;
    const { error } = await supabase.from("bets").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar el pick");
      return;
    }
    setOldBets((prev) => prev.filter((b) => b.id !== id));
    toast.success("Pick eliminado");
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    void loadUsers();
    void loadOldBets();
  }, [isAdmin, load, loadUsers, loadOldBets]);


  const save = async () => {
    if (!draft) return;
    if (!draft.match.trim() || !draft.market.trim()) {
      toast.error("Completa el partido y el mercado");
      return;
    }
    setSaving(true);
    const { id, ...payload } = draft;
    const res = id
      ? await supabase.from("picks").update(payload).eq("id", id)
      : await supabase.from("picks").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error("No se pudo guardar el pick");
      return;
    }
    setDraft(null);
    await load();
    toast.success(id ? "Pick actualizado" : "Pick publicado");
  };

  const toggle = async (pick: Pick, field: "is_active" | "verified") => {
    const next = !pick[field];
    setPicks((prev) => prev.map((p) => (p.id === pick.id ? { ...p, [field]: next } : p)));
    const patch = field === "is_active" ? { is_active: next } : { verified: next };
    const { error } = await supabase.from("picks").update(patch).eq("id", pick.id);
    if (error) {
      toast.error("No se pudo actualizar");
      void load();
    }
  };

  const remove = async (pick: Pick) => {
    if (!confirm(`¿Eliminar el pick "${pick.match}"?`)) return;
    const { error } = await supabase.from("picks").delete().eq("id", pick.id);
    if (error) {
      toast.error("No se pudo eliminar el pick");
      return;
    }
    setPicks((prev) => prev.filter((p) => p.id !== pick.id));
    toast.success("Pick eliminado");
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return picks.filter((p) => {
      if (filter !== "all" && p.type !== filter) return false;
      if (!term) return true;
      return `${p.match} ${p.league} ${p.market}`.toLowerCase().includes(term);
    });
  }, [picks, q, filter]);

  const stats = useMemo(
    () => ({
      total: picks.length,
      vip: picks.filter((p) => p.type === "vip").length,
      activos: picks.filter((p) => p.is_active).length,
      roi: picks.length
        ? Math.round((picks.reduce((a, p) => a + Number(p.roi || 0), 0) / picks.length) * 10) / 10
        : 0,
    }),
    [picks],
  );

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface max-w-sm p-6 text-center">
          <Shield className="mx-auto size-8 text-primary" />
          <h1 className="mt-3 text-lg font-bold">Zona restringida</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Necesitas una cuenta de administrador de xsaac para entrar aquí.
          </p>
          <Link to="/" className="gold-btn mt-4 inline-flex h-10 items-center px-4 text-[13px]">
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Volver"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight">
              Panel <span className="gold-text">admin</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">Gestión de picks de xsaac</p>
          </div>
          <button
            onClick={() => setDraft(emptyDraft())}
            className="gold-btn ml-auto flex h-10 items-center gap-2 px-4 text-[13px]"
          >
            <Plus className="size-4" /> Nuevo pick
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 pb-24 sm:px-6">
        <div className="mb-5 flex gap-2 overflow-x-auto">
          {(
            [
              ["picks", "Picks"],
              ["users", "Usuarios"],
              ["bets", "Picks antiguos"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-10 shrink-0 rounded-xl border px-4 text-[13px] font-semibold transition-colors ${
                tab === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Bankroll</th>
                  <th className="px-4 py-3">Plan</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((u) => (
                  <tr key={u.user_id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-semibold">{u.email ?? u.display_name}</td>
                    <td className="px-4 py-3">${Number(u.bankroll_total ?? 0).toLocaleString("es-MX")}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.is_vip ? "VIP" : "FREE"}
                        onChange={(e) => void setUserPlan(u, e.target.value)}
                        className={inputCls}
                      >
                        <option value="FREE">FREE</option>
                        <option value="VIP">VIP</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Aún no hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "bets" && (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Stake</th>
                  <th className="px-4 py-3">Cuota</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {oldBets.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-semibold">{b.event || "—"}</td>
                    <td className="px-4 py-3">${Number(b.stake).toLocaleString("es-MX")}</td>
                    <td className="px-4 py-3">{Number(b.odds).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.result}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => void removeBet(b.id)}
                          aria-label="Eliminar"
                          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {oldBets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No hay picks registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "picks" && (
        <>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {[
            { label: "Picks totales", value: stats.total },
            { label: "Picks VIP", value: stats.vip },
            { label: "Activos", value: stats.activos },
            { label: "ROI promedio", value: `${stats.roi}%` },
          ].map((s) => (
            <div key={s.label} className="surface p-4">
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar partido, liga o mercado…"
              className="h-11 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "free", "vip"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-11 rounded-xl border px-4 text-[13px] font-semibold transition-colors ${
                  filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : f === "free" ? "Free" : "VIP"}
              </button>
            ))}
          </div>
        </div>

        <div className="surface mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Partido</th>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">Cuota</th>
                <th className="px-4 py-3">ROI</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.match || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.league} {p.event_time && `· ${p.event_time}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.market}</td>
                  <td className="px-4 py-3 font-bold">{Number(p.odds).toFixed(2)}</td>
                  <td
                    className={`px-4 py-3 font-semibold ${Number(p.roi) >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {Number(p.roi)}%
                  </td>
                  <td className="px-4 py-3">
                    {p.type === "vip" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                        <Crown className="size-3" /> VIP
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Free
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => void toggle(p, "is_active")}
                        title={p.is_active ? "Activo" : "Oculto"}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                          p.is_active
                            ? "border-success/40 text-success"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {p.is_active ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                        {p.is_active ? "Activo" : "Oculto"}
                      </button>
                      <button
                        onClick={() => void toggle(p, "verified")}
                        title="Verificado"
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                          p.verified
                            ? "border-primary/40 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Check className="size-3" /> Verificado
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          const { id, created_at, ...rest } = p;
                          setDraft({ ...rest, id });
                        }}
                        aria-label="Editar"
                        className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => void remove(p)}
                        aria-label="Eliminar"
                        className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay picks que coincidan con tu búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="surface relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <button
              onClick={() => setDraft(null)}
              aria-label="Cerrar"
              className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <div className="text-lg font-bold">{draft.id ? "Editar pick" : "Nuevo pick"}</div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as PickType })}
                  className={inputCls}
                >
                  <option value="free">Free</option>
                  <option value="vip">VIP</option>
                </select>
              </Field>
              <Field label="Liga">
                <input
                  value={draft.league}
                  onChange={(e) => setDraft({ ...draft, league: e.target.value })}
                  className={inputCls}
                  placeholder="NBA"
                />
              </Field>
              <Field label="Partido" full>
                <input
                  value={draft.match}
                  onChange={(e) => setDraft({ ...draft, match: e.target.value })}
                  className={inputCls}
                  placeholder="Lakers vs Celtics"
                />
              </Field>
              <Field label="Mercado" full>
                <input
                  value={draft.market}
                  onChange={(e) => setDraft({ ...draft, market: e.target.value })}
                  className={inputCls}
                  placeholder="Over 214.5 puntos"
                />
              </Field>
              <Field label="Cuota">
                <input
                  type="number"
                  step="0.01"
                  value={draft.odds}
                  onChange={(e) => setDraft({ ...draft, odds: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Stake">
                <input
                  value={draft.stake}
                  onChange={(e) => setDraft({ ...draft, stake: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label={`Confianza: ${draft.confidence}/10`}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={draft.confidence}
                  onChange={(e) => setDraft({ ...draft, confidence: Number(e.target.value) })}
                  className="w-full accent-[oklch(0.82_0.16_88)]"
                />
              </Field>
              <Field label="ROI (%)">
                <input
                  type="number"
                  step="0.1"
                  value={draft.roi}
                  onChange={(e) => setDraft({ ...draft, roi: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Horario" full>
                <input
                  value={draft.event_time}
                  onChange={(e) => setDraft({ ...draft, event_time: e.target.value })}
                  className={inputCls}
                  placeholder="Hoy 20:30"
                />
              </Field>
              <Field label="Análisis" full>
                <textarea
                  rows={3}
                  value={draft.analysis}
                  onChange={(e) => setDraft({ ...draft, analysis: e.target.value })}
                  className={`${inputCls} h-auto py-2`}
                />
              </Field>
            </div>

            <div className="mt-3 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.verified}
                  onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
                  className="accent-[oklch(0.82_0.16_88)]"
                />
                Verificado
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="accent-[oklch(0.82_0.16_88)]"
                />
                Visible
              </label>
            </div>

            <button
              onClick={() => void save()}
              disabled={saving}
              className="gold-btn mt-5 flex h-11 w-full items-center justify-center gap-2 text-[14px] disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {draft.id ? "Guardar cambios" : "Publicar pick"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm outline-none focus:border-primary";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
