import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { edonApi, PlanInfo } from "@/lib/edonApi";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const FALLBACK_PLANS: PlanInfo[] = [
  {
    name: "Free",
    slug: "free",
    price_usd: 0,
    decisions_per_month: 100000,
    max_agents: 1,
    audit_retention_days: 7,
    compliance_suite: false,
  },
  {
    name: "Starter",
    slug: "starter",
    price_usd: 49,
    decisions_per_month: 500000,
    max_agents: 5,
    audit_retention_days: 90,
    compliance_suite: false,
  },
  {
    name: "Growth",
    slug: "growth",
    price_usd: 199,
    decisions_per_month: 5000000,
    max_agents: 25,
    audit_retention_days: 365,
    compliance_suite: false,
  },
  {
    name: "Business",
    slug: "business",
    price_usd: 499,
    decisions_per_month: 25000000,
    max_agents: 100,
    audit_retention_days: 1095,
    compliance_suite: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    price_usd: null,
    decisions_per_month: null,
    max_agents: null,
    audit_retention_days: null,
    compliance_suite: true,
    contact_us: true,
  },
];

function fmt(n: number | null) {
  if (n === null) return "Unlimited";
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

function fmtRetention(days: number | null) {
  if (days === null) return "Unlimited retention";
  if (days === 7) return "7-day retention";
  if (days >= 365) return `${Math.round(days / 365)}-year retention`;
  return `${days}-day retention`;
}

export default function Pricing() {
  const [plans, setPlans] = useState<PlanInfo[]>(FALLBACK_PLANS);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    edonApi
      .getPlans()
      .then((d) => {
        if (Array.isArray(d.plans) && d.plans.length > 0) {
          setPlans(d.plans);
        }
      })
      .catch(() => {});
  }, []);

  const safeRedirect = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'checkout.stripe.com' || parsed.hostname === 'checkout.edoncore.com' || parsed.hostname === 'billing.stripe.com') {
        window.location.href = url;
      }
    } catch {
      // invalid URL, do nothing
    }
  };

  async function handleUpgrade(plan: PlanInfo) {
    if (plan.contact_us) {
      window.location.href = "mailto:sales@edoncore.com?subject=Enterprise Inquiry";
      return;
    }
    setCheckingOut(plan.slug);
    try {
      const result = await edonApi.checkout(plan.slug);
      if (result.checkout_url) {
        safeRedirect(result.checkout_url);
      } else {
        alert(result.message || "Contact sales@edoncore.com to upgrade.");
      }
    } catch {
      alert("Error starting checkout. Contact sales@edoncore.com");
    } finally {
      setCheckingOut(null);
    }
  }

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="container mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-2xl font-bold mb-2">Plans & Pricing</h1>
            <p className="text-muted-foreground">
              Real-time governance for every AI action — from prototype to production.
            </p>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10 pt-4">
            {(() => {
              const PLAN_TAGLINES: Record<string, string> = {
                free:       "Explore governance at zero cost",
                starter:    "For growing teams shipping AI fast",
                growth:     "Scale confidently with full coverage",
                business:   "Mission-critical governance and compliance",
                enterprise: "Custom infrastructure for regulated industries",
              };
              return plans.map((plan, i) => {
              const isHighlighted = plan.slug === "growth";
              return (
                <div key={plan.slug} className="relative">
                  {isHighlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap">
                      Best value
                    </div>
                  )}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`glass-card p-5 flex flex-col gap-4 h-full ${
                    isHighlighted
                      ? "border border-primary/50 shadow-lg shadow-primary/10"
                      : ""
                  }`}
                >

                  {/* Plan name & price */}
                  <div>
                    <p className="text-sm font-semibold text-foreground/90">{plan.name}</p>
                    {PLAN_TAGLINES[plan.slug] && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{PLAN_TAGLINES[plan.slug]}</p>
                    )}
                    <p className="text-2xl font-bold mt-1">
                      {plan.price_usd === null
                        ? "Custom"
                        : plan.price_usd === 0
                        ? "Free"
                        : `$${plan.price_usd}`}
                      {plan.price_usd !== null && plan.price_usd > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      )}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="text-xs text-muted-foreground space-y-2 flex-1">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      {fmt(plan.decisions_per_month)} decisions/mo
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      {plan.max_agents === null ? "Unlimited" : plan.max_agents}{" "}
                      agent{plan.max_agents === 1 ? "" : "s"}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      {fmtRetention(plan.audit_retention_days)}
                    </li>
                    {plan.compliance_suite && (
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                        <span className="text-primary font-medium">Full compliance suite</span>
                      </li>
                    )}
                  </ul>

                  {/* CTA */}
                  <Button
                    onClick={() => handleUpgrade(plan)}
                    disabled={checkingOut === plan.slug || plan.slug === "free"}
                    variant={plan.slug === "free" ? "outline" : isHighlighted ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                  >
                    {checkingOut === plan.slug ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading…
                      </span>
                    ) : plan.slug === "free" ? (
                      "Current plan"
                    ) : plan.contact_us ? (
                      "Contact sales"
                    ) : plan.slug === "starter" ? (
                      "Start with Starter"
                    ) : plan.slug === "growth" ? (
                      "Upgrade to Growth"
                    ) : plan.slug === "business" ? (
                      "Go Business"
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                </motion.div>
                </div>
              );
              });
            })()}
          </div>

          {/* Enterprise Volume Table */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-1">Enterprise — Built for Scale</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground mb-4">
              <span>+ <strong className="text-foreground">$15K/mo</strong> enterprise platform (unlimited agents, SLA, dedicated support)</span>
              <span>+ <strong className="text-foreground">$10K/mo</strong> compliance suite (EU AI Act, NIST, SOC 2, ISO 42001)</span>
              <span>+ <strong className="text-foreground">Custom</strong> EDON Core predictive intelligence (quoted per engagement)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm w-full max-w-md">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-muted-foreground font-medium">
                      Monthly volume
                    </th>
                    <th className="text-left py-2 text-muted-foreground font-medium">
                      Price / decision
                    </th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    ["0 – 1B/mo", "$0.0001"],
                    ["1B – 10B/mo", "$0.000075"],
                    ["10B – 100B/mo", "$0.00005"],
                    ["100B – 1T/mo", "$0.000025"],
                    ["1T+/mo", "$0.00001"],
                  ].map(([vol, price]) => (
                    <tr key={vol} className="border-b border-white/5">
                      <td className="py-2">{vol}</td>
                      <td className="py-2 font-mono">{price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Contact{" "}
              <a
                href="mailto:sales@edoncore.com"
                className="text-primary hover:underline"
              >
                sales@edoncore.com
              </a>{" "}
              for a custom volume agreement and pilot program.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
