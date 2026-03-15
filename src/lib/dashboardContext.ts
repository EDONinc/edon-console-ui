/**
 * Dashboard context for the side chat: everything the AI needs to answer
 * questions about the customer's audits, decisions, metrics, and policies.
 */

import { edonApi } from "@/lib/api";
import type { Decision } from "@/lib/api";

export interface DashboardContext {
  fetched_at: string;
  metrics: {
    allowed_24h?: number;
    blocked_24h?: number;
    confirm_24h?: number;
    decisions_total?: number;
    latency_p50?: number;
    latency_p95?: number;
    latency_p99?: number;
  };
  health: {
    status?: string;
    version?: string;
    uptime_seconds?: number;
    active_preset?: string;
  } | null;
  recent_decisions: Array<{
    id: string;
    timestamp: string;
    verdict: string;
    reason_code?: string | null;
    explanation?: string;
    agent_id?: string | null;
    tool?: string;
    op?: string;
  }>;
  recent_audit: Array<{
    id: string;
    timestamp: string;
    verdict: string;
    reason_code?: string | null;
    explanation?: string;
    agent_id?: string | null;
    tool?: string;
    op?: string;
  }>;
  block_reasons: Array<{ reason: string; count: number }>;
  policy_packs: Array<{ name: string; description: string; risk_level: string }>;
}

const DEFAULT_LIMIT = 40;

/**
 * Fetch all dashboard data the chat AI should know about.
 * Call this before sending a message so the backend (or local reply) can use it.
 */
export async function fetchDashboardContext(): Promise<DashboardContext> {
  const fetched_at = new Date().toISOString();

  const [metricsRes, decisionsRes, auditRes, healthRes, blockReasonsRes, policyPacksRes] =
    await Promise.allSettled([
      edonApi.getMetrics(),
      edonApi.getDecisions({ limit: DEFAULT_LIMIT }),
      edonApi.getAudit({ limit: DEFAULT_LIMIT }).catch((e) => (e?.message === "forbidden" ? { records: [], total: 0 } : Promise.reject(e))),
      edonApi.getHealth(),
      edonApi.getBlockReasons?.() ?? Promise.resolve([]),
      edonApi.getPolicyPacks?.() ?? Promise.resolve([]),
    ]);

  const metrics =
    metricsRes.status === "fulfilled"
      ? (metricsRes.value as DashboardContext["metrics"])
      : {};

  const decisions =
    decisionsRes.status === "fulfilled" && decisionsRes.value?.decisions
      ? decisionsRes.value.decisions
      : [];

  let auditRecords: Decision[] = [];
  if (auditRes.status === "fulfilled" && auditRes.value?.records) {
    auditRecords = auditRes.value.records;
  }

  const health =
    healthRes.status === "fulfilled"
      ? {
          status: (healthRes.value as { status?: string }).status,
          version: (healthRes.value as { version?: string }).version,
          uptime_seconds: (healthRes.value as { uptime_seconds?: number }).uptime_seconds,
          active_preset: (healthRes.value as { governor?: { active_preset?: { preset_name?: string } } }).governor?.active_preset?.preset_name,
        }
      : null;

  const block_reasons =
    blockReasonsRes.status === "fulfilled" && Array.isArray(blockReasonsRes.value)
      ? blockReasonsRes.value
      : [];

  const policy_packs =
    policyPacksRes.status === "fulfilled" && Array.isArray(policyPacksRes.value)
      ? policyPacksRes.value.map((p: { name: string; description?: string; risk_level?: string }) => ({
          name: p.name,
          description: p.description ?? "",
          risk_level: p.risk_level ?? "",
        }))
      : [];

  const toSummary = (d: Decision) => ({
    id: d.id ?? "",
    timestamp: d.timestamp ?? d.created_at ?? "",
    verdict: typeof d.verdict === "string" ? d.verdict : "unknown",
    reason_code: d.reason_code ?? null,
    explanation: d.explanation ?? "",
    agent_id: d.agent_id ?? null,
    tool: typeof d.tool === "object" && d.tool?.name ? d.tool.name : undefined,
    op: typeof d.tool === "object" && d.tool?.op ? d.tool.op : (typeof d.tool === "string" ? d.tool : undefined),
  });

  return {
    fetched_at,
    metrics,
    health,
    recent_decisions: decisions.slice(0, DEFAULT_LIMIT).map(toSummary),
    recent_audit: auditRecords.slice(0, DEFAULT_LIMIT).map(toSummary),
    block_reasons,
    policy_packs,
  };
}

