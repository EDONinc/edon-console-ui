import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shield, ShieldCheck, ShieldAlert, Zap, Check, ChevronRight, RefreshCcw, Lock, Briefcase, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { edonApi, isMockMode, getToken } from '@/lib/api';

interface PolicyPack {
  name: string;
  description: string;
  risk_level: string;
  scope_summary: Record<string, number>;
  constraints_summary: {
    allowed_tools: number;
    blocked_tools: number;
    confirm_required: boolean;
  };
}

interface PolicyPackWithMeta extends PolicyPack {
  icon: typeof Shield;
  color: string;
  bgGradient: string;
}

interface CustomPolicy {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

const PLAN_KEY = 'edon_plan';
const CUSTOM_POLICIES_KEY = 'edon_custom_policies';

const iconMap: Record<string, typeof Shield> = {
  'personal_safe': ShieldCheck,
  'work_safe': Shield,
  'ops_admin': Zap,
};

const nameMap: Record<string, string> = {
  'personal_safe': 'Personal Safe',
  'work_safe': 'Work Safe',
  'ops_admin': 'Operations',
  'finance_lock': 'Finance Lock',
  'research_mode': 'Research Mode',
};

const colorMap: Record<string, string> = {
  'personal_safe': 'text-emerald-400',
  'work_safe': 'text-primary',
  'ops_admin': 'text-amber-400',
};

const gradientMap: Record<string, string> = {
  'personal_safe': 'from-emerald-500/20 to-emerald-700/10',
  'work_safe': 'from-primary/20 to-primary/5',
  'ops_admin': 'from-amber-500/20 to-orange-600/10',
};

const GOVERNANCE_MODES = [
  {
    key: 'safe',
    packName: 'personal_safe',
    title: 'Safe Mode',
    icon: Lock,
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    border: 'border-emerald-500/30',
    what: 'Automatically stops high-risk actions before they execute — no surprises, no manual review needed.',
    scope: 'Low-risk tasks run uninterrupted. Anything that could cause real-world harm is blocked before it fires.',
    escalation: 'Immediate alert to your admin or team when a policy boundary is crossed.',
    useCase: 'The default for new deployments. Ship fast without worrying about your agents going off-script.',
  },
  {
    key: 'business',
    packName: 'work_safe',
    title: 'Business Mode',
    icon: Briefcase,
    gradient: 'from-sky-500/20 to-sky-700/10',
    border: 'border-sky-500/30',
    what: 'Enables automation across business workflows while maintaining a clear chain of responsibility.',
    scope: 'Business operations run freely. Financial, access, and data-sensitive actions require explicit approval.',
    escalation: 'Escalated to team lead or audit log — full accountability without slowing your operations.',
    useCase: 'Built for ops teams that need velocity but cannot afford compliance gaps.',
  },
  {
    key: 'autonomy',
    packName: 'ops_admin',
    title: 'Autonomy Mode',
    icon: Bot,
    gradient: 'from-amber-500/20 to-orange-600/10',
    border: 'border-amber-500/30',
    what: 'EDON runs continuously — taking action, completing tasks, escalating only when a true safety threshold is crossed.',
    scope: 'Only demonstrably unsafe patterns are blocked. Everything else executes without interruption.',
    escalation: 'Silent by design. Only critical safety violations surface to your team.',
    useCase: 'For high-trust environments, always-on automation pipelines, and enterprise-scale deployments.',
  },
] as const;

export default function Policies() {
  const [packs, setPacks] = useState<PolicyPackWithMeta[]>([]);
  const [activePolicy, setActivePolicy] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customPolicies, setCustomPolicies] = useState<CustomPolicy[]>([]);
  const [planName, setPlanName] = useState('pro');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const plan = (localStorage.getItem(PLAN_KEY) || 'pro').toLowerCase();
    setPlanName(plan);
    const stored = localStorage.getItem(CUSTOM_POLICIES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CustomPolicy[];
        if (Array.isArray(parsed)) setCustomPolicies(parsed);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Failed to parse custom policies", error);
        }
      }
    }

    const handleStorage = () => {
      const updatedPlan = (localStorage.getItem(PLAN_KEY) || 'pro').toLowerCase();
      setPlanName(updatedPlan);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const getCustomLimit = (plan: string) => {
    const n = plan.replace(/\s+/g, '').toLowerCase();
    if (n.includes('enterprise')) return 50;
    if (n.includes('business')) return 10;
    if (n.includes('growth')) return 5;
    if (n.includes('starter')) return 1;
    return 0;
  };

  const customLimit = getCustomLimit(planName);
  const remainingCustom = Math.max(customLimit - customPolicies.length, 0);

  const persistCustomPolicies = (next: CustomPolicy[]) => {
    setCustomPolicies(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOM_POLICIES_KEY, JSON.stringify(next));
    }
  };

  const resetCustomForm = () => {
    setCustomName('');
    setCustomDescription('');
    setEditingId(null);
  };

  const handleSaveCustom = () => {
    if (!customName.trim()) {
      toast({ title: 'Missing name', description: 'Add a policy name first.', variant: 'destructive' });
      return;
    }
    if (editingId) {
      const next = customPolicies.map((policy) =>
        policy.id === editingId
          ? { ...policy, name: customName.trim(), description: customDescription.trim() }
          : policy
      );
      persistCustomPolicies(next);
      toast({ title: 'Custom policy updated', description: 'Your changes are saved.' });
      resetCustomForm();
      return;
    }

    if (customPolicies.length >= customLimit) {
      toast({
        title: 'Limit reached',
        description: customLimit < 10
          ? 'Growth plan or higher required for more than 1 custom policy.'
          : `Your plan allows ${customLimit} custom polic${customLimit === 1 ? 'y' : 'ies'}.`,
        variant: 'destructive',
      });
      return;
    }

    const newPolicy: CustomPolicy = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      description: customDescription.trim() || 'Custom policy pack',
      createdAt: new Date().toISOString(),
    };
    persistCustomPolicies([newPolicy, ...customPolicies]);
    toast({ title: 'Custom policy created', description: 'You can apply it after saving.' });
    resetCustomForm();
  };

  const handleEditCustom = (policy: CustomPolicy) => {
    setCustomName(policy.name);
    setCustomDescription(policy.description);
    setEditingId(policy.id);
  };

  const handleRemoveCustom = (policyId: string) => {
    const next = customPolicies.filter((policy) => policy.id !== policyId);
    persistCustomPolicies(next);
    toast({ title: 'Custom policy removed', description: 'The custom policy has been deleted.' });
    if (editingId === policyId) resetCustomForm();
  };

  const fetchPacks = useCallback(async () => {
    if (isMockMode()) {
      // Mock data
      setPacks([
        {
          name: 'personal_safe',
          description: 'Conservative mode optimized for personal use',
          risk_level: 'low',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 4, blocked_tools: 4, confirm_required: true },
          icon: ShieldCheck,
          color: 'text-emerald-400',
          bgGradient: 'from-emerald-500/20 to-emerald-700/10',
        },
        {
          name: 'work_safe',
          description: 'Balanced policy for work environments',
          risk_level: 'medium',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 6, blocked_tools: 3, confirm_required: true },
          icon: Shield,
          color: 'text-sky-400',
          bgGradient: 'from-sky-400/20 to-sky-600/10',
        },
        {
          name: 'ops_admin',
          description: 'Flexible mode for business workflows',
          risk_level: 'high',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 10, blocked_tools: 1, confirm_required: false },
          icon: Zap,
          color: 'text-amber-400',
          bgGradient: 'from-amber-500/20 to-orange-600/10',
        },
        {
          name: 'finance_lock',
          description: 'High-safety policy for finance and approvals',
          risk_level: 'low',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 3, blocked_tools: 8, confirm_required: true },
          icon: ShieldAlert,
          color: 'text-red-400',
          bgGradient: 'from-red-500/20 to-red-700/10',
        },
        {
          name: 'research_mode',
          description: 'Research-focused policy with web and data access',
          risk_level: 'medium',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 8, blocked_tools: 2, confirm_required: false },
          icon: ShieldCheck,
          color: 'text-cyan-400',
          bgGradient: 'from-cyan-500/20 to-cyan-700/10',
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const response = await edonApi.getPolicyPacks();
      // Ensure response is an array
      const packsArray = Array.isArray(response) ? response : [];
      const packsWithMeta: PolicyPackWithMeta[] = packsArray.map((pack) => ({
        ...pack,
        icon: iconMap[pack.name] || Shield,
        color: colorMap[pack.name] || 'text-primary',
        bgGradient: gradientMap[pack.name] || 'from-primary/20 to-primary/5',
      }));
      const defaults: PolicyPackWithMeta[] = [
        {
          name: 'work_safe',
          description: 'Balanced policy for work environments',
          risk_level: 'medium',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 6, blocked_tools: 3, confirm_required: true },
          icon: Shield,
          color: 'text-sky-400',
          bgGradient: 'from-sky-400/20 to-sky-600/10',
        },
        {
          name: 'ops_admin',
          description: 'Flexible mode for business workflows',
          risk_level: 'high',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 10, blocked_tools: 1, confirm_required: false },
          icon: Zap,
          color: 'text-amber-400',
          bgGradient: 'from-amber-500/20 to-orange-600/10',
        },
        {
          name: 'finance_lock',
          description: 'High-safety policy for finance and approvals',
          risk_level: 'low',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 3, blocked_tools: 8, confirm_required: true },
          icon: ShieldAlert,
          color: 'text-red-400',
          bgGradient: 'from-red-500/20 to-red-700/10',
        },
        {
          name: 'research_mode',
          description: 'Research-focused policy with web and data access',
          risk_level: 'medium',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 8, blocked_tools: 2, confirm_required: false },
          icon: ShieldCheck,
          color: 'text-cyan-400',
          bgGradient: 'from-cyan-500/20 to-cyan-700/10',
        },
      ];
      const existing = new Set(packsWithMeta.map((pack) => pack.name));
      const merged = [...packsWithMeta, ...defaults.filter((pack) => !existing.has(pack.name))];
      setPacks(merged);
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch policy packs:', error);
      }
      // Don't show error toast if it's just missing auth token
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Authentication'))) {
        // User needs to set token - this is expected
        if (import.meta.env.DEV) {
          console.info('Policy packs require authentication. Set API token in Settings.');
        }
      } else {
        toast({
          title: 'Failed to Load Policies',
          description: error instanceof Error ? error.message : 'Could not fetch policy packs from gateway',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchActivePolicy = useCallback(async () => {
    if (isMockMode()) {
      const saved = localStorage.getItem('edon_policy_mode');
      if (saved) setActivePolicy(saved);
      return;
    }

    if (!isMockMode() && !getToken()) {
      return;
    }

    try {
      const status = await edonApi.getIntegrationStatus();
      // Support both current and legacy field names
      const integration = (status as Record<string, unknown>)?.agent ?? (status as Record<string, unknown>)?.clawdbot;
      const pack = (integration as Record<string, unknown> | undefined)?.active_policy_pack;
      if (typeof pack === 'string' && pack) {
        setActivePolicy(pack);
      }
    } catch (error) {
      // Silently fail - token might not be set yet
      // User will see "None" for active policy, which is fine
      if (import.meta.env.DEV) {
        console.debug('Failed to fetch active policy (this is OK if token not set):', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchPacks();
    fetchActivePolicy();
  }, [fetchPacks, fetchActivePolicy]);

  const activatePolicy = async (packName: string) => {
    setActivating(packName);
    
    try {
      if (isMockMode()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        localStorage.setItem('edon_policy_mode', packName);
        const mockIntentId = `mock-intent-${packName}-${Date.now()}`;
        try {
          localStorage.setItem('edon_active_policy_pack', packName);
          localStorage.setItem('edon_active_intent_id', mockIntentId);
          localStorage.setItem('edon_active_applied_at', new Date().toISOString());
        } catch (error) {
          if (import.meta.env.DEV) console.warn('Persist mock intent failed:', error);
        }
        setActivePolicy(packName);
        toast({
          title: 'Safety Pack Applied',
          description: `${packName} is now active`,
        });
      } else {
        const response = await edonApi.applyPolicyPack(packName);
        setActivePolicy(packName);
        if (response?.intent_id) {
          try {
            localStorage.setItem('edon_active_policy_pack', packName);
            localStorage.setItem('edon_active_intent_id', response.intent_id);
            localStorage.setItem('edon_active_applied_at', new Date().toISOString());
          } catch (e) {
            if (import.meta.env.DEV) console.warn('Persist active intent:', e);
          }
        }
        toast({
          title: 'Safety Pack Applied',
          description: response.message || `${packName} is now active`,
        });
        // Refresh active policy from status
        await fetchActivePolicy();
      }
    } catch (error: unknown) {
      toast({
        title: 'Failed to Apply Safety Pack',
        description: error instanceof Error ? error.message : 'Could not apply safety pack',
        variant: 'destructive',
      });
    } finally {
      setActivating(null);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      
      <main className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Safety Packs</h1>
            <p className="text-muted-foreground">Define how much autonomy your agents have — from cautious to always-on.</p>
          </div>

          {/* Governance mode cards */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Governance mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {GOVERNANCE_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = activePolicy === mode.packName;
                return (
                  <motion.div
                    key={mode.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative rounded-xl border ${mode.border} bg-white/5 overflow-hidden transition ${
                      isActive ? 'ring-2 ring-primary' : 'hover:bg-white/10'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-40 pointer-events-none`} />
                    <div className="relative z-10 p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="p-2.5 rounded-lg bg-white/10">
                          <Icon className="w-5 h-5 text-foreground/90" />
                        </div>
                        {isActive && (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold mb-3">{mode.title}</h3>
                      <dl className="space-y-2.5 text-sm text-muted-foreground mb-5">
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-foreground/70 mb-0.5">What it does</dt>
                          <dd>{mode.what}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-foreground/70 mb-0.5">Scope</dt>
                          <dd>{mode.scope}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-foreground/70 mb-0.5">Escalation</dt>
                          <dd>{mode.escalation}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-foreground/70 mb-0.5">Use case</dt>
                          <dd>{mode.useCase}</dd>
                        </div>
                      </dl>
                      <Button
                        onClick={() => activatePolicy(mode.packName)}
                        disabled={isActive || activating === mode.packName}
                        className="w-full gap-2"
                        variant={isActive ? 'outline' : 'default'}
                      >
                        {activating === mode.packName ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Applying...
                          </>
                        ) : isActive ? (
                          <>
                            <Check className="w-4 h-4" />
                            Currently Active
                          </>
                        ) : (
                          <>
                            Set {mode.title}
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Current Policy Banner */}
          <div className="glass-card p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Safety Pack</p>
                  <p className="text-xl font-semibold">
                    {activePolicy ? packs.find((p) => p.name === activePolicy)?.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || activePolicy : 'None'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { fetchPacks(); fetchActivePolicy(); }}
                  disabled={loading}
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {activePolicy && (
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Custom Policies */}
          <div className="glass-card p-6 mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Custom Policies</h2>
                <p className="text-sm text-muted-foreground">
                  Tailor governance rules to your exact use case. Starter unlocks 1 custom pack; Growth unlocks 5; Business unlocks 10.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Plan: {planName || 'pro'}
                </Badge>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  {customPolicies.length}/{customLimit} used
                </Badge>
                {customLimit < 5 && (
                  <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">
                    Growth+ required
                  </Badge>
                )}
              </div>
            </div>

            {customLimit === 0 ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                Upgrade to Starter or higher to create a custom safety pack.
              </div>
            ) : (
              <div className="mt-4 grid lg:grid-cols-[1.2fr_1fr] gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Safety pack name</label>
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="My custom safety pack"
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Description</label>
                    <Textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="Describe what this safety pack allows and blocks"
                      className="bg-secondary/50 min-h-[100px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSaveCustom} disabled={customPolicies.length >= customLimit && !editingId}>
                      {editingId ? 'Update Safety Pack' : 'Create Safety Pack'}
                    </Button>
                    {editingId && (
                      <Button variant="ghost" onClick={resetCustomForm}>
                        Cancel
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground self-center">
                      {remainingCustom} slots remaining
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {customPolicies.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                      No custom packs yet. Create your first safety pack on the left.
                    </div>
                  ) : (
                    customPolicies.map((policy) => (
                      <div key={policy.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{policy.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{policy.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEditCustom(policy)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveCustom(policy.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created {new Date(policy.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Policy Cards */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading policy packs...</div>
          ) : packs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No policy packs available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packs.map((policy, index) => {
                const Icon = policy.icon;
                const isActive = activePolicy === policy.name;
              
              return (
                <motion.div
                  key={policy.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`glass-card-hover p-6 relative overflow-hidden ${
                    isActive ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${policy.bgGradient} opacity-40`} />
                  
                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-secondary/50 ${policy.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {isActive && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-xl font-semibold mb-2">
                      {nameMap[policy.name] ?? policy.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">{policy.description}</p>

                    {/* Risk Level */}
                    <div className="mb-4">
                      <Badge variant="outline" className="text-xs">
                        Risk: {policy.risk_level}
                      </Badge>
                    </div>

                    {/* Rules Preview */}
                    <div className="space-y-3 mb-6">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                          Allowed Tools
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {policy.constraints_summary.allowed_tools} tools
                        </Badge>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                          Blocked Tools
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {policy.constraints_summary.blocked_tools} tools
                        </Badge>
                      </div>

                      {policy.constraints_summary.confirm_required && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 bg-amber-500 rounded-full" />
                            Confirmation Required
                          </p>
                          <Badge variant="outline" className="text-xs">
                            Yes
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Activate Button */}
                    <Button
                      onClick={() => activatePolicy(policy.name)}
                      disabled={isActive || activating === policy.name}
                      className="w-full gap-2"
                      variant={isActive ? 'outline' : 'default'}
                    >
                      {activating === policy.name ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Applying...
                        </>
                      ) : isActive ? (
                        <>
                          <Check className="w-4 h-4" />
                          Currently Active
                        </>
                      ) : (
                        <>
                          Apply
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
