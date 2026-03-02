import { useState } from "react";
import { Button } from "@/components/ui/button";

const isLikelyToken = (s: string) =>
  /^(edon_[A-Za-z0-9._-]{16,}|[a-f0-9]{64}|[a-f0-9]{128}|[A-Za-z0-9._-]{24,})$/i.test(s);

export const AccessGate = () => {
  const [showManual, setShowManual] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  const handleConnect = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter your access key.");
      return;
    }
    if (!isLikelyToken(trimmed)) {
      setError("Key format doesn't look right. Check and try again.");
      return;
    }
    localStorage.setItem("edon_token", trimmed);
    localStorage.setItem("edon_api_key", trimmed);
    localStorage.setItem("edon_session_token", trimmed);
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
              <Button className="flex-1" onClick={handleConnect}>
                Connect
              </Button>
              <Button variant="outline" onClick={() => { setShowManual(false); setKey(""); setError(""); }}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
