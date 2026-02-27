import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { edonApi } from "@/lib/api";
import {
  Lock, Briefcase, Bot, Check, Save,
  Wifi, WifiOff, ChevronRight, ChevronDown,
  AlertTriangle, Send,
} from "lucide-react";
import { Link } from "react-router-dom";

const BASE_URL_KEY = "edon_api_base";
const TOKEN_KEY = "edon_token";
const EMAIL_KEY = "edon_user_email";
const PLAN_KEY = "edon_plan";
const LEGACY_BASE_KEYS = ["EDON_BASE_URL", "edon_api_base", "edon_base_url"] as const;

const normalizeBaseUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
};

function getStoredBaseUrl(envUrl?: string, isProd?: boolean) {
  const v =
    LEGACY_BASE_KEYS.map((k) => localStorage.getItem(k))
      .find((x) => (x ?? "").trim().length > 0) ||
    envUrl ||
    (isProd ? "https://edon-gateway.fly.dev" : "http://127.0.0.1:8000");
  return v.trim();
}

function getStoredToken(envToken?: string) {
  return (envToken || localStorage.getItem(TOKEN_KEY) || "").trim();
}

const isLikelyToken = (s: string) =>
  /^(edon_[A-Za-z0-9._-]{16,}|[a-f0-9]{64}|[a-f0-9]{128}|[A-Za-z0-9._-]{24,})$/i.test(s);

async function safeText(res: Response) {
  try {
    return (await res.text()) || "";
  } catch {
    return "";
  }
}

const SAFETY_MODES = [
  {
    packName: "personal_safe",
    label: "Safe Mode",
    icon: Lock,
    description: "High-risk actions are blocked before they run. Best starting point for any deployment.",
    recommended: true,
    caution: false,
  },
  {
    packName: "work_safe",
    label: "Business Mode",
    icon: Briefcase,
    description: "Business operations run freely. Sensitive actions (financial, data access) require approval.",
    recommended: false,
    caution: false,
  },
  {
    packName: "ops_admin",
    label: "Autonomy Mode",
    icon: Bot,
    description: "Agents operate without interruption. Only critical safety violations are surfaced.",
    recommended: false,
    caution: true,
  },
] as const;

