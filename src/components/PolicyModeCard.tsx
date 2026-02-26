import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Timer, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const policyModes = {
  'personal-safe': {
    label: 'Safe Mode',
    description: 'High-oversight mode — every action is reviewed before execution',
    color: 'from-emerald-500 to-emerald-700',
  },
  'work-safe': {
    label: 'Business Mode',
    description: 'Balanced autonomy — low-risk actions proceed, sensitive ones are gated',
    color: 'from-sky-400 to-sky-600',
  },
  'ops': {
    label: 'Autonomy Mode',
    description: 'Full speed — agent acts freely within your defined policy boundaries',
    color: 'from-amber-500 to-orange-600',
  },
};

export function PolicyModeCard() {
  const [currentMode, setCurrentMode] = useState<keyof typeof policyModes>('work-safe');
  const [policyVersion, setPolicyVersion] = useState('v1.2.3');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('edon_policy_mode');
    if (saved && saved in policyModes) {
      setCurrentMode(saved as keyof typeof policyModes);
    }
  }, []);

  const mode = policyModes[currentMode];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Governance Mode</h3>
        <Link to="/policies" className="text-primary text-sm flex items-center gap-1 hover:underline">
          Manage <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className={`p-4 rounded-xl bg-gradient-to-br ${mode.color} mb-4`}>
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-6 h-6 text-white" />
          <span className="text-lg font-semibold text-white">{mode.label}</span>
        </div>
        <p className="text-sm text-white/80">{mode.description}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Policy Version</span>
          <Badge variant="outline" className="font-mono">{policyVersion}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Timer className="w-3 h-3" /> Last Updated
          </span>
          <span className="text-xs">
            {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