/**
 * Generate a text summary of dashboard context for inclusion in an LLM prompt.
 * The backend can paste this into the system or user message so the model answers from real data.
 */
export function dashboardContextToPromptText(ctx: DashboardContext): string {
  const lines: string[] = [
    "## Dashboard snapshot (use this to answer the user)",
    `Fetched at: ${ctx.fetched_at}`,
    "",
    "### Metrics (24h)",
    `- Allowed: ${ctx.metrics?.allowed_24h ?? "—"}`,
    `- Blocked: ${ctx.metrics?.blocked_24h ?? "—"}`,
    `- Confirm needed: ${ctx.metrics?.confirm_24h ?? "—"}`,
    `- Total decisions: ${ctx.metrics?.decisions_total ?? "—"}`,
    ctx.metrics?.latency_p50 != null ? `- Latency p50: ${ctx.metrics.latency_p50}ms` : "",
    "",
  ];

  if (ctx.health) {
    lines.push(
      "### Gateway",
      `- Status: ${ctx.health.status ?? "—"}`,
      `- Active preset: ${ctx.health.active_preset ?? "—"}`,
      ctx.health.uptime_seconds != null
        ? `- Uptime: ${Math.floor(ctx.health.uptime_seconds / 3600)}h ${Math.floor((ctx.health.uptime_seconds % 3600) / 60)}m`
        : "",
      ""
    );
  }

  if (ctx.block_reasons.length > 0) {
    lines.push("### Top block reasons", "");
    ctx.block_reasons.slice(0, 10).forEach((r) => lines.push(`- ${r.reason}: ${r.count}`));
    lines.push("");
  }

  if (ctx.recent_decisions.length > 0) {
    lines.push("### Recent decisions (sample)", "");
    ctx.recent_decisions.slice(0, 15).forEach((d) => {
      const toolOp = d.tool && d.op ? `${d.tool}.${d.op}` : "—";
      lines.push(`- ${d.timestamp} | ${d.verdict} | ${toolOp} | ${d.reason_code ?? ""} | ${d.explanation?.slice(0, 60) ?? ""}`);
    });
    lines.push("");
  }

  if (ctx.recent_audit.length > 0) {
    lines.push("### Recent audit events (sample)", "");
    ctx.recent_audit.slice(0, 15).forEach((d) => {
      const toolOp = d.tool && d.op ? `${d.tool}.${d.op}` : "—";
      lines.push(`- ${d.timestamp} | ${d.verdict} | ${d.agent_id ?? "—"} | ${toolOp} | ${d.reason_code ?? ""}`);
    });
    lines.push("");
  }

  if (ctx.policy_packs.length > 0) {
    lines.push("### Policy packs", "");
    ctx.policy_packs.forEach((p) => lines.push(`- ${p.name}: ${p.description} (${p.risk_level})`));
  }

  return lines.filter(Boolean).join("\n");
}

/**
 * Local reply when the backend is unavailable or in demo mode:
 * answer from the actual dashboard context so the user gets accurate info.
 */
