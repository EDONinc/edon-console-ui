import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { edonApi, Decision } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const POLL_MS = 8000; // 8 seconds polling interval

interface DecisionStreamTableProps {
  onSelectDecision?: (decision: Decision) => void;
  limit?: number;
  autoRefresh?: boolean;
}

const verdictStyles = {
  allowed: 'badge-allowed',
  blocked: 'badge-blocked',
  confirm: 'badge-confirm',
};

export function DecisionStreamTable({ 
  onSelectDecision, 
  limit = 50,
  autoRefresh = true 
}: DecisionStreamTableProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuditFallback, setShowAuditFallback] = useState(false);
  const auditForbiddenRef = useRef(false);
  const { toast } = useToast();

  const fetchDecisions = useCallback(async () => {
    try {
      const result = await edonApi.getDecisions({ limit });
      const list = Array.isArray(result?.decisions) ? result.decisions : [];
      if (list.length > 0) {
        setDecisions(list);
        setShowAuditFallback(false);
      } else if (!auditForbiddenRef.current) {
        const audit = await edonApi.getAudit({ limit });
        if (audit === null) {
          // 403 — this token lacks 'audit' permission; stop trying on every poll
          auditForbiddenRef.current = true;
          setShowAuditFallback(false);
        } else {
          const records = Array.isArray(audit?.records) ? audit.records : [];
          setDecisions(records);
          setShowAuditFallback(records.length > 0);
        }
      }
    } catch (error) {
      toast({
        title: 'Error fetching decisions',
        description: 'Could not load decision stream',
        variant: 'destructive',
      });
      setDecisions([]);
      setShowAuditFallback(false);
    } finally {
      setLoading(false);
    }
  }, [limit, toast]);

  useEffect(() => {
    if (!autoRefresh) {
      fetchDecisions();
      return;
    }

    let interval: number | undefined;

    const start = () => {
      if (interval) window.clearInterval(interval);
      interval = window.setInterval(() => {
        fetchDecisions();
      }, POLL_MS);
    };

    const stop = () => {
      if (interval) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };

    const onVis = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchDecisions();
        start();
      }
    };

    // First load
    fetchDecisions();
    start();

    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchDecisions, autoRefresh]);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const list = decisions ?? [];
  const isEmpty = list.length === 0;

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Decision Stream
        </h3>
        {showAuditFallback && (
          <p className="text-xs text-muted-foreground mt-1">
            Showing audit fallback; no decisions found for active intent.
          </p>
        )}
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="p-2">
          {isEmpty ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No decisions recorded.{' '}
              <Link to="/audit" className="text-primary hover:underline">
                Check Audit
              </Link>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {list.map((decision, index) => (
                <motion.div
                  key={decision?.id ?? `row-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => decision && onSelectDecision?.(decision)}
                  className="p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={`${verdictStyles[(decision?.verdict as keyof typeof verdictStyles) ?? 'allowed'] || 'badge-allowed'} text-xs px-2 py-0.5`}>
                      {decision?.verdict ?? 'unknown'}
                    </Badge>
                    <span className="text-sm font-mono truncate">
                      {decision?.tool && typeof decision.tool === 'object'
                        ? (decision.tool.op ?? decision.tool.name)
                        : decision?.action_id ?? 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="font-mono">{decision?.agent_id ?? 'unknown'}</span>
                    <span>{decision?.latency_ms ?? 0}ms</span>
                    <span className="hidden sm:inline">
                      {decision?.timestamp ?? decision?.created_at
                        ? new Date(decision.timestamp ?? decision.created_at!).toLocaleTimeString()
                        : 'N/A'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
