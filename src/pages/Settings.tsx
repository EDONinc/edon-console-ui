import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { edonApi } from "@/lib/api";
import { Lock, Zap, Check, Save, Wifi, WifiOff, ChevronRight } from "lucide-react";
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
    (isProd ? "https://api.edoncore.com" : "http://127.0.0.1:8000");
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
  { packName: "personal_safe", label: "Safe Mode", icon: Lock, description: "Blocks high-risk actions automatically. Low-risk allowed.", default: true },
  { packName: "work_safe", label: "Business Mode", icon: Zap, description: "Allows workflows that affect business operations. Medium-risk allowed.", default: false },
] as const;

export default function Settings() {
  const { toast } = useToast();
  const isProd = import.meta.env.MODE === "production";

  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8000");
  const [token, setToken] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "failed">("unknown");
  const [testing, setTesting] = useState(false);
  const [applyingSafety, setApplyingSafety] = useState<string | null>(null);

  const [userName, setUserName] = useState<string>("");
  const [planName, setPlanName] = useState<string>("Pro");
  const [decisionsUsed, setDecisionsUsed] = useState<number | null>(null);
  const [decisionsLimit, setDecisionsLimit] = useState<number | null>(null);
  const [safetyPreset, setSafetyPreset] = useState<string | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(false);

  useEffect(() => {
    const envUrl = import.meta.env.VITE_EDON_GATEWAY_URL as string | undefined;
    const envToken = import.meta.env.VITE_EDON_API_TOKEN as string | undefined;
    setBaseUrl(getStoredBaseUrl(envUrl, isProd));
    setToken(getStoredToken(envToken));
    setUserName(localStorage.getItem(EMAIL_KEY) || "User");
    setPlanName(localStorage.getItem(PLAN_KEY) || "Pro");
  }, [isProd]);

  const persist = (trimmedBase: string, trimmedToken: string) => {
    localStorage.setItem(BASE_URL_KEY, trimmedBase);
    localStorage.setItem(TOKEN_KEY, trimmedToken);
    localStorage.setItem("EDON_BASE_URL", trimmedBase);
    localStorage.setItem("edon_base_url", trimmedBase);
  };

  const loadAccountAndIntegrations = async () => {
    const t = getStoredToken();
    if (!t || !isLikelyToken(t)) return;

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
      setTelegramConnected(false);
    }
  };

  useEffect(() => {
    loadAccountAndIntegrations();
  }, [token]);

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
      toast({ title: "Invalid base URL", description: "Enter a valid http(s) URL.", variant: "destructive" });
      return;
    }
    if (!isLikelyToken(trimmedToken)) {
      toast({ title: "Invalid access key", description: "Access key format looks invalid.", variant: "destructive" });
      return;
    }

    persist(safeBase, trimmedToken);
    toast({ title: "Settings saved", description: "Your configuration has been saved." });
  };

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("unknown");
    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();
    const safeBase = normalizeBaseUrl(trimmedBase);

    try {
      if (!safeBase || !isLikelyToken(trimmedToken)) {
        throw new Error("Set a valid base URL and access key first.");
      }
      persist(safeBase, trimmedToken);
      const base = safeBase.replace(/\/$/, "");
      const res = await fetch(`${base}/health`, {
        method: "GET",
        headers: { "X-EDON-TOKEN": trimmedToken },
      });
      if (res.status === 401) throw new Error("401 — access key not accepted.");
      if (!res.ok) throw new Error(`Connection error ${res.status}. ${await safeText(res)}`);

      setConnectionStatus("connected");
      toast({ title: "Connected", description: "Connection verified." });
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

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="container mx-auto px-6 py-8 max-w-xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* 1. Minimal header */}
          <header className="mb-8">
            <h1 className="text-xl font-semibold tracking-wide text-foreground/90">Account & Settings</h1>
            <div className="mt-2 h-px bg-white/10" aria-hidden />
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>Signed in: <span className="text-foreground/90">{userName || "User"}</span></span>
              <span>Plan: <span className="text-foreground/90">{planName || "Pro"}</span></span>
            </div>
          </header>

          {/* 2. Usage & Safety — front and center */}
          <section className="space-y-6 mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Usage & Safety</h2>

            {/* Plan & Usage */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Plan & Usage</p>
                {planName && planName !== "free" && planName !== "" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 capitalize">
                    {planName}
                  </span>
                )}
              </div>
              <p className="text-lg font-medium">
                {decisionsUsed != null && decisionsLimit != null
                  ? `${decisionsUsed.toLocaleString()} / ${decisionsLimit.toLocaleString()} decisions`
                  : decisionsUsed != null
                    ? `${decisionsUsed.toLocaleString()} decisions used`
                    : "Usage data loading…"}
              </p>
              {decisionsLimit != null && decisionsUsed != null && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(100, (decisionsUsed / decisionsLimit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {Math.max(0, decisionsLimit - decisionsUsed).toLocaleString()} decisions remaining this month
                  </p>
                </div>
              )}
            </div>

            {/* Safety Mode — prominent, simple */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Safety Mode</p>
                <Link to="/policies" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">Manage <ChevronRight className="h-3.5 w-3.5" /></Link>
              </div>
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                Control how much autonomy your agents have — from fully supervised to always-on.
              </p>
              <div className="space-y-3">
                {SAFETY_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = activeSafetyPack === mode.packName;
                  return (
                    <button
                      key={mode.packName}
                      type="button"
                      onClick={() => !isActive && applySafetyMode(mode.packName)}
                      disabled={applyingSafety === mode.packName}
                      className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-primary/50 bg-primary/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                        <Icon className="h-4 w-4 text-foreground/90" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium flex items-center gap-2">
                          {mode.label}
                          {mode.label === "Safe Mode" ? <Check className="h-4 w-4 text-muted-foreground shrink-0" /> : <Zap className="h-4 w-4 text-amber-400 shrink-0" />}
                          {isActive && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{mode.description}</p>
                      </div>
                      {applyingSafety === mode.packName && (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Connected Channels */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Connected Channels</h2>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Telegram</span>
                {telegramConnected ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <span className="text-xs text-muted-foreground">Not connected</span>
                )}
              </div>
            </div>
          </section>

          {/* Upgrade prompt for non-enterprise users */}
          {planName && !["business", "enterprise"].includes(planName.toLowerCase()) && (
            <div className="glass-card p-5 mb-6 border border-primary/20">
              <p className="text-sm font-medium mb-1">Unlock more governance</p>
              <p className="text-xs text-muted-foreground mb-3">
                {!planName || planName === "free"
                  ? "Free plan includes 100K decisions/mo and 1 agent. Upgrade to scale."
                  : planName === "starter"
                  ? "Starter includes 500K decisions/mo. Upgrade to Growth for 5M decisions and 25 agents."
                  : "Upgrade to Business for 25M decisions, 100 agents, and the full compliance suite."}
              </p>
              <Link to="/pricing" className="text-xs font-medium text-primary hover:underline">
                View plans →
              </Link>
            </div>
          )}

          {/* Minimal connection (collapsed / advanced) */}
          <details className="glass-card">
            <summary className="px-5 py-3 text-sm text-muted-foreground cursor-pointer hover:text-foreground/80 list-none flex items-center justify-between">
              <span>Connection & access key</span>
              <span className="text-xs text-muted-foreground/50">▸</span>
            </summary>
            <div className="px-5 pb-5 pt-1 space-y-3 border-t border-white/10">
              <div>
                <Label htmlFor="baseUrl" className="text-xs text-muted-foreground">Connection URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8000"
                  className="bg-secondary/50 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="token" className="text-xs text-muted-foreground">EDON access key</Label>
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your EDON access key"
                  className="bg-secondary/50 mt-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={testConnection} disabled={testing} variant="outline" size="sm" className="gap-2">
                  {testing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </>
                  ) : (
                    <>
                      {connectionStatus === "connected" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {connectionStatus === "connected" ? "Connected" : "Test connection"}
                    </>
                  )}
                </Button>
                <Button onClick={saveSettings} size="sm" className="gap-2">
                  <Save className="w-3 h-3" />
                  Save
                </Button>
              </div>
            </div>
          </details>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Manage your subscription and API keys at{" "}
            <a href="https://edoncore.com/account" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              edoncore.com/account
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
