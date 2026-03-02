import { useState } from "react";
import { Button } from "@/components/ui/button";
import { edonApi } from "@/lib/api";

const isLikelyToken = (s: string) =>
  /^(edon_[A-Za-z0-9._-]{16,}|[a-f0-9]{64}|[a-f0-9]{128}|[A-Za-z0-9._-]{24,})$/i.test(s);

export const AccessGate = () => {
  const [showManual, setShowManual] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter your access key.");
      return;
    }
    if (!isLikelyToken(trimmed)) {
      setError("Key format doesn't look right. Check and try again.");
      return;
    }
    setConnecting(true);
    localStorage.setItem("edon_token", trimmed);
    localStorage.setItem("edon_api_key", trimmed);
    localStorage.setItem("edon_session_token", trimmed);

    try {
      // Verify the key and pull email/plan in one shot — surfaces bad keys early
      const session = await edonApi.getSession();
      if (session?.email) localStorage.setItem("edon_user_email", session.email);
      if (session?.plan) localStorage.setItem("edon_plan", session.plan);
    } catch {
      // 401 → api.ts already cleared the token keys; show an error and stay
      if (!localStorage.getItem("edon_token")) {
        setError("Key not recognised by the gateway. Check and try again.");
        setConnecting(false);
        return;
      }
      // Network/other error — proceed; Settings will retry on load
    }

    window.dispatchEvent(new Event("edon-auth-updated"));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
        <img src="/edon-logo.svg" alt="EDON" className="h-12 w-12 mx-auto mb-4 object-contain" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          EDON Governance Console
        </p>
        <h1 className="text-2xl font-semibold mb-3">Access key required</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Sign in at edoncore.com to open this console with your access key automatically
          passed through — or enter your key manually below.
        </p>

        {!showManual ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="https://edoncore.com/login" className="w-full">
              <Button className="w-full">Sign in on edoncore.com</Button>
            </a>
            <Button variant="outline" className="w-full" onClick={() => setShowManual(true)}>
              Enter access key manually
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
              placeholder="edon_••••••••••••"
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleConnect} disabled={connecting}>
                {connecting && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {connecting ? "Connecting…" : "Connect"}
              </Button>
              <Button variant="outline" onClick={() => { setShowManual(false); setKey(""); setError(""); }} disabled={connecting}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
