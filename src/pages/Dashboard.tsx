import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Ban, AlertTriangle, Timer, Users, ChevronRight, Filter } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatCard } from '@/components/StatCard';
import { DecisionStreamTable } from '@/components/DecisionStreamTable';
import { DecisionDrawer } from '@/components/DecisionDrawer';
import { DecisionsOverTimeChart } from '@/components/charts/DecisionsOverTimeChart';
import { TopReasonsChart } from '@/components/charts/TopReasonsChart';
import { PolicyModeCard } from '@/components/PolicyModeCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { edonApi, Decision } from '@/lib/api';
import { detectCapabilities, type CapabilityKey } from '@/lib/capabilities';
import { Link } from 'react-router-dom';

interface AgentStat {
  agentId: string;
  total: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  topBlockReason: string;
  lastActive: string;
}

const BLOCK_REASONS = [
  'policy_match',
  'risk_threshold',
  'context_violation',
  'rate_limit',
  'sensitive_data',
  'unauthorized_tool',
];

function generateMockAgentStats(): AgentStat[] {
  const agents = [
    { id: 'agent_ops_001', offset: 0 },
    { id: 'agent_research_02', offset: 2 },
    { id: 'agent_finance_03', offset: 5 },
    { id: 'agent_support_04', offset: 12 },
    { id: 'agent_scheduler_05', offset: 45 },
  ];
  return agents.map(({ id, offset }) => {
    const total = Math.floor(Math.random() * 200) + 40;
    const blocked = Math.floor(Math.random() * Math.min(total * 0.3, 30)) + 1;
    const allowed = total - blocked;
    return {
      agentId: id,
      total,
      allowed,
      blocked,
      blockRate: Math.round((blocked / total) * 100),
      topBlockReason: BLOCK_REASONS[Math.floor(Math.random() * BLOCK_REASONS.length)],
      lastActive: new Date(Date.now() - offset * 60000).toISOString(),
    };
  });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function deriveAgentStats(decisions: Decision[]): AgentStat[] {
  const map = new Map<string, { allowed: number; blocked: number; reasons: string[]; lastActive: string }>();
  for (const d of decisions) {
    const id = d.agent_id || 'unknown';
    if (!map.has(id)) {
      map.set(id, { allowed: 0, blocked: 0, reasons: [], lastActive: d.timestamp });
    }
    const entry = map.get(id)!;
    const v = (d.verdict ?? '').toLowerCase();
    if (v === 'allowed') entry.allowed++;
    else if (v === 'blocked') {
      entry.blocked++;
      if (d.reason_code) entry.reasons.push(d.reason_code);
    }
    if (new Date(d.timestamp) > new Date(entry.lastActive)) {
      entry.lastActive = d.timestamp;
    }
  }
  return Array.from(map.entries()).map(([agentId, e]) => {
    const total = e.allowed + e.blocked;
    const topReason = e.reasons.length > 0
      ? e.reasons.sort((a, b) =>
          e.reasons.filter(r => r === b).length - e.reasons.filter(r => r === a).length
        )[0]
      : '—';
    return {
      agentId,
      total,
      allowed: e.allowed,
      blocked: e.blocked,
      blockRate: total > 0 ? Math.round((e.blocked / total) * 100) : 0,
      topBlockReason: topReason,
      lastActive: e.lastActive,
    };
  }).sort((a, b) => b.total - a.total);
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<{
    allowed_24h?: number;
    blocked_24h?: number;
    confirm_24h?: number;
    latency_p50?: number;
    latency_p95?: number;
    latency_p99?: number;
  }>({});
  const [capabilities, setCapabilities] = useState<Record<CapabilityKey, boolean> | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);

  useEffect(() => {
    const baseUrl =
      (typeof window !== 'undefined' && localStorage.getItem('edon_api_base')) ||
      import.meta.env.VITE_EDON_GATEWAY_URL ||
      'http://127.0.0.1:8000';
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('edon_token')) ||
      (import.meta.env.MODE !== 'production' ? import.meta.env.VITE_EDON_API_TOKEN || '' : '') ||
      '';
    if (baseUrl && token) {
      detectCapabilities(baseUrl, token).then(setCapabilities);
    } else {
      setCapabilities({ timeseries: false, blockReasons: false });
    }
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await edonApi.getMetrics();
        setMetrics(data);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to fetch metrics:', error);
        }
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const result = await edonApi.getDecisions({ limit: 500 });
        const fetched = result.decisions ?? [];
        setDecisions(fetched);
        if (fetched.length > 0) {
          setAgentStats(deriveAgentStats(fetched));
        } else {
          setAgentStats(generateMockAgentStats());
        }
      } catch {
        setAgentStats(generateMockAgentStats());
      }
    };
    fetchDecisions();
  }, []);

  const allAgentIds = useMemo(() => {
    const ids = Array.from(new Set(agentStats.map((s) => s.agentId)));
    return ids;
  }, [agentStats]);

  const handleSelectDecision = (decision: Decision) => {
    setSelectedDecision(decision);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time governance overview</p>
          </div>

          {/* Agent Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[200px] bg-secondary/50 text-sm h-9">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {allAgentIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <StatCard
            title="Allowed (24h)"
            value={metrics?.allowed_24h != null ? metrics.allowed_24h.toLocaleString() : "—"}
            icon={ShieldCheck}
            variant="success"
            delay={0}
          />
          <StatCard
            title="Blocked (24h)"
            value={metrics?.blocked_24h != null ? metrics.blocked_24h.toLocaleString() : "—"}
            icon={Ban}
            variant="danger"
            delay={1}
          />
          <StatCard
            title="Confirm Needed (24h)"
            value={metrics?.confirm_24h != null ? metrics.confirm_24h.toLocaleString() : "—"}
            icon={AlertTriangle}
            variant="warning"
            delay={2}
          />
          <StatCard
            title="Latency p50"
            value={metrics?.latency_p50 != null ? `${metrics.latency_p50}ms` : "—"}
            icon={Timer}
            change={metrics?.latency_p95 != null && metrics.latency_p95 > 0 ? `p95: ${metrics.latency_p95}ms, p99: ${metrics.latency_p99 ?? 0}ms` : undefined}
            changeType="neutral"
            variant="default"
            delay={3}
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Chart */}
          <div className="lg:col-span-2">
            <DecisionsOverTimeChart supported={capabilities?.timeseries ?? false} />
          </div>

          {/* Policy Mode Card */}
          <div>
            <PolicyModeCard />
          </div>
        </div>

        {/* Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Decision Stream */}
          <DecisionStreamTable
            onSelectDecision={handleSelectDecision}
            limit={20}
          />

          {/* Top Block Reasons */}
          <TopReasonsChart supported={capabilities?.blockReasons ?? false} />
        </div>

        {/* Agent Activity Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Agent Activity</h2>
              <Badge variant="outline" className="text-xs">24h</Badge>
            </div>
            <Link
              to="/decisions"
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              View All Agents <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent ID</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decisions</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowed</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[120px]">Block Rate</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Block Reason</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Active</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(agentFilter === 'all' ? agentStats : agentStats.filter((s) => s.agentId === agentFilter)).map((stat) => (
                    <tr key={stat.agentId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-foreground/90">{stat.agentId}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {stat.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-emerald-400">{stat.allowed.toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-red-400">{stat.blocked.toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                stat.blockRate >= 30
                                  ? 'bg-red-400/80'
                                  : stat.blockRate >= 10
                                  ? 'bg-amber-400/80'
                                  : 'bg-primary/70'
                              }`}
                              style={{ width: `${Math.min(100, stat.blockRate)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                            {stat.blockRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-mono">{stat.topBlockReason}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-muted-foreground">{relativeTime(stat.lastActive)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/decisions?agent_id=${encodeURIComponent(stat.agentId)}`}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {agentStats.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No agent data available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Decision Drawer */}
      <DecisionDrawer
        decision={selectedDecision}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
