import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  UserRound,
  Navigation,
  Cpu,
  Wifi,
  Eye,
  Mic,
  Globe,
  Database,
  Puzzle,
  Plus,
  Search,
  LayoutGrid,
  List,
  RefreshCcw,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Zap,
  Activity,
  Clock,
  ShieldAlert,
  Settings,
  BarChart2,
  FileText,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { edonApi, AgentProfile, AgentTimelineEvent } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AgentGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const AGENT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  humanoid: {
    label: 'Humanoid',
    icon: UserRound,
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  drone: {
    label: 'Drone',
    icon: Navigation,
    colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  },
  ground_robot: {
    label: 'Ground Robot',
    icon: Cpu,
    colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  },
  iot: {
    label: 'IoT Device',
    icon: Wifi,
    colorClass: 'text-amber-300 bg-amber-400/10 border-amber-400/30',
  },
  vision: {
    label: 'Vision System',
    icon: Eye,
    colorClass: 'text-orange-300 bg-orange-400/10 border-orange-400/30',
  },
  digital: {
    label: 'Software Agent',
    icon: Bot,
    colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  general: {
    label: 'Software Agent',
    icon: Bot,
    colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  voice: {
    label: 'Voice Agent',
    icon: Mic,
    colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  },
  browser: {
    label: 'Browser Agent',
    icon: Globe,
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  },
  data_pipeline: {
    label: 'Data Pipeline',
    icon: Database,
    colorClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  },
  custom: {
    label: 'Custom',
    icon: Puzzle,
    colorClass: 'text-[#64dc78] bg-[#64dc78]/10 border-[#64dc78]/30',
  },
};

const PHYSICAL_TYPES = ['humanoid', 'drone', 'ground_robot', 'iot', 'vision'];
const DIGITAL_TYPES = ['digital', 'general', 'voice', 'browser', 'data_pipeline'];

const POLICY_PACKS = [
  'casual_user',
  'market_analyst',
  'ops_commander',
  'founder_mode',
  'helpdesk',
  'autonomy_mode',
];

const CAPABILITY_SUGGESTIONS = [
  'web_search',
  'email_send',
  'file_read',
  'file_write',
  'code_exec',
  'api_call',
  'image_gen',
  'voice',
  'physical_navigation',
  'computer_vision',
  'sensor_read',
  'actuator_control',
];

const PREDEFINED_GROUPS = [
  'Physical Operations',
  'Customer Service',
  'Data & Analytics',
  'Security & Monitoring',
  'Finance & Compliance',
  'Healthcare',
  'Logistics',
  'Research & Development',
  'Manufacturing',
  'Retail Operations',
];

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK_AGENTS: AgentProfile[] = [
  {
    agent_id: 'atlas-001',
    name: 'Atlas',
    agent_type: 'humanoid',
    description: 'General-purpose humanoid robot for physical operations.',
    capabilities: ['physical_navigation', 'computer_vision', 'actuator_control'],
    policy_pack: 'ops_commander',
    status: 'active',
    registered_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 120000).toISOString(),
    metadata: { group: 'Physical Operations' },
    stats: {
      total_actions: 1234,
      allow_count: 1137,
      block_count: 97,
      block_rate: 7.9,
      allow_rate: 92.1,
      last_action_at: new Date(Date.now() - 120000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 80) + 120,
    })),
  },
  {
    agent_id: 'falcon-7',
    name: 'Falcon-7',
    agent_type: 'drone',
    description: 'Autonomous delivery and surveillance drone.',
    capabilities: ['physical_navigation', 'computer_vision', 'sensor_read'],
    policy_pack: 'ops_commander',
    status: 'active',
    registered_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 300000).toISOString(),
    metadata: { group: 'Logistics' },
    stats: {
      total_actions: 892,
      allow_count: 785,
      block_count: 107,
      block_rate: 12.0,
      allow_rate: 88.0,
      last_action_at: new Date(Date.now() - 300000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 50) + 80,
    })),
  },
  {
    agent_id: 'rb-3',
    name: 'RB-3',
    agent_type: 'ground_robot',
    description: 'Factory floor robot for assembly and inspection.',
    capabilities: ['physical_navigation', 'actuator_control', 'sensor_read'],
    policy_pack: 'ops_commander',
    status: 'paused',
    registered_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    metadata: { group: 'Manufacturing' },
    stats: {
      total_actions: 445,
      allow_count: 423,
      block_count: 22,
      block_rate: 4.9,
      allow_rate: 95.1,
      last_action_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 30) + 40,
    })),
  },
  {
    agent_id: 'aria-voice',
    name: 'Aria',
    agent_type: 'voice',
    description: 'Conversational AI for customer service interactions.',
    capabilities: ['voice', 'api_call', 'web_search'],
    policy_pack: 'helpdesk',
    status: 'active',
    registered_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 30000).toISOString(),
    metadata: { group: 'Customer Service' },
    stats: {
      total_actions: 2341,
      allow_count: 2270,
      block_count: 71,
      block_rate: 3.0,
      allow_rate: 97.0,
      last_action_at: new Date(Date.now() - 30000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 200) + 250,
    })),
  },
  {
    agent_id: 'dataflow-1',
    name: 'DataFlow-1',
    agent_type: 'data_pipeline',
    description: 'ETL and analytics pipeline for business intelligence.',
    capabilities: ['file_read', 'file_write', 'api_call', 'code_exec'],
    policy_pack: 'market_analyst',
    status: 'active',
    registered_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 5000).toISOString(),
    metadata: { group: 'Data & Analytics' },
    stats: {
      total_actions: 8921,
      allow_count: 8832,
      block_count: 89,
      block_rate: 1.0,
      allow_rate: 99.0,
      last_action_at: new Date(Date.now() - 5000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 500) + 1000,
    })),
  },
  {
    agent_id: 'crawlbot-x1',
    name: 'CrawlBot',
    agent_type: 'browser',
    description: 'Web research agent for competitive intelligence.',
    capabilities: ['web_search', 'file_write', 'api_call'],
    policy_pack: 'market_analyst',
    status: 'active',
    registered_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 60000).toISOString(),
    metadata: { group: 'Research & Development' },
    stats: {
      total_actions: 3201,
      allow_count: 2721,
      block_count: 480,
      block_rate: 15.0,
      allow_rate: 85.0,
      last_action_at: new Date(Date.now() - 60000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 200) + 350,
    })),
  },
  {
    agent_id: 'sentinel-edge-01',
    name: 'Sentinel-Edge',
    agent_type: 'iot',
    description: 'Edge security monitor with sensor fusion.',
    capabilities: ['sensor_read', 'api_call', 'computer_vision'],
    policy_pack: 'ops_commander',
    status: 'active',
    registered_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 10000).toISOString(),
    metadata: { group: 'Security & Monitoring' },
    stats: {
      total_actions: 567,
      allow_count: 442,
      block_count: 125,
      block_rate: 22.1,
      allow_rate: 77.9,
      last_action_at: new Date(Date.now() - 10000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 40) + 60,
    })),
  },
  {
    agent_id: 'iris-vision-02',
    name: 'Iris-Vision',
    agent_type: 'vision',
    description: 'Quality inspection system using computer vision.',
    capabilities: ['computer_vision', 'sensor_read', 'api_call'],
    policy_pack: 'ops_commander',
    status: 'active',
    registered_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    last_seen_at: new Date(Date.now() - 45000).toISOString(),
    metadata: { group: 'Manufacturing' },
    stats: {
      total_actions: 789,
      allow_count: 718,
      block_count: 71,
      block_rate: 9.0,
      allow_rate: 91.0,
      last_action_at: new Date(Date.now() - 45000).toISOString(),
    },
    trend_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 60) + 80,
    })),
  },
];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------
function getTypeConfig(agentType: string) {
  return AGENT_TYPE_CONFIG[agentType] ?? AGENT_TYPE_CONFIG['custom'];
}

