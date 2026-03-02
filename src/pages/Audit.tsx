import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from '@/components/TopNav';
import { edonApi, Decision } from '@/lib/api';
import { formatJSON } from '@/lib/redact';
import { toolOp } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileJson, FileSpreadsheet, RefreshCcw, Eye, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const verdictStyles = {
  allowed: 'badge-allowed',
  blocked: 'badge-blocked',
  confirm: 'badge-confirm',
};

const verdictClass = (verdict?: string) => {
  const v = (verdict ?? '').toLowerCase();
  return verdictStyles[v as keyof typeof verdictStyles] || 'badge-allowed';
};

export default function Audit() {
  const [records, setRecords] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditForbidden, setAuditForbidden] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Decision | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { toast } = useToast();

  // Filters
  const [verdictFilter, setVerdictFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [intentIdFilter, setIntentIdFilter] = useState('');
  const [policyVersionFilter, setPolicyVersionFilter] = useState('');
  const [timeRangeStart, setTimeRangeStart] = useState('');
  const [timeRangeEnd, setTimeRangeEnd] = useState('');

  const fetchAudit = useCallback(async () => {
    if (auditForbidden) return;
    setLoading(true);
    try {
      const params: { limit?: number; verdict?: string; agent_id?: string; intent_id?: string } = {};
      if (verdictFilter !== 'all') params.verdict = verdictFilter;
      if (agentFilter) params.agent_id = agentFilter;
      if (intentIdFilter) params.intent_id = intentIdFilter;
      params.limit = 1000; // Get more results for client-side filtering

      const result = await edonApi.getAudit(params);

      if (result === null) {
        setAuditForbidden(true);
        return;
      }

      // Client-side filtering for policy_version and time range
      let filtered = result.records;
      
      if (policyVersionFilter) {
        filtered = filtered.filter(r => 
          r.policy_version?.toLowerCase().includes(policyVersionFilter.toLowerCase())
        );
      }
      
      if (timeRangeStart) {
        const startDate = new Date(timeRangeStart);
        filtered = filtered.filter(r => {
          const recordDate = new Date(r.created_at || r.timestamp);
          return recordDate >= startDate;
        });
      }
      
      if (timeRangeEnd) {
        const endDate = new Date(timeRangeEnd);
        endDate.setHours(23, 59, 59, 999); // End of day
        filtered = filtered.filter(r => {
          const recordDate = new Date(r.created_at || r.timestamp);
          return recordDate <= endDate;
        });
      }
      
      setRecords(filtered);
      setPage(1);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch audit records',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [verdictFilter, agentFilter, intentIdFilter, policyVersionFilter, timeRangeStart, timeRangeEnd, toast, auditForbidden]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const sanitizeCsvValue = (value: unknown) => {
    const str = value == null ? '' : String(value);
    const escaped = str.replace(/"/g, '""');
    const needsEscaping = /[",\n]/.test(escaped);
    const prefixed = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
    return needsEscaping ? `"${prefixed}"` : prefixed;
  };

  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Verdict', 'Tool', 'Agent ID', 'Reason', 'Latency (ms)'];
    const rows = records.map((r) => [
      r.id,
      r.timestamp,
      r.verdict,
      toolOp(r.tool),
      r.agent_id,
      r.reason_code,
      r.latency_ms,
    ]);
    
    const csv = [headers.join(','), ...rows.map((r) => r.map(sanitizeCsvValue).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'CSV file downloaded successfully',
    });
  };

  const exportJSON = () => {
    const json = JSON.stringify(records, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'JSON file downloaded successfully',
    });
  };

  const viewPayload = (record: Decision) => {
    setSelectedRecord(record);
    setModalOpen(true);
  };

  if (auditForbidden) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <main className="container mx-auto px-6 py-8">
          <div className="glass-card p-8 text-center text-muted-foreground">
            <p className="text-sm">Audit access requires an API key with <strong>operator</strong> or <strong>admin</strong> role.</p>
            <p className="text-xs mt-2">Generate a new key with elevated permissions or contact your administrator.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      
      <main className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1">Audit Log</h1>
              <p className="text-muted-foreground">Complete audit trail of all decisions</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={exportCSV} variant="outline" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </Button>
              <Button onClick={exportJSON} variant="outline" className="gap-2">
                <FileJson className="w-4 h-4" />
                Export JSON
              </Button>
              <Button onClick={fetchAudit} variant="outline" className="gap-2">
              <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card p-4 mb-6">
            <div className="space-y-4">
              {/* First Row */}
              <div className="flex flex-wrap gap-4">
                <Select value={verdictFilter} onValueChange={setVerdictFilter}>
                  <SelectTrigger className="w-[180px] bg-secondary/50">
                    <SelectValue placeholder="Filter by verdict" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Verdicts</SelectItem>
                    <SelectItem value="allowed">Allowed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="confirm">Confirm</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative min-w-[200px]">
                  <Input
                    placeholder="Agent ID..."
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
              </div>

              {/* Second Row */}
              <div className="flex flex-wrap gap-4">
                <div className="relative min-w-[250px]">
                  <Input
                    placeholder="Intent ID (e.g., intent_abc123...)"
                    value={intentIdFilter}
                    onChange={(e) => setIntentIdFilter(e.target.value)}
                    className="bg-secondary/50 font-mono text-sm"
                  />
                </div>

                <div className="relative min-w-[200px]">
                  <Input
                    placeholder="Safety Version (e.g., 1.0.0)"
                    value={policyVersionFilter}
                    onChange={(e) => setPolicyVersionFilter(e.target.value)}
                    className="bg-secondary/50 font-mono text-sm"
                  />
                </div>

                <div className="relative min-w-[180px]">
                  <Input
                    type="datetime-local"
                    placeholder="Start Date"
                    value={timeRangeStart}
                    onChange={(e) => setTimeRangeStart(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <div className="relative min-w-[180px]">
                  <Input
                    type="datetime-local"
                    placeholder="End Date"
                    value={timeRangeEnd}
                    onChange={(e) => setTimeRangeEnd(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <Button onClick={fetchAudit} disabled={loading}>
                  {loading ? 'Applying…' : 'Apply Filters'}
                </Button>
                  <Button 
                  onClick={() => {
                    const now = new Date();
                    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
                    setTimeRangeStart(fiveMinutesAgo.toISOString().slice(0, 16));
                    setTimeRangeEnd(now.toISOString().slice(0, 16));
                    fetchAudit();
                  }}
                  variant="outline"
                    disabled={loading}
                >
                  Last 5 Min
                </Button>
                  <Button 
                  onClick={() => {
                    setVerdictFilter('all');
                    setAgentFilter('');
                    setIntentIdFilter('');
                    setPolicyVersionFilter('');
                    setTimeRangeStart('');
                    setTimeRangeEnd('');
                    fetchAudit();
                  }}
                  variant="outline"
                    disabled={loading}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Timestamp</TableHead>
                  <TableHead className="text-muted-foreground">Verdict</TableHead>
                  <TableHead className="text-muted-foreground">Tool Operation</TableHead>
                  <TableHead className="text-muted-foreground">Agent ID</TableHead>
                  <TableHead className="text-muted-foreground">Reason</TableHead>
                  <TableHead className="text-muted-foreground">Intent ID</TableHead>
                  <TableHead className="text-muted-foreground">Safety Version</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-white/10">
                      <TableCell colSpan={8}>
                        <div className="h-8 bg-white/5 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow className="border-white/10">
                    <TableCell colSpan={8}>
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No audit records found for the selected filters.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  records
                    .slice((page - 1) * pageSize, page * pageSize)
                    .map((record, index) => (
                    <TableRow
                      key={record.id || record.action_id || record.timestamp || String(index)}
                      className="border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <TableCell className="font-mono text-sm">
                        {new Date(record.created_at || record.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={verdictClass(record.verdict)}>
                          {record.verdict}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{toolOp(record.tool)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {record.agent_id}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.reason_code}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {record.intent_id ? (
                          <span className="truncate max-w-[200px] block" title={record.intent_id}>
                            {record.intent_id}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {record.policy_version || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewPayload(record)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!loading && records.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
              <div>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, records.length)} of {records.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => (p * pageSize >= records.length ? p : p + 1))}
                  disabled={page * pageSize >= records.length}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Payload Viewer Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono">{toolOp(selectedRecord?.tool)}</span>
              {selectedRecord && (
                <Badge className={verdictStyles[selectedRecord.verdict]}>
                  {selectedRecord.verdict}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Request Payload (Redacted)</h4>
                <pre className="p-4 bg-secondary/50 rounded-lg text-sm font-mono overflow-x-auto">
                  {selectedRecord?.request_payload
                    ? formatJSON(selectedRecord.request_payload)
                    : 'No payload available'}
                </pre>
              </div>
              
              {selectedRecord?.explanation && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Explanation</h4>
                  <p className="text-sm">{selectedRecord.explanation}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