export default function Settings() {
  const { toast } = useToast();
  const isProd = import.meta.env.MODE === "production";

  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8000");
  const [token, setToken] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "failed">("unknown");
  const [testing, setTesting] = useState(false);
  const [applyingSafety, setApplyingSafety] = useState<string | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);

  const [userName, setUserName] = useState<string>("");
  const [planName, setPlanName] = useState<string>("");
  const [decisionsUsed, setDecisionsUsed] = useState<number | null>(null);
  const [decisionsLimit, setDecisionsLimit] = useState<number | null>(null);
  const [safetyPreset, setSafetyPreset] = useState<string | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);

  useEffect(() => {
    const envUrl = import.meta.env.VITE_EDON_GATEWAY_URL as string | undefined;
    const envToken = import.meta.env.VITE_EDON_API_TOKEN as string | undefined;
    setBaseUrl(getStoredBaseUrl(envUrl, isProd));
    setToken(getStoredToken(envToken));
    setUserName(localStorage.getItem(EMAIL_KEY) || "");
    setPlanName(localStorage.getItem(PLAN_KEY) || "");
  }, [isProd]);

  const persist = (trimmedBase: string, trimmedToken: string) => {
    localStorage.setItem(BASE_URL_KEY, trimmedBase);
    localStorage.setItem(TOKEN_KEY, trimmedToken);
    localStorage.setItem("edon_api_key", trimmedToken);
    localStorage.setItem("EDON_BASE_URL", trimmedBase);
    localStorage.setItem("edon_base_url", trimmedBase);
  };

  const loadAccountAndIntegrations = async () => {
    const t = getStoredToken();
    if (!t || !isLikelyToken(t)) return;
    setLoadingAccount(true);
    try {
      const [session, billing, health, integrations] = await Promise.all([
        edonApi.getSession().catch(() => null),
        edonApi.getBillingStatus().catch(() => null),
        edonApi.getHealth().catch(() => null),
        edonApi.getIntegrations().catch(() => ({})),
      ]);

      if (session?.email) {
        setUserName(session.email);
        localStorage.setItem(EMAIL_KEY, session.email);
      }
      if (session?.plan) {
        setPlanName(session.plan);
        localStorage.setItem(PLAN_KEY, session.plan);
      }
      if (billing) {
        setPlanName((billing as { plan?: string }).plan ?? planName);
        const usage = (billing as { usage?: { today?: number } }).usage;
        const limits = (billing as { limits?: { requests_per_month?: number } }).limits;
        const used = usage?.today ?? null;
        const limit = limits?.requests_per_month ?? null;
        if (typeof used === "number") setDecisionsUsed(used);
        if (typeof limit === "number") setDecisionsLimit(limit);
      }
      if (health?.governor?.active_preset?.preset_name) {
        setSafetyPreset(health.governor.active_preset.preset_name);
      }
      if (integrations && typeof integrations === "object") {
        const obj = integrations as Record<string, unknown>;
        setTelegramConnected(!!(obj.telegram && typeof obj.telegram === "object"));
      }
    } catch {
      // silently keep existing state
    } finally {
      setLoadingAccount(false);
    }
  };

  useEffect(() => {
    loadAccountAndIntegrations();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySafetyMode = async (packName: string) => {
    setApplyingSafety(packName);
    try {
      await edonApi.applyPolicyPack(packName);
      setSafetyPreset(packName);
      const label = SAFETY_MODES.find((m) => m.packName === packName)?.label ?? packName;
      toast({ title: "Safety mode updated", description: `${label} is now active.` });
      loadAccountAndIntegrations();
    } catch (err: unknown) {
      toast({
        title: "Failed to set safety mode",
        description: err instanceof Error ? err.message : "Could not apply.",
        variant: "destructive",
      });
    } finally {
      setApplyingSafety(null);
    }
  };

  const saveSettings = () => {
    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();
    const safeBase = normalizeBaseUrl(trimmedBase);

    if (/PASTE_YOUR_|NEW_GATEWAY_TOKEN_|TOKEN_HERE/i.test(trimmedToken)) {
      toast({ title: "Invalid access key", description: "Paste your real EDON access key.", variant: "destructive" });
      return;
    }
    if (!safeBase) {
      toast({ title: "Invalid gateway URL", description: "Enter a valid https:// URL.", variant: "destructive" });
      return;
    }
    if (!isLikelyToken(trimmedToken)) {
      toast({ title: "Invalid access key", description: "The key format doesn't look right.", variant: "destructive" });
      return;
    }
    persist(safeBase, trimmedToken);
    toast({ title: "Saved", description: "Your connection settings have been saved." });
  };

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("unknown");
    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();
    const safeBase = normalizeBaseUrl(trimmedBase);

    try {
      if (!safeBase || !isLikelyToken(trimmedToken)) {
        throw new Error("Add a valid gateway URL and access key first.");
      }
      persist(safeBase, trimmedToken);
      const base = safeBase.replace(/\/$/, "");
      const res = await fetch(`${base}/health`, {
        method: "GET",
        headers: { "X-EDON-TOKEN": trimmedToken },
      });
      if (res.status === 401) throw new Error("Access key not accepted.");
      if (!res.ok) throw new Error(`Connection error (${res.status}). ${await safeText(res)}`);

      setConnectionStatus("connected");
      toast({ title: "Connected", description: "Gateway is reachable and your key is accepted." });
      loadAccountAndIntegrations();
    } catch (err: unknown) {
      setConnectionStatus("failed");
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const activeSafetyPack = safetyPreset ?? "personal_safe";
  const usagePct = decisionsUsed != null && decisionsLimit != null && decisionsLimit > 0
    ? Math.min(100, (decisionsUsed / decisionsLimit) * 100)
    : null;

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="container mx-auto px-6 py-8 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Page title */}
          <div>
            <h1 className="text-xl font-semibold text-foreground/90">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your account, safety mode, and gateway connection.
            </p>
          </div>

          {/* ── ACCOUNT ─────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Account</p>
            <div className="glass-card divide-y divide-white/5">

              {/* Identity row */}
              <div className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{userName || "Signed in"}</p>
                  {planName && (
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{planName} plan</p>
                  )}
                </div>
                <a
                  href="https://edoncore.com/account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  Manage account <ChevronRight className="h-3 w-3" />
                </a>
              </div>

              {/* Usage row */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Decisions today</p>
                  {decisionsUsed != null && decisionsLimit != null ? (
                    <p className="text-xs font-medium tabular-nums">
                      {decisionsUsed.toLocaleString()} / {decisionsLimit.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50">
                      {loadingAccount ? "Loading…" : "—"}
                    </p>
                  )}
                </div>
                {usagePct != null ? (
                  <>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePct >= 90 ? "bg-red-400/80" : usagePct >= 70 ? "bg-amber-400/80" : "bg-primary/70"
                        }`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {Math.max(0, decisionsLimit! - decisionsUsed!).toLocaleString()} remaining today
                    </p>
                  </>
                ) : (
                  <div className="h-1.5 rounded-full bg-white/10" />
                )}
              </div>

            </div>
          </section>

          {/* ── SAFETY MODE ─────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Safety Mode</p>
              <Link to="/policies" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                Advanced <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Controls how much your agents can do without asking for approval.
            </p>
            <div className="space-y-2">
              {SAFETY_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = activeSafetyPack === mode.packName;
                return (
                  <button
                    key={mode.packName}
                    type="button"
                    onClick={() => !isActive && applySafetyMode(mode.packName)}
                    disabled={applyingSafety === mode.packName}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                      isActive
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? "bg-primary/20" : "bg-white/10"
                    }`}>
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-foreground/80"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{mode.label}</p>
                        {mode.recommended && !isActive && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            Recommended
                          </span>
                        )}
                        {mode.caution && !isActive && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> High trust
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                            <Check className="h-2.5 w-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                    </div>
                    {applyingSafety === mode.packName && (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── CHANNELS ────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Channels</p>
            <div className="glass-card px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <Send className="h-3.5 w-3.5 text-foreground/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Telegram</p>
                    <p className="text-xs text-muted-foreground">
                      {telegramConnected
                        ? "Receiving governance alerts and approvals"
                        : "Get governance alerts sent to your Telegram"}
                    </p>
                  </div>
                </div>
                {telegramConnected ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs shrink-0">
                    <Check className="h-3 w-3 mr-1" /> Connected
                  </Badge>
                ) : (
                  <a
                    href="https://edoncore.com/account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Connect →
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* ── UPGRADE PROMPT ──────────────────────── */}
          {planName && !["business", "enterprise"].includes(planName.toLowerCase()) && (
            <div className="glass-card p-5 border border-primary/20">
              <p className="text-sm font-medium mb-1">More decisions, more agents</p>
              <p className="text-xs text-muted-foreground mb-3">
                {planName === "free" || !planName
                  ? "You're on the free plan — 100K decisions/day, 1 agent. Upgrade to scale."
                  : planName === "starter"
                  ? "Starter gives you 500K decisions/day. Move to Growth for 5M decisions and 25 agents."
                  : "Upgrade to Business for 25M decisions, 100 agents, and the full compliance suite."}
              </p>
              <Link to="/pricing" className="text-xs font-medium text-primary hover:underline">
                See all plans →
              </Link>
            </div>
          )}

          {/* ── GATEWAY CONNECTION ──────────────────── */}
          <section>
            <button
              type="button"
              onClick={() => setConnectionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 glass-card text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                {connectionStatus === "connected" ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                ) : connectionStatus === "failed" ? (
                  <WifiOff className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
                <span>
                  Gateway connection
                  {connectionStatus === "connected" && <span className="ml-2 text-xs text-emerald-400">● Active</span>}
                  {connectionStatus === "failed" && <span className="ml-2 text-xs text-red-400">● Failed</span>}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${connectionOpen ? "rotate-180" : ""}`} />
            </button>

            {connectionOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="glass-card mt-1 px-5 py-4 space-y-4 border-t-0 rounded-t-none"
              >
                <p className="text-xs text-muted-foreground">
                  This is set automatically when you sign in from{" "}
                  <a href="https://edoncore.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    edoncore.com
                  </a>
                  . Only update this if you're running a self-hosted gateway.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="baseUrl" className="text-xs text-muted-foreground">EDON Gateway URL</Label>
                  <Input
                    id="baseUrl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.edoncore.com"
                    className="bg-secondary/50 mt-1 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="token" className="text-xs text-muted-foreground">Access key</Label>
                  <Input
                    id="token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Your EDON access key"
                    className="bg-secondary/50 mt-1"
                  />
                  <p className="text-xs text-muted-foreground/60">
                    Find your access key under API Keys at edoncore.com/account
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button onClick={testConnection} disabled={testing} variant="outline" size="sm" className="gap-2">
                    {testing ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Checking…
                      </>
                    ) : (
                      <>
                        {connectionStatus === "connected" ? (
                          <Wifi className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-3 h-3" />
                        )}
                        {connectionStatus === "connected" ? "Re-test" : "Test connection"}
                      </>
                    )}
                  </Button>
                  <Button onClick={saveSettings} size="sm" className="gap-2">
                    <Save className="w-3 h-3" />
                    Save
                  </Button>
                </div>
              </motion.div>
            )}
          </section>

        </motion.div>
      </main>
    </div>
  );
}