export function getDashboardAwareReply(query: string, ctx: DashboardContext): string {
  const q = query.toLowerCase().trim();

  // Metrics
  if (/how many|count|total|allowed|blocked|confirm|escalat/i.test(q) && /24|today|recent/i.test(q) || /what('s|s) (my )?(allowed|blocked|metrics)/i.test(q)) {
    const a = ctx.metrics?.allowed_24h ?? 0;
    const b = ctx.metrics?.blocked_24h ?? 0;
    const c = ctx.metrics?.confirm_24h ?? 0;
    return `In the last 24h: **${a}** allowed, **${b}** blocked, **${c}** confirm/escalate. Total decisions: ${ctx.metrics?.decisions_total ?? a + b + c}.`;
  }

  // Block reasons
  if (/why (are|were|was) (they|actions?)? blocked|block reason|top reason|most blocked/i.test(q)) {
    if (ctx.block_reasons.length === 0) {
      return "No block-reason breakdown available. Check Audit or Decisions and filter by verdict = blocked to see explanations.";
    }
    const top = ctx.block_reasons.slice(0, 5).map((r) => `**${r.reason}**: ${r.count}`).join("; ");
    return `Top block reasons: ${top}.`;
  }

  // Recent blocked
  if (/recent (blocked|blocks)|last blocked|what (was|were) blocked/i.test(q)) {
    const blocked = [...ctx.recent_decisions, ...ctx.recent_audit].filter((d) => d.verdict === "blocked" || d.verdict === "BLOCK").slice(0, 10);
    if (blocked.length === 0) {
      return "No blocked decisions in the recent sample. Your metrics may still show blocked count from the last 24h.";
    }
    const lines = blocked.map((d) => {
      const toolOp = d.tool && d.op ? `${d.tool}.${d.op}` : "—";
      return `- ${toolOp} — ${d.reason_code ?? "unknown"} — ${d.explanation?.slice(0, 80) ?? ""}`;
    });
    return "Recent blocked:\n" + lines.join("\n");
  }

  // Audit
  if (/audit|audit log|what (happened|happens) in (the )?audit/i.test(q)) {
    const n = ctx.recent_audit.length;
    if (n === 0) {
      return "No audit events in the recent fetch. Audit shows every governance decision; use the Audit page to filter by verdict, agent, or time.";
    }
    const sample = ctx.recent_audit.slice(0, 5).map((d) => `${d.verdict} ${d.agent_id ?? ""} ${d.tool ?? ""}.${d.op ?? ""}`).join("; ");
    return `Recent audit (${n} events in context): ${sample}. Open the Audit page for full history and filters.`;
  }

  // Decisions
  if (/decision|decisions (page|list)/i.test(q)) {
    const n = ctx.recent_decisions.length;
    const byVerdict = ctx.recent_decisions.reduce((acc, d) => {
      const v = d.verdict;
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return `Recent decisions in context: ${n}. By verdict: ${JSON.stringify(byVerdict)}. Use the Decisions page to filter and search.`;
  }

  // Policy / preset
  if (/policy|preset|active (policy|preset)/i.test(q)) {
    const preset = ctx.health?.active_preset ?? "—";
    const packs = ctx.policy_packs.map((p) => p.name).join(", ");
    return `Active preset: **${preset}**. Available policy packs: ${packs || "—"}. Change in Policies or Settings.`;
  }

  // Health / status
  if (/status|health|connected|gateway/i.test(q)) {
    const status = ctx.health?.status ?? "unknown";
    const preset = ctx.health?.active_preset ?? "—";
    const uptime = ctx.health?.uptime_seconds;
    const uptimeStr = uptime != null ? ` Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m.` : "";
    return `Gateway status: **${status}**. Active preset: **${preset}**.${uptimeStr}`;
  }

  // Help
  if (/help|what can you|how (do i|to)|explain/i.test(q)) {
    return "I can answer about your **dashboard data**: metrics (allowed/blocked/confirm in 24h), **block reasons**, **recent blocked decisions**, **audit** and **decisions** samples, **policy/preset**, and **gateway status**. Ask e.g. 'How many blocked in 24h?', 'Why were actions blocked?', 'Recent blocked?', 'What's in the audit?', 'Active policy?'.";
  }

  return "I have access to your dashboard snapshot (metrics, recent decisions, audit, block reasons, policy). Ask about allowed/blocked counts, why something was blocked, recent audit, or active policy. If your chat backend is connected, it also receives this context to give detailed answers.";
}
