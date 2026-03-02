import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { edonApi, PlanInfo } from "@/lib/edonApi";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Marketing site: pricing (pay here) and account (land after payment). */
const MARKETING_BASE =
  (import.meta.env.VITE_MARKETING_URL as string) || "https://edoncore.com";
const MARKETING_PRICING = `${MARKETING_BASE}/pricing`;
const MARKETING_ACCOUNT = `${MARKETING_BASE}/account`;
const MARKETING_CONTACT = `${MARKETING_BASE}/contact`;

const ENTERPRISE_PLAN: PlanInfo = {
  name: "Enterprise",
  slug: "enterprise",
  price_usd: null,
  decisions_per_month: null,
  max_agents: null,
  audit_retention_days: null,
  compliance_suite: true,
  contact_us: true,
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
  ENTERPRISE_PLAN,
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

  useEffect(() => {
    edonApi
      .getPlans()
      .then((d) => {
        if (Array.isArray(d.plans) && d.plans.length > 0) {
          const fromApi = d.plans as PlanInfo[];
          const hasEnterprise = fromApi.some((p) => p.slug === "enterprise");
          setPlans(hasEnterprise ? fromApi : [...fromApi, ENTERPRISE_PLAN]);
        }
      })
      .catch(() => {});
  }, []);

  function handleUpgrade(plan: PlanInfo) {
    if (plan.slug === "free") return;
    if (plan.contact_us) {
      window.location.href = MARKETING_CONTACT;
      return;
    }
    // Send users to marketing site to pay; after payment they land on account page there
    window.location.href = MARKETING_PRICING;
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 pt-4">
            {(() => {
              const PLAN_TAGLINES: Record<string, string> = {
                free:       "Explore governance at zero cost",
                scale:      "5M decisions, drift detection, alerts, basic audit export",
                pro:        "25M decisions, AI governance assistant, compliance, priority support",
                enterprise: "Custom infrastructure for regulated industries",
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
                    disabled={plan.slug === "free"}
                    variant={plan.slug === "free" ? "outline" : isHighlighted ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                  >
                    {plan.slug === "free" ? (
                      "Current plan"
                    ) : plan.slug === "scale" ? (
                      "Get Scale"
                    ) : plan.slug === "pro" ? (
                      "Get Pro"
                    ) : plan.contact_us ? (
                      "Contact sales"
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
            Questions or need a custom plan?{" "}
            <a href={MARKETING_CONTACT} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Contact us
            </a>
            .
          </p>
        </motion.div>
      </main>
    </div>
  );
}
