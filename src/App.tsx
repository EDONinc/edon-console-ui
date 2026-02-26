import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Decisions from "./pages/Decisions";
import Audit from "./pages/Audit";
import Policies from "./pages/Policies";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Integrations from "./pages/Integrations";
import Quickstart from "./pages/Quickstart";
import NotFound from "./pages/NotFound";
import { AccessGate } from "@/components/AccessGate";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();
  const [hasToken, setHasToken] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      localStorage.getItem("edon_token") ||
      localStorage.getItem("edon_api_key") ||
      localStorage.getItem("edon_session_token")
    );
  });
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      setHasToken(Boolean(
        localStorage.getItem("edon_token") ||
        localStorage.getItem("edon_api_key") ||
        localStorage.getItem("edon_session_token")
      ));
      setMockMode(false);
    };

    refresh();

    const handleStorage = () => refresh();
    const handleAuth = () => refresh();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("edon-auth-updated", handleAuth as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("edon-auth-updated", handleAuth as EventListener);
    };
  }, [location.pathname]);

  if (!hasToken && location.pathname !== "/settings" && location.pathname !== "/quickstart" && location.pathname !== "/pricing") {
    return <AccessGate />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/decisions" element={<Decisions />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="/policies" element={<Policies />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="/quickstart" element={<Quickstart />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const baseUrl = (params.get("base") || params.get("gateway") || "").trim();
    const token = (params.get("token") || "").trim();
    localStorage.setItem("edon_mock_mode", "false");

    const sanitizeBaseUrl = (value: string) => {
      if (!value) return "";
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) return "";
        return url.origin;
      } catch {
        return "";
      }
    };

    const isLikelyToken = (value: string) => /^[A-Za-z0-9._-]{20,}$/.test(value);

    const safeBaseUrl = sanitizeBaseUrl(baseUrl);
    const safeToken = isLikelyToken(token) ? token : "";

    if (safeBaseUrl) {
      localStorage.setItem("edon_api_base", safeBaseUrl);
      localStorage.setItem("EDON_BASE_URL", safeBaseUrl);
      localStorage.setItem("edon_base_url", safeBaseUrl);
      localStorage.setItem("edon_mock_mode", "false");
    }

    if (safeToken) {
      localStorage.setItem("edon_token", safeToken);
      localStorage.setItem("edon_session_token", safeToken);
      localStorage.setItem("edon_api_key", safeToken);
      localStorage.setItem("edon_mock_mode", "false");
    }

    if (safeBaseUrl || safeToken) {
      params.delete("base");
      params.delete("gateway");
      params.delete("token");
      const cleaned = params.toString();
      const nextUrl = `${window.location.pathname}${cleaned ? `?${cleaned}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", nextUrl);
      window.dispatchEvent(new Event("edon-auth-updated"));
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