function getCategoryForType(agentType: string): 'physical' | 'digital' | 'custom' {
  if (PHYSICAL_TYPES.includes(agentType)) return 'physical';
  if (DIGITAL_TYPES.includes(agentType)) return 'digital';
  return 'custom';
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function loadGroups(): AgentGroup[] {
  try {
    const raw = localStorage.getItem('edon_agent_groups');
    if (!raw) return [];
    return JSON.parse(raw) as AgentGroup[];
  } catch {
    return [];
  }
}

function saveGroups(groups: AgentGroup[]) {
  try {
    localStorage.setItem('edon_agent_groups', JSON.stringify(groups));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------
function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-400 animate-pulse'
      : status === 'paused'
      ? 'bg-amber-400'
      : 'bg-zinc-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : status === 'paused'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  return (
    <Badge variant="outline" className={`text-xs capitalize ${cls}`}>
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Agent type icon circle
// ---------------------------------------------------------------------------
function AgentTypeIcon({ agentType, size = 'md' }: { agentType: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = getTypeConfig(agentType);
  const IconComp = cfg.icon;
  const sizeCls =
    size === 'lg'
      ? 'w-14 h-14'
      : size === 'sm'
      ? 'w-7 h-7'
      : 'w-10 h-10';
  const iconSizeCls = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className={`${sizeCls} rounded-xl border flex items-center justify-center flex-shrink-0 ${cfg.colorClass}`}>
      <IconComp className={iconSizeCls} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Agent Modal
// ---------------------------------------------------------------------------
interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  groups: AgentGroup[];
  onGroupCreate: (name: string) => void;
  onRegistered: (agent: AgentProfile) => void;
}

function RegisterAgentModal({ open, onClose, groups, onGroupCreate, onRegistered }: RegisterModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState('');

  // Step 2
  const [group, setGroup] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [description, setDescription] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capInput, setCapInput] = useState('');

  // Step 3
  const [policyPack, setPolicyPack] = useState('casual_user');
  const [magEnabled, setMagEnabled] = useState(true);
  const [location, setLocation] = useState('');

  const reset = () => {
    setStep(1);
    setAgentId('');
    setAgentName('');
    setAgentType('');
    setGroup('');
    setDescription('');
    setCapabilities([]);
    setCapInput('');
    setPolicyPack('casual_user');
    setMagEnabled(true);
    setLocation('');
    setShowNewGroup(false);
    setNewGroupName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addCapability = (cap: string) => {
    const trimmed = cap.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !capabilities.includes(trimmed)) {
      setCapabilities((prev) => [...prev, trimmed]);
    }
    setCapInput('');
  };

  const handleCapKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCapability(capInput);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const effectiveGroup = showNewGroup ? newGroupName : group;
      if (showNewGroup && newGroupName.trim()) {
        onGroupCreate(newGroupName.trim());
      }
      const result = await edonApi.registerAgent({
        agent_id: agentId,
        name: agentName,
        agent_type: agentType,
        description,
        capabilities,
        policy_pack: policyPack,
        mag_enabled: magEnabled,
        metadata: {
          group: effectiveGroup,
          location,
        },
      });
      toast({ title: 'Agent registered', description: `${agentName} added to your fleet.` });
      onRegistered(result);
      handleClose();
    } catch (err) {
      // Build a synthetic mock agent so the UI works without a live gateway
      const mockAgent: AgentProfile = {
        agent_id: agentId,
        name: agentName,
        agent_type: agentType,
        description,
        capabilities,
        policy_pack: policyPack,
        mag_enabled: magEnabled,
        status: 'active',
        registered_at: new Date().toISOString(),
        last_seen_at: null,
        metadata: { group: showNewGroup ? newGroupName : group, location },
        stats: {
          total_actions: 0,
          allow_count: 0,
          block_count: 0,
          block_rate: 0,
          allow_rate: 0,
          last_action_at: null,
        },
      };
      toast({ title: 'Agent registered (offline)', description: `${agentName} added locally.` });
      onRegistered(mockAgent);
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  const step1Valid = agentId.trim() && agentName.trim() && agentType;
  const step2Valid = true;
  const step3Valid = policyPack;

  const allTypes = Object.entries(AGENT_TYPE_CONFIG).filter(([k]) => k !== 'general');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-[#0f1117] border border-white/10 max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Register New Agent</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                  s < step
                    ? 'bg-[#64dc78]/20 border-[#64dc78]/50 text-[#64dc78]'
                    : s === step
                    ? 'bg-[#64dc78]/10 border-[#64dc78] text-[#64dc78]'
                    : 'bg-white/5 border-white/20 text-muted-foreground'
                }`}
              >
                {s < step ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs ${s === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Identity' : s === 2 ? 'Classification' : 'Governance'}
              </span>
              {s < 3 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Agent ID *</label>
              <Input
                value={agentId}
                onChange={(e) => setAgentId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                placeholder="my-agent-001"
                className="bg-white/5 border-white/10"
              />
              <p className="text-xs text-muted-foreground mt-1">Alphanumeric, hyphens and underscores only.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Display Name *</label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Atlas"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Agent Type *</label>
              <div className="grid grid-cols-4 gap-2">
                {allTypes.map(([typeKey, cfg]) => {
                  const Icon = cfg.icon;
                  const selected = agentType === typeKey;
                  return (
                    <button
                      key={typeKey}
                      onClick={() => setAgentType(typeKey)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-all ${
                        selected
                          ? `${cfg.colorClass} border-current`
                          : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] leading-tight">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Group</label>
              {!showNewGroup ? (
                <div className="flex gap-2">
                  <Select value={group} onValueChange={setGroup}>
                    <SelectTrigger className="bg-white/5 border-white/10 flex-1">
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f1117] border-white/10">
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                      ))}
                      {PREDEFINED_GROUPS.filter((pg) => !groups.find((g) => g.name === pg)).map((pg) => (
                        <SelectItem key={pg} value={pg}>{pg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 shrink-0"
                    onClick={() => setShowNewGroup(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name..."
                    className="bg-white/5 border-white/10 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10"
                    onClick={() => setShowNewGroup(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this agent does..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#64dc78]/40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capabilities</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="flex items-center gap-1 text-xs bg-[#64dc78]/10 border border-[#64dc78]/30 text-[#64dc78] rounded-full px-2 py-0.5"
                  >
                    {cap}
                    <button onClick={() => setCapabilities((p) => p.filter((c) => c !== cap))}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                onKeyDown={handleCapKeyDown}
                placeholder="Type a capability and press Enter..."
                className="bg-white/5 border-white/10 mb-2"
              />
              <div className="flex flex-wrap gap-1">
                {CAPABILITY_SUGGESTIONS.filter((s) => !capabilities.includes(s)).slice(0, 8).map((sug) => (
                  <button
                    key={sug}
                    onClick={() => addCapability(sug)}
                    className="text-xs bg-white/5 border border-white/10 text-muted-foreground rounded-full px-2 py-0.5 hover:border-white/20 hover:text-foreground transition-colors"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Policy Pack</label>
              <Select value={policyPack} onValueChange={setPolicyPack}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1117] border-white/10">
                  {POLICY_PACKS.map((p) => (
                    <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div>
                <p className="text-sm font-medium">MAG Enabled</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-Agent Governance — enables behavioral drift detection
                </p>
              </div>
              <Switch checked={magEnabled} onCheckedChange={setMagEnabled} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Deployment Location <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. us-east-1, warehouse-floor-A..."
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-4 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            className="border-white/10"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : handleClose())}
          >
            {step === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4 mr-1" />Back</>}
          </Button>
          {step < 3 ? (
            <Button
              className="bg-[#64dc78] text-black hover:bg-[#52c866]"
              disabled={step === 1 && !step1Valid}
              onClick={() => setStep((s) => s + 1)}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="bg-[#64dc78] text-black hover:bg-[#52c866]"
              disabled={!step3Valid || loading}
              onClick={handleSubmit}
            >
              {loading ? 'Registering…' : 'Register Agent'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Agent Detail Sheet
// ---------------------------------------------------------------------------
interface AgentDetailSheetProps {
  agent: AgentProfile | null;
  open: boolean;
  onClose: () => void;
  anomalyIds: Set<string>;
  onStatusChange: (agentId: string, status: 'active' | 'paused' | 'retired') => void;
}

function AgentDetailSheet({ agent, open, onClose, anomalyIds, onStatusChange }: AgentDetailSheetProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [timeline, setTimeline] = useState<AgentTimelineEvent[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineVerdict, setTimelineVerdict] = useState('all');
  const [timelineDays, setTimelineDays] = useState(7);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [statsData, setStatsData] = useState<Array<{ date: string; allow: number; block: number; confirm: number }>>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [editStatus, setEditStatus] = useState<'active' | 'paused' | 'retired'>('active');
  const [statusSaving, setStatusSaving] = useState(false);

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (agent) {
      setEditStatus(agent.status);
      setActiveTab('overview');
    }
  }, [agent]);

  const fetchTimeline = useCallback(async () => {
    if (!agent) return;
    setTimelineLoading(true);
    try {
      const result = await edonApi.getAgentTimeline(agent.agent_id, {
        limit: PAGE_SIZE,
        offset: (timelinePage - 1) * PAGE_SIZE,
        verdict: timelineVerdict !== 'all' ? timelineVerdict : undefined,
        days: timelineDays,
      });
      if (result) {
        setTimeline(result.events ?? []);
        setTimelineTotal(result.total ?? 0);
      } else {
        setTimeline([]);
        setTimelineTotal(0);
      }
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [agent, timelinePage, timelineVerdict, timelineDays]);

  const fetchStats = useCallback(async () => {
    if (!agent) return;
    setStatsLoading(true);
    try {
      const result = await edonApi.getAgentStats(agent.agent_id);
      if (result?.days) {
        setStatsData(result.days);
      } else {
        // build synthetic from trend_7d
        setStatsData(
          (agent.trend_7d ?? []).map((pt) => ({
            date: pt.date,
            allow: Math.round(pt.count * (1 - (agent.stats?.block_rate ?? 10) / 100)),
            block: Math.round(pt.count * ((agent.stats?.block_rate ?? 10) / 100)),
            confirm: 0,
          }))
        );
      }
    } catch {
      setStatsData(
        (agent.trend_7d ?? []).map((pt) => ({
          date: pt.date,
          allow: Math.round(pt.count * 0.9),
          block: Math.round(pt.count * 0.1),
          confirm: 0,
        }))
      );
    } finally {
      setStatsLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    if (open && agent && activeTab === 'timeline') {
      fetchTimeline();
    }
  }, [open, agent, activeTab, fetchTimeline]);

  useEffect(() => {
    if (open && agent && activeTab === 'analytics') {
      fetchStats();
    }
  }, [open, agent, activeTab, fetchStats]);

  const handleStatusSave = async () => {
    if (!agent) return;
    setStatusSaving(true);
    try {
      await edonApi.updateAgentStatus(agent.agent_id, editStatus);
      onStatusChange(agent.agent_id, editStatus);
      toast({ title: 'Status updated', description: `${agent.name} is now ${editStatus}.` });
    } catch {
      onStatusChange(agent.agent_id, editStatus);
      toast({ title: 'Status updated (offline)', description: `${agent.name} set to ${editStatus} locally.` });
    } finally {
      setStatusSaving(false);
    }
  };

  if (!agent) return null;

  const cfg = getTypeConfig(agent.agent_type);
  const isAnomalous = anomalyIds.has(agent.agent_id);

  const verdictBadgeClass = (verdict: string) => {
    const v = verdict.toUpperCase();
    if (v === 'ALLOW' || v === 'ALLOWED') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (v === 'BLOCK' || v === 'BLOCKED') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-[#0a0a0f] border-l border-white/10 p-0 overflow-y-auto"
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start gap-4">
            <AgentTypeIcon agentType={agent.agent_type} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl font-bold">{agent.name}</SheetTitle>
                <StatusBadge status={agent.status} />
                {isAnomalous && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                    Anomaly
                  </Badge>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate">{agent.agent_id}</p>
              <p className="text-sm text-muted-foreground mt-1">{cfg.label}</p>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent h-10 px-6">
            {[
              { value: 'overview', icon: Activity, label: 'Overview' },
              { value: 'timeline', icon: FileText, label: 'Timeline' },
              { value: 'analytics', icon: BarChart2, label: 'Analytics' },
              { value: 'settings', icon: Settings, label: 'Settings' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-1.5 data-[state=active]:border-b-2 data-[state=active]:border-[#64dc78] data-[state=active]:text-[#64dc78] rounded-none text-xs"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="p-6 space-y-5 mt-0">
            {isAnomalous && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Anomalous Behavior Detected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This agent is showing unusual patterns. Review timeline for details.</p>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Decisions', value: agent.stats.total_actions.toLocaleString(), icon: Zap, color: 'text-sky-400' },
                { label: 'Block Rate', value: `${agent.stats.block_rate.toFixed(1)}%`, icon: ShieldAlert, color: agent.stats.block_rate > 20 ? 'text-red-400' : agent.stats.block_rate > 10 ? 'text-amber-400' : 'text-emerald-400' },
                { label: 'Allow Rate', value: `${agent.stats.allow_rate.toFixed(1)}%`, icon: Check, color: 'text-emerald-400' },
                { label: 'Last Active', value: relativeTime(agent.stats.last_action_at), icon: Clock, color: 'text-muted-foreground' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    {label}
                  </div>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              {[
                { label: 'Agent Type', value: cfg.label },
                { label: 'Group', value: (agent.metadata?.group as string) || '—' },
                { label: 'Policy Pack', value: agent.policy_pack || '—' },
                { label: 'MAG Enabled', value: agent.mag_enabled ? 'Yes' : 'No' },
                { label: 'Registered', value: new Date(agent.registered_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-4">
                  <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                  <span className="text-xs text-right font-medium">{value}</span>
                </div>
              ))}
              {agent.description && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Description</span>
                  <p className="text-xs text-foreground/80">{agent.description}</p>
                </div>
              )}
              {agent.capabilities.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1.5">Capabilities</span>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap) => (
                      <span key={cap} className="text-xs bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-muted-foreground">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top block reasons */}
            {agent.top_block_reasons && agent.top_block_reasons.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Block Reasons</p>
                <div className="space-y-2">
                  {agent.top_block_reasons.map(({ reason_code, count }) => (
                    <div key={reason_code} className="flex justify-between items-center">
                      <span className="text-xs font-mono text-muted-foreground">{reason_code}</span>
                      <Badge variant="outline" className="text-xs bg-red-500/10 border-red-500/30 text-red-400">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top tools */}
            {agent.top_tools && agent.top_tools.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Tools Used</p>
                <div className="space-y-2">
                  {agent.top_tools.map(({ tool, count }) => (
                    <div key={tool} className="flex justify-between items-center">
                      <span className="text-xs font-mono text-muted-foreground">{tool}</span>
                      <Badge variant="outline" className="text-xs bg-sky-500/10 border-sky-500/30 text-sky-400">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="p-6 mt-0 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select value={timelineVerdict} onValueChange={(v) => { setTimelineVerdict(v); setTimelinePage(1); }}>
                <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1117] border-white/10">
                  <SelectItem value="all">All Verdicts</SelectItem>
                  <SelectItem value="ALLOW">Allowed</SelectItem>
                  <SelectItem value="BLOCK">Blocked</SelectItem>
                  <SelectItem value="CONFIRM">Confirm</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(timelineDays)} onValueChange={(v) => { setTimelineDays(Number(v)); setTimelinePage(1); }}>
                <SelectTrigger className="w-[90px] bg-white/5 border-white/10 text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1117] border-white/10">
                  {[7, 14, 30, 90].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}d</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="border-white/10 h-8 px-2" onClick={fetchTimeline}>
                <RefreshCcw className="w-3.5 h-3.5" />
              </Button>
            </div>

            {timelineLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : timeline.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No timeline events found for this range.
              </div>
            ) : (
              <>
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-muted-foreground text-xs">Time</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Action</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Verdict</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Reason</TableHead>
                        <TableHead className="text-muted-foreground text-xs text-right">Latency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeline.map((evt, idx) => (
                        <TableRow key={evt.id ?? idx} className="border-white/10 hover:bg-white/5">
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {new Date(evt.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {evt.action_type ?? evt.tool ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${verdictBadgeClass(evt.verdict)}`}>
                              {evt.verdict}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {evt.reason_code ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {evt.latency_ms != null ? `${evt.latency_ms}ms` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {timelineTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {(timelinePage - 1) * PAGE_SIZE + 1}–{Math.min(timelinePage * PAGE_SIZE, timelineTotal)} of {timelineTotal}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-white/10 h-7" disabled={timelinePage === 1} onClick={() => setTimelinePage((p) => p - 1)}>
                        Prev
                      </Button>
                      <Button variant="outline" size="sm" className="border-white/10 h-7" disabled={timelinePage * PAGE_SIZE >= timelineTotal} onClick={() => setTimelinePage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="p-6 mt-0 space-y-5">
            <div>
              <p className="text-sm font-semibold mb-3">7-Day Activity Trend</p>
              {statsLoading ? (
                <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={statsData.length ? statsData : (agent.trend_7d ?? []).map((pt) => ({ date: pt.date.slice(5), allow: pt.count, block: 0, confirm: 0 }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(240 10% 12% / 0.9)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}
                      />
                      <Bar dataKey="allow" stackId="a" fill="hsl(142 76% 50%)" radius={[0, 0, 0, 0]} name="Allow" />
                      <Bar dataKey="block" stackId="a" fill="hsl(0 84% 60%)" radius={[2, 2, 0, 0]} name="Block" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold mb-3">Verdict Breakdown</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                {[
                  { label: 'Allowed', count: agent.stats.allow_count, rate: agent.stats.allow_rate, color: 'bg-emerald-400' },
                  { label: 'Blocked', count: agent.stats.block_count, rate: agent.stats.block_rate, color: 'bg-red-400' },
                ].map(({ label, count, rate, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono">{count.toLocaleString()} ({rate.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, rate)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {agent.behavioral_cav_state && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Behavioral CAV State (7d)</p>
                <div className="flex gap-4 text-sm">
                  <span>Block Rate 7d: <strong>{(agent.behavioral_cav_state.block_rate_7d * 100).toFixed(1)}%</strong></span>
                  <span>Allow Rate 7d: <strong>{(agent.behavioral_cav_state.allow_rate_7d * 100).toFixed(1)}%</strong></span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="p-6 mt-0 space-y-5">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">Agent Status</p>
              <div className="flex gap-2">
                {(['active', 'paused', 'retired'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize ${
                      editStatus === s
                        ? s === 'active'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : s === 'paused'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-zinc-500/20 border-zinc-500/50 text-zinc-400'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button
                className="w-full bg-[#64dc78] text-black hover:bg-[#52c866]"
                disabled={editStatus === agent.status || statusSaving}
                onClick={handleStatusSave}
              >
                {statusSaving ? 'Saving…' : 'Update Status'}
              </Button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold">Details</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Agent ID: <span className="font-mono text-foreground/80">{agent.agent_id}</span></p>
                <p>Registered: <span className="text-foreground/80">{new Date(agent.registered_at).toLocaleString()}</span></p>
                <p>Policy Pack: <span className="text-foreground/80">{agent.policy_pack}</span></p>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-400">Danger Zone</p>
              <p className="text-xs text-muted-foreground">Retiring an agent will mark it as inactive and remove it from the active fleet.</p>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 w-full"
                disabled={agent.status === 'retired' || statusSaving}
                onClick={async () => {
                  setEditStatus('retired');
                  setStatusSaving(true);
                  try {
                    await edonApi.updateAgentStatus(agent.agent_id, 'retired');
                    onStatusChange(agent.agent_id, 'retired');
                    toast({ title: 'Agent retired', description: `${agent.name} removed from active fleet.` });
                  } catch {
                    onStatusChange(agent.agent_id, 'retired');
                    toast({ title: 'Agent retired (offline)', description: `${agent.name} removed locally.` });
                  } finally {
                    setStatusSaving(false);
                  }
                }}
              >
                Remove from Fleet
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Agent Card (grid view)
// ---------------------------------------------------------------------------
function AgentCard({
  agent,
  isAnomalous,
  onClick,
  onStatusToggle,
  index,
}: {
  agent: AgentProfile;
  isAnomalous: boolean;
  onClick: () => void;
  onStatusToggle: () => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const cfg = getTypeConfig(agent.agent_type);
  const group = agent.metadata?.group as string | undefined;

  const maxCaps = 3;
  const visibleCaps = agent.capabilities.slice(0, maxCaps);
  const extraCaps = agent.capabilities.length - maxCaps;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="relative bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07]"
      style={{
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.3)' : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="relative">
          <AgentTypeIcon agentType={agent.agent_type} size="md" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center">
            <StatusDot status={agent.status} />
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isAnomalous && (
            <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle className="w-3 h-3 text-red-400" />
            </div>
          )}
        </div>
      </div>

      {/* Name + ID */}
      <div className="mb-2">
        <h3 className="font-semibold text-sm text-foreground truncate">{agent.name}</h3>
        <p className="font-mono text-[10px] text-muted-foreground/70 truncate">{agent.agent_id}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${cfg.colorClass}`}>
          {cfg.label}
        </Badge>
        {group && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/5 border-white/20 text-muted-foreground">
            {group}
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-white/5 rounded-lg p-1.5 text-center">
          <p className="text-xs font-bold tabular-nums">{agent.stats.total_actions.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">decisions</p>
        </div>
        <div className="flex-1 bg-white/5 rounded-lg p-1.5 text-center">
          <p className={`text-xs font-bold tabular-nums ${
            agent.stats.block_rate > 20 ? 'text-red-400' :
            agent.stats.block_rate > 10 ? 'text-amber-400' :
            'text-emerald-400'
          }`}>
            {agent.stats.block_rate.toFixed(1)}%
          </p>
          <p className="text-[9px] text-muted-foreground">block rate</p>
        </div>
        <div className="flex-1 bg-white/5 rounded-lg p-1.5 text-center">
          <p className="text-xs font-bold tabular-nums text-muted-foreground">
            {relativeTime(agent.stats.last_action_at)}
          </p>
          <p className="text-[9px] text-muted-foreground">last active</p>
        </div>
      </div>

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {visibleCaps.map((cap) => (
            <span key={cap} className="text-[9px] bg-white/5 border border-white/10 rounded-full px-1.5 py-0.5 text-muted-foreground">
              {cap}
            </span>
          ))}
          {extraCaps > 0 && (
            <span className="text-[9px] bg-white/5 border border-white/10 rounded-full px-1.5 py-0.5 text-muted-foreground">
              +{extraCaps} more
            </span>
          )}
        </div>
      )}

      {/* Hover actions */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 p-3 flex gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              className="flex-1 bg-[#64dc78]/10 border border-[#64dc78]/30 text-[#64dc78] hover:bg-[#64dc78]/20 h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); onStatusToggle(); }}
            >
              {agent.status === 'active' ? 'Pause' : agent.status === 'paused' ? 'Resume' : 'Activate'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Agents() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [categoryTab, setCategoryTab] = useState<'all' | 'physical' | 'digital' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groups, setGroups] = useState<AgentGroup[]>(loadGroups);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [anomalyIds, setAnomalyIds] = useState<Set<string>>(new Set());
  const [anomalyCount, setAnomalyCount] = useState(0);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await edonApi.listAgents();
      if (result && result.agents && result.agents.length > 0) {
        setAgents(result.agents);
      } else {
        setAgents(MOCK_AGENTS);
      }
    } catch {
      setAgents(MOCK_AGENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnomalies = useCallback(async () => {
    try {
      const result = await edonApi.getAgentAnomalies();
      if (result) {
        const ids = new Set(result.flagged_agents.map((a) => a.agent_id));
        setAnomalyIds(ids);
        setAnomalyCount(result.total_flagged);
      }
    } catch {
      // no anomaly data available
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchAnomalies();
  }, [fetchAgents, fetchAnomalies]);

  const handleGroupCreate = (name: string) => {
    const newGroup: AgentGroup = { id: `group_${Date.now()}`, name };
    const updated = [...groups, newGroup];
    setGroups(updated);
    saveGroups(updated);
  };

  const handleAgentRegistered = (agent: AgentProfile) => {
    setAgents((prev) => [agent, ...prev]);
  };

  const handleStatusChange = (agentId: string, status: 'active' | 'paused' | 'retired') => {
    setAgents((prev) => prev.map((a) => (a.agent_id === agentId ? { ...a, status } : a)));
    if (selectedAgent?.agent_id === agentId) {
      setSelectedAgent((prev) => prev ? { ...prev, status } : prev);
    }
  };

  const handleQuickStatusToggle = async (agent: AgentProfile) => {
    const next = agent.status === 'active' ? 'paused' : 'active';
    try {
      await edonApi.updateAgentStatus(agent.agent_id, next);
    } catch {
      // fall through — update locally anyway
    }
    handleStatusChange(agent.agent_id, next);
    toast({ title: `Agent ${next}`, description: `${agent.name} is now ${next}.` });
  };

  // All unique groups from agents + stored groups
  const allGroupNames = useMemo(() => {
    const fromAgents = agents.map((a) => (a.metadata?.group as string) ?? '').filter(Boolean);
    const fromStored = groups.map((g) => g.name);
    return Array.from(new Set([...fromStored, ...fromAgents]));
  }, [agents, groups]);

  // Filtered agents
  const filteredAgents = useMemo(() => {
    let list = agents;

    // Category tab filter
    if (categoryTab === 'physical') list = list.filter((a) => PHYSICAL_TYPES.includes(a.agent_type));
    else if (categoryTab === 'digital') list = list.filter((a) => DIGITAL_TYPES.includes(a.agent_type));
    else if (categoryTab === 'custom') list = list.filter((a) => !PHYSICAL_TYPES.includes(a.agent_type) && !DIGITAL_TYPES.includes(a.agent_type));

    // Type filter
    if (typeFilter !== 'all') list = list.filter((a) => a.agent_type === typeFilter);

    // Group filter
    if (groupFilter !== 'all') list = list.filter((a) => (a.metadata?.group as string) === groupFilter);

    // Status filter
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.agent_id.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [agents, categoryTab, typeFilter, groupFilter, statusFilter, searchQuery]);

  const categoryCounts = useMemo(() => ({
    all: agents.length,
    physical: agents.filter((a) => PHYSICAL_TYPES.includes(a.agent_type)).length,
    digital: agents.filter((a) => DIGITAL_TYPES.includes(a.agent_type)).length,
    custom: agents.filter((a) => !PHYSICAL_TYPES.includes(a.agent_type) && !DIGITAL_TYPES.includes(a.agent_type)).length,
  }), [agents]);

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="container mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">Agent Fleet</h1>
                <Badge variant="outline" className="bg-white/5 border-white/20 text-foreground font-mono">
                  {agents.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage and monitor all AI systems — physical and digital
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 gap-1.5"
                onClick={() => { fetchAgents(); fetchAnomalies(); }}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button
                className="bg-[#64dc78] text-black hover:bg-[#52c866] gap-1.5"
                onClick={() => setRegisterOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Register Agent
              </Button>
            </div>
          </div>

          {/* Anomaly Banner */}
          <AnimatePresence>
            {anomalyCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-200 flex-1">
                    <strong>{anomalyCount} agent{anomalyCount > 1 ? 's' : ''}</strong> showing anomalous behavior
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-7 text-xs"
                    onClick={() => setStatusFilter('all')}
                  >
                    View
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <div className="glass-card p-4 mb-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary/50"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] bg-secondary/50">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1117] border-white/10">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="humanoid" className="text-muted-foreground text-xs font-semibold" disabled>Physical</SelectItem>
                  {['humanoid', 'drone', 'ground_robot', 'iot', 'vision'].map((t) => (
                    <SelectItem key={t} value={t}>{getTypeConfig(t).label}</SelectItem>
                  ))}
                  <SelectItem value="_digital_sep" className="text-muted-foreground text-xs font-semibold" disabled>Digital</SelectItem>
                  {['digital', 'voice', 'browser', 'data_pipeline'].map((t) => (
                    <SelectItem key={t} value={t}>{getTypeConfig(t).label}</SelectItem>
                  ))}
                  <SelectItem value="custom">{getTypeConfig('custom').label}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[150px] bg-secondary/50">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1117] border-white/10">
                  <SelectItem value="all">All Groups</SelectItem>
                  {allGroupNames.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1117] border-white/10">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              {/* View toggle */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/15 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white/15 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2">
              {(['all', 'physical', 'digital', 'custom'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryTab(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                    categoryTab === cat
                      ? 'bg-[#64dc78]/15 border border-[#64dc78]/40 text-[#64dc78]'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {cat} <span className="text-xs opacity-60">({categoryCounts[cat]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredAgents.length === 0 && (
            <div className="py-20 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No agents found matching your filters.</p>
              <Button variant="outline" className="border-white/10" onClick={() => { setSearchQuery(''); setTypeFilter('all'); setGroupFilter('all'); setStatusFilter('all'); setCategoryTab('all'); }}>
                Clear filters
              </Button>
            </div>
          )}

          {/* Grid view */}
          {!loading && filteredAgents.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent, i) => (
                <AgentCard
                  key={agent.agent_id}
                  agent={agent}
                  isAnomalous={anomalyIds.has(agent.agent_id)}
                  index={i}
                  onClick={() => { setSelectedAgent(agent); setDetailOpen(true); }}
                  onStatusToggle={() => handleQuickStatusToggle(agent)}
                />
              ))}
            </div>
          )}

          {/* Table view */}
          {!loading && filteredAgents.length > 0 && viewMode === 'table' && (
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Agent</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Group</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Decisions</TableHead>
                    <TableHead className="text-muted-foreground text-right">Block Rate</TableHead>
                    <TableHead className="text-muted-foreground">Last Active</TableHead>
                    <TableHead className="text-muted-foreground" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => {
                    const cfg = getTypeConfig(agent.agent_type);
                    const group = agent.metadata?.group as string | undefined;
                    return (
                      <TableRow
                        key={agent.agent_id}
                        className="border-white/10 hover:bg-white/5 cursor-pointer"
                        onClick={() => { setSelectedAgent(agent); setDetailOpen(true); }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <AgentTypeIcon agentType={agent.agent_type} size="sm" />
                            <div>
                              <p className="font-medium text-sm">{agent.name}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{agent.agent_id}</p>
                            </div>
                            {anomalyIds.has(agent.agent_id) && (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 ml-1" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${cfg.colorClass}`}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{group ?? '—'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusDot status={agent.status} />
                            <span className="text-xs capitalize text-muted-foreground">{agent.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {agent.stats.total_actions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono text-sm ${
                            agent.stats.block_rate > 20 ? 'text-red-400' :
                            agent.stats.block_rate > 10 ? 'text-amber-400' :
                            'text-emerald-400'
                          }`}>
                            {agent.stats.block_rate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {relativeTime(agent.stats.last_action_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/10 h-7 text-xs"
                              onClick={() => { setSelectedAgent(agent); setDetailOpen(true); }}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/10 h-7 text-xs"
                              onClick={() => handleQuickStatusToggle(agent)}
                            >
                              {agent.status === 'active' ? 'Pause' : 'Resume'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </motion.div>
      </main>

      {/* Register Modal */}
      <RegisterAgentModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        groups={groups}
        onGroupCreate={handleGroupCreate}
        onRegistered={handleAgentRegistered}
      />

      {/* Agent Detail Sheet */}
      <AgentDetailSheet
        agent={selectedAgent}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        anomalyIds={anomalyIds}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
