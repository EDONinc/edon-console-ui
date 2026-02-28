import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { edonApi, PlanInfo } from "@/lib/edonApi";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Stripe checkout URLs per plan (env overrides optional). */
const STRIPE_LINKS: Record<string, string> = {
  scale: (import.meta.env.VITE_STRIPE_LINK_SCALE as string) || "https://checkout.edoncore.com/b/3cI6oGeKAehceAq5fafIs0a",
  pro: (import.meta.env.VITE_STRIPE_LINK_PRO as string) || "https://checkout.edoncore.com/b/9B67sK5a04GC4ZQ7nifIs09",
};

const FALLBACK_PLANS: PlanInfo[] = [
  {
    name: "Free",
    slug: "free",
    price_usd: 0,
    decisions_per_month: 50000,
    max_agents: 3,
    audit_retention_days: 7,
    compliance_suite: false,
  },
  {
    name: "Scale",
    slug: "scale",
    price_usd: 150,
    decisions_per_month: 5000000,
    max_agents: 100,
    audit_retention_days: 90,
    compliance_suite: false,
  },
  {
    name: "Pro",
    slug: "pro",
    price_usd: 600,
    decisions_per_month: 25000000,
    max_agents: 1000,
    audit_retention_days: 365,
    compliance_suite: true,
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
      const allowed =
        parsed.hostname === "checkout.stripe.com" ||
        parsed.hostname === "buy.stripe.com" ||
        parsed.hostname === "checkout.edoncore.com" ||
        parsed.hostname === "billing.stripe.com";
      if (allowed) window.location.href = url;
    } catch {
      // invalid URL, do nothing
    }
  };

  function getStripeLink(plan: PlanInfo): string | null {
    if (plan.slug === "free" || plan.contact_us) return null;
    const link = STRIPE_LINKS[plan.slug];
    return link && link.trim() ? link.trim() : null;
  }

  async function handleUpgrade(plan: PlanInfo) {
    if (plan.slug === "free") return;
    const stripeLink = getStripeLink(plan);
    if (stripeLink) {
      safeRedirect(stripeLink);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 pt-4">
            {(() => {
              const PLAN_TAGLINES: Record<string, string> = {
                free:  "Explore governance at zero cost",
                scale: "5M decisions, drift detection, alerts, basic audit export",
                pro:   "25M decisions, AI governance assistant, compliance, priority support",
              };
              return plans.map((plan, i) => {
              const isHighlighted = plan.slug === "scale";
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
                    ) : plan.slug === "scale" ? (
                      "Get Scale"
                    ) : plan.slug === "pro" ? (
                      "Get Pro"
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

          <p className="text-sm text-muted-foreground">
            Questions or need a custom plan? Contact{" "}
            <a href="mailto:sales@edoncore.com" className="text-primary hover:underline">
              sales@edoncore.com
            </a>
            .
          </p>
        </motion.div>
      </main>
    </div>
  );
}
