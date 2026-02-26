import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  variant?: 'default' | 'success' | 'danger' | 'warning';
  delay?: number;
}

const variantStyles = {
  default: 'from-primary/20 to-primary/5',
  success: 'from-emerald-500/20 to-emerald-500/5',
  danger: 'from-red-500/20 to-red-500/5',
  warning: 'from-amber-500/20 to-amber-500/5',
};

const iconVariantStyles = {
  default: 'text-primary bg-primary/20',
  success: 'text-emerald-400 bg-emerald-500/20',
  danger: 'text-red-400 bg-red-500/20',
  warning: 'text-amber-400 bg-amber-500/20',
};

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  changeType = 'neutral',
  variant = 'default',
  delay = 0 
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.5 }}
      className="glass-card-hover p-6"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${variantStyles[variant]} opacity-50`} />
      
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {change && (
            <p className={`text-xs mt-2 ${
              changeType === 'positive' ? 'text-emerald-400' :
              changeType === 'negative' ? 'text-red-400' : 'text-muted-foreground'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconVariantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
