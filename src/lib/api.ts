// EDON API Client with mock support

const getBaseUrl = () => {
  const isProd = import.meta.env.MODE === 'production';
  if (typeof window !== 'undefined') {
    const stored = (
      localStorage.getItem('EDON_BASE_URL') ||
      localStorage.getItem('edon_api_base') ||
      localStorage.getItem('edon_base_url') ||
      ''
    ).trim();
    if (stored) {
      return stored;
    }
    const envUrl = import.meta.env.VITE_EDON_GATEWAY_URL;
    if (envUrl) {
      return envUrl;
    }
  }
  return isProd ? 'https://edon-gateway.fly.dev' : 'http://127.0.0.1:8000';
};

const getToken = () => {
  if (typeof window === 'undefined') return '';

  const stored = (
    localStorage.getItem('edon_token') ||
    localStorage.getItem('edon_session_token') ||
    localStorage.getItem('edon_api_key') ||
    ''
  ).trim();
  if (stored) return stored;

  if (import.meta.env.MODE !== 'production') {
    const envToken = (import.meta.env.VITE_EDON_API_TOKEN || '').trim();
    if (envToken) return envToken;
  }

  return '';
};

const getAgentId = () => {
  if (typeof window === 'undefined') return 'edon-ui';
  return (localStorage.getItem('edon_agent_id') || '').trim() || 'edon-ui';
};

const isMockMode = () => {
  if (import.meta.env.MODE === 'production') return false;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('edon_mock_mode');
    // Default to false (production mode) if not set
    // Only use mock mode if explicitly set to 'true'
    if (import.meta.env.VITE_EDON_MOCK_MODE !== undefined) {
      return import.meta.env.VITE_EDON_MOCK_MODE === 'true';
    }
    return stored === 'true';
  }
  // Server-side: default to false (production mode)
  return false;
};

// Mock data generators
const generateMockDecisions = (count: number = 50) => {
  const tools = ['file.read', 'file.write', 'shell.exec', 'http.request', 'db.query', 'email.send'];
  const verdicts = ['allowed', 'blocked', 'confirm'] as const;
  const reasons = ['policy_match', 'risk_threshold', 'user_override', 'rate_limit', 'context_violation'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `dec_${Date.now() - i * 60000}`,
    timestamp: new Date(Date.now() - i * 60000 * Math.random() * 100).toISOString(),
    verdict: verdicts[Math.floor(Math.random() * verdicts.length)],
    tool: { op: tools[Math.floor(Math.random() * tools.length)] },
    agent_id: `agent_${Math.floor(Math.random() * 5) + 1}`,
    reason_code: reasons[Math.floor(Math.random() * reasons.length)],
    latency_ms: Math.floor(Math.random() * 50) + 5,
    explanation: 'Action evaluated against current policy rules.',
    safe_alternative: Math.random() > 0.5 ? 'Consider using sandbox mode.' : null,
    policy_version: 'v1.2.3',
    request_payload: { action: 'sample', params: { key: 'value' } },
  }));
};

const generateMockMetrics = () => ({
  allowed_24h: Math.floor(Math.random() * 500) + 200,
  blocked_24h: Math.floor(Math.random() * 50) + 10,
  confirm_24h: Math.floor(Math.random() * 30) + 5,
  latency_p50: Math.floor(Math.random() * 20) + 8,
  latency_p95: Math.floor(Math.random() * 40) + 30,
  latency_p99: Math.floor(Math.random() * 80) + 60,
});

const generateMockTimeSeriesData = (days: number = 7) => {
  const data = [];
  const now = Date.now();
  const interval = days === 1 ? 3600000 : 86400000; // 1 hour or 1 day
  const points = days === 1 ? 24 : 7;
  
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * interval);
    data.push({
      timestamp: timestamp.toISOString(),
      label: days === 1 
        ? timestamp.toLocaleTimeString('en-US', { hour: '2-digit' })
        : timestamp.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      allowed: Math.floor(Math.random() * 80) + 40,
      blocked: Math.floor(Math.random() * 15) + 5,
      confirm: Math.floor(Math.random() * 10) + 2,
    });
  }
  return data;
};

const generateMockBlockReasons = () => [
  { reason: 'Unauthorized file access', count: 45 },
  { reason: 'Rate limit exceeded', count: 32 },
  { reason: 'Sensitive data exposure', count: 28 },
  { reason: 'Network policy violation', count: 21 },
  { reason: 'Shell command blocked', count: 15 },
  { reason: 'Database write denied', count: 12 },
];

const VERDICT_MAP: Record<string, string> = {
  ALLOW: "allowed", BLOCK: "blocked", ESCALATE: "confirm", DEGRADE: "confirm", PAUSE: "confirm",
};

const normalizeDecision = (decision: Decision): Decision => {
  const raw = decision as Record<string, unknown>;

  // Detect audit event format (nested 'action' + 'decision' sub-objects from /audit/query)
  const actionSub = raw.action as { id?: string; tool?: string; op?: string; params?: object } | undefined;
  const decisionSub = raw.decision as { verdict?: string; reason_code?: string; explanation?: string; policy_version?: string } | undefined;
  const contextSub = raw.context as Record<string, unknown> | undefined;

  const result: Record<string, unknown> = { ...raw };

  if (actionSub && decisionSub) {
    // Audit event — flatten nested fields to top level
    const rawVerdict = (decisionSub.verdict ?? "").toUpperCase();
    if (!result.id) result.id = actionSub.id ?? "";
    result.verdict = VERDICT_MAP[rawVerdict] ?? rawVerdict.toLowerCase();
    result.reason_code = result.reason_code ?? decisionSub.reason_code ?? "";
    result.explanation = result.explanation ?? decisionSub.explanation ?? "";
    result.policy_version = result.policy_version ?? decisionSub.policy_version ?? "";
    // agent_id: prefer top-level (set by backend fix), fall back to context
    result.agent_id = result.agent_id || contextSub?.agent_id || "";
    result.timestamp = result.timestamp ?? result.created_at;
    result.request_payload = (result.request_payload as object | undefined) ?? actionSub.params;
    if (actionSub.tool && actionSub.op) {
      result.tool = { name: actionSub.tool, op: actionSub.op };
    }
  }

  // Normalize tool to consistent {name?, op?} shape
  const rawTool = result.tool;
  const tool =
    rawTool && typeof rawTool === "object"
      ? rawTool
      : { op: typeof rawTool === "string" ? rawTool : "N/A" };

  return { ...result, tool } as Decision;
};

// API Client
class EdonApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (isMockMode()) {
      return this.mockRequest(endpoint, options);
    }

    const baseUrl = getBaseUrl();
    const token = getToken();
    if (!token) {
      throw new Error('Authentication required. Set your token in Settings.');
    }

    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          "X-EDON-TOKEN": token,
        },
      });

      // Handle 429 (Too Many Requests) with retry logic
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter
            ? Number(retryAfter) * 1000
            : 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
          
          await new Promise((r) => setTimeout(r, waitMs));
          continue; // Retry
        } else {
          throw new Error('API Error: 429 Too Many Requests (retries exhausted)');
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Token is stale or revoked — clear it so the user isn't stuck
          localStorage.removeItem('edon_token');
          localStorage.removeItem('edon_session_token');
          localStorage.removeItem('edon_api_key');
          throw new Error('Authentication required. Set your token in Settings.');
        }
        if (response.status === 403) {
          throw new Error('forbidden');
        }
        const body = await response.text();
        throw new Error(
          body
            ? `API Error: ${response.status} ${response.statusText} — ${body}`
            : `API Error: ${response.status} ${response.statusText}`
        );
      }

      return response.json();
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('API Error: Request failed after retries');
  }

  private async mockRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    if (endpoint === '/health') {
      return {
        status: 'healthy',
        version: '1.0.0',
        uptime_seconds: 3600,
        governor: {
          policy_version: '1.0.0',
          active_intents: 1,
          active_preset: {
            preset_name: 'clawdbot_safe',
            applied_at: new Date().toISOString(),
          },
        },
      } as T;
    }

    if (endpoint === '/metrics') {
      return generateMockMetrics() as T;
    }

    if (endpoint.startsWith('/decisions/query')) {
      return { decisions: generateMockDecisions(), total: 50 } as T;
    }

    if (endpoint.startsWith('/decisions/')) {
      // Individual decision lookup
      return generateMockDecisions(1)[0] as T;
    }

    if (endpoint.startsWith('/audit/query')) {
      // Mock returns gateway format, will be transformed by getAudit()
      return { events: generateMockDecisions(100), total: 100, limit: 100 } as T;
    }

    if (endpoint === '/policy-packs') {
      return [
        {
          name: 'personal_safe',
          description: 'Conservative mode optimized for personal use',
          risk_level: 'low',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 4, blocked_tools: 4, confirm_required: true },
        },
        {
          name: 'work_safe',
          description: 'Balanced policy for business workflows',
          risk_level: 'medium',
          scope_summary: { agents: 1 },
          constraints_summary: { allowed_tools: 6, blocked_tools: 3, confirm_required: true },
        },
      ] as T;
    }

    if (endpoint.startsWith('/policy-packs/') && endpoint.endsWith('/apply') && options.method === 'POST') {
      return {
        intent_id: 'intent_mock_123',
        policy_pack: endpoint.split('/')[2],
        message: 'Policy pack applied',
        scope_includes_clawdbot: true,
      } as T;
    }

    if (endpoint === '/v1/action' && options.method === 'POST') {
      const body = JSON.parse(options.body as string);
      const blockedPrefixes = ['shell', 'database', 'http'];
      const blockedOps = ['send'];
      const [toolPart, opPart] = (body.action_type || '').split('.');
      const isBlocked =
        blockedPrefixes.includes(toolPart) ||
        (toolPart === 'email' && blockedOps.includes(opPart));
      const decision = isBlocked ? 'BLOCK' : 'ALLOW';
      return {
        action_id: `mock-${Date.now()}`,
        decision,
        decision_reason: isBlocked
          ? 'Policy violation: action not permitted under active preset'
          : 'Action permitted by active governance preset',
        processing_latency_ms: Math.floor(Math.random() * 30) + 5,
      } as T;
    }

    if (endpoint === '/integrations/clawdbot/connect' && options.method === 'POST') {
      return {
        connected: true,
        credential_id: 'clawdbot_gateway',
        base_url: 'http://127.0.0.1:18789',
        auth_mode: 'password',
        message: 'Agent connected. Credential saved.',
      } as T;
    }

    if (endpoint.startsWith('/timeseries')) {
      const days = new URLSearchParams(endpoint.split('?')[1] || '').get('days') || '7';
      return generateMockTimeSeriesData(parseInt(days)) as T;
    }

    if (endpoint.startsWith('/block-reasons')) {
      return generateMockBlockReasons() as T;
    }

    return {} as T;
  }

  getSession() {
    return this.request<{ id: string | null; email: string | null; tenant_id: string | null; plan: string | null; status: string | null }>(
      '/auth/session'
    );
  }

  getBillingStatus() {
    return this.request<{
      tenant_id: string;
      status: string;
      plan: string;
      usage: { today: number };
      limits: { requests_per_month: number; requests_per_day: number; requests_per_minute: number };
    }>('/billing/status');
  }

  listApiKeys() {
    return this.request<{ keys: Array<{ id: string; name: string; created_at?: string }>; total: number }>(
      '/billing/api-keys'
    );
  }

  createApiKey(name: string) {
    return this.request<{ api_key: string; api_key_id: string; tenant_id: string; warning?: string }>(
      '/billing/api-keys',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    );
  }

  async getHealth() {
    return this.request<{
      status: string;
      version: string;
      uptime_seconds: number;
      governor: {
        policy_version: string;
        active_intents: number;
        active_preset?: {
          preset_name: string;
          applied_at: string;
        } | null;
      };
    }>('/health');
  }

  async health() {
    return this.request<{ status: string; version: string; uptime_seconds: number }>("/health");
  }

  async getIntegrations() {
    return this.request<Record<string, unknown>>("/integrations/account/integrations");
  }

  async connectTelegram(botToken: string, chatId: string) {
    return this.request<{ connected: boolean; channel: string; message: string }>(
      "/integrations/telegram/connect",
      { method: "POST", body: JSON.stringify({ bot_token: botToken, chat_id: chatId }) }
    );
  }

  async connectSlack(webhookUrl: string) {
    return this.request<{ connected: boolean; channel: string; message: string }>(
      "/integrations/slack/connect",
      { method: "POST", body: JSON.stringify({ webhook_url: webhookUrl }) }
    );
  }

  async connectDiscord(webhookUrl: string) {
    return this.request<{ connected: boolean; channel: string; message: string }>(
      "/integrations/discord/connect",
      { method: "POST", body: JSON.stringify({ webhook_url: webhookUrl }) }
    );
  }

  async getAlertPreferences() {
    return this.request<AlertPreferences>("/integrations/alert-preferences");
  }

  async patchAlertPreferences(prefs: Partial<AlertPreferences>) {
    return this.request<AlertPreferences>("/integrations/alert-preferences", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    });
  }

  async getMetrics() {
    // We don't have /stats in the gateway.
    // So we approximate metrics using /decisions/query counts per verdict.
    const [allow, block, confirm, total] = await Promise.all([
      this.request<{ total: number }>(`/decisions/query?verdict=ALLOW&limit=1000`),
      this.request<{ total: number }>(`/decisions/query?verdict=BLOCK&limit=1000`),
      this.request<{ total: number }>(`/decisions/query?verdict=CONFIRM&limit=1000`),
      this.request<{ total: number }>(`/decisions/query?limit=1000`),
    ]);

    return {
      allowed_24h: allow.total || 0,
      blocked_24h: block.total || 0,
      confirm_24h: confirm.total || 0,
      decisions_total: total.total || 0,
      // Latency is not currently exposed by the gateway JSON API.
      latency_p50: 0,
      latency_p95: 0,
      latency_p99: 0,
    };
  }

  async getDecisions(params?: {
    verdict?: string;
    tool?: string;
    agent_id?: string;
    intent_id?: string;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.verdict) {
      // Map UI verdict format to gateway format (uppercase)
      const verdictMap: Record<string, string> = {
        'allowed': 'ALLOW',
        'blocked': 'BLOCK',
        'confirm': 'CONFIRM'
      };
      const gatewayVerdict = verdictMap[params.verdict.toLowerCase()] || params.verdict.toUpperCase();
      searchParams.set('verdict', gatewayVerdict);
    }
    if (params?.tool) searchParams.set('tool', params.tool);
    if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
    if (params?.intent_id) searchParams.set('intent_id', params.intent_id);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    const query = searchParams.toString();
    const result = await this.request<{ decisions: Decision[]; total: number }>(
      `/decisions/query${query ? `?${query}` : ''}`
    );
    return {
      ...result,
      decisions: Array.isArray(result?.decisions)
        ? result.decisions.map((d) => normalizeDecision(d))
        : [],
    };
  }

  async getDecisionById(decisionId: string) {
    const result = await this.request<Decision>(`/decisions/${decisionId}`);
    return normalizeDecision(result);
  }

  async getAudit(params?: { limit?: number; offset?: number; verdict?: string; agent_id?: string; intent_id?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    // Note: Gateway doesn't support offset, only limit
    if (params?.verdict) {
      // Map UI verdict format to gateway format (uppercase)
      const verdictMap: Record<string, string> = {
        'allowed': 'ALLOW',
        'blocked': 'BLOCK',
        'confirm': 'CONFIRM'
      };
      const gatewayVerdict = verdictMap[params.verdict.toLowerCase()] || params.verdict.toUpperCase();
      searchParams.set('verdict', gatewayVerdict);
    }
    if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
    if (params?.intent_id) searchParams.set('intent_id', params.intent_id);
    
    const query = searchParams.toString();
    // Gateway returns { events: [...], total: number, limit: number }
    // Map to UI format { records: [...], total: number }
    try {
      const response = await this.request<{ events: Decision[]; total: number; limit: number }>(
        `/audit/query${query ? `?${query}` : ''}`
      );
      return {
        records: Array.isArray(response?.events)
          ? response.events.map((r) => normalizeDecision(r))
          : [],
        total: response.total
      };
    } catch (err) {
      // 403 = agent role lacks 'audit' permission — return null so callers
      // can distinguish "no permission" from "empty result" and stop retrying
      if (err instanceof Error && err.message === 'forbidden') {
        return null;
      }
      throw err;
    }
  }

  async getTimeSeriesData(days: number = 7) {
    if (isMockMode()) {
      return generateMockTimeSeriesData(days);
    }
    return this.request<TimeSeriesPoint[]>(`/timeseries?days=${days}`);
  }

  async getBlockReasons(days: number = 7) {
    if (isMockMode()) {
      return generateMockBlockReasons();
    }
    return this.request<BlockReason[]>(`/block-reasons?days=${days}`);
  }

  async setIntent(payload: { mode: string }) {
    return this.request<{ success: boolean }>('/intent/set', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async execute(payload: object) {
    return this.request<{ result: unknown }>('/execute', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async invokeClawdbot(payload: {
    tool: string;
    action?: string;
    args?: Record<string, unknown>;
    sessionKey?: string | null;
    credential_id?: string | null;
  }) {
    const agentId = getAgentId();
    return this.request<{
      ok: boolean;
      result?: Record<string, unknown>;
      error?: string;
      edon_verdict?: string;
      edon_explanation?: string;
    }>('/clawdbot/invoke', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'X-EDON-Agent-ID': agentId,
      },
    });
  }

  // Integration endpoints
  async connectClawdbot(payload: {
    base_url: string;
    auth_mode: 'password' | 'token';
    secret: string;
    credential_id?: string;
    probe?: boolean;
  }) {
    return this.request<{
      connected: boolean;
      credential_id: string;
      base_url: string;
      auth_mode: 'password' | 'token';
      message: string;
    }>('/integrations/clawdbot/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getIntegrationStatus() {
    return this.request<{
      clawdbot: {
        connected: boolean;
        base_url?: string;
        auth_mode?: 'password' | 'token';
        last_ok_at?: string;
        last_error?: string | null;
        active_policy_pack?: string | null;
        default_intent_id?: string | null;
      };
    }>('/integrations/account/integrations');
  }

  async getPolicyPacks() {
    // Backend returns { packs: [...], default: "...", active_preset: "..." }
    // Extract just the packs array for UI compatibility
    const response = await this.request<{
      packs: Array<{
        name: string;
        description: string;
        risk_level: string;
        scope_summary: Record<string, number>;
        constraints_summary: {
          allowed_tools: number;
          blocked_tools: number;
          confirm_required: boolean;
        };
      }>;
      default?: string;
      active_preset?: string;
    }>('/policy-packs');
    
    // Return just the packs array
    return response.packs || [];
  }

  async applyPolicyPack(packName: string, objective?: string) {
    const query = objective ? `?objective=${encodeURIComponent(objective)}` : '';
    return this.request<{
      intent_id: string;
      policy_pack: string;
      intent: object;
      active_preset: string;
      message: string;
      scope_includes_clawdbot: boolean;
    }>(`/policy-packs/${packName}/apply${query}`, {
      method: 'POST',
    });
  }

  async evaluateAction(payload: {
    action_type: string;
    action_payload: Record<string, unknown>;
    intent_id?: string;
  }) {
    return this.request<{
      action_id: string;
      decision: string;
      decision_reason: string;
      processing_latency_ms: number;
      reason_code?: string;
    }>('/v1/action', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'edon-demo-ui',
        action_type: payload.action_type,
        action_payload: payload.action_payload,
        timestamp: new Date().toISOString(),
        context: payload.intent_id ? { intent_id: payload.intent_id } : {},
      }),
    });
  }

  async deleteApiKey(id: string) {
    return this.request<{ success: boolean }>(`/billing/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  async getTeamMembers() {
    try {
      return await this.request<{
        members: Array<{
          id: string;
          name?: string;
          email: string;
          role?: string;
          status?: string;
          joined_at?: string;
        }>;
        total: number;
      }>('/team/members');
    } catch {
      return null;
    }
  }

  async inviteTeamMember(email: string, role: string) {
    try {
      return await this.request<{ success: boolean; message?: string }>('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    } catch {
      return null;
    }
  }

  async removeTeamMember(memberId: string) {
    try {
      return await this.request<{ success: boolean }>(`/team/members/${memberId}`, {
        method: 'DELETE',
      });
    } catch {
      return null;
    }
  }

  // Agent Fleet Management

  async listAgents(params?: { status?: string; agent_type?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.agent_type) searchParams.set('agent_type', params.agent_type);
    const query = searchParams.toString();
    try {
      return await this.request<{ agents: AgentProfile[]; total: number }>(
        `/agents${query ? `?${query}` : ''}`
      );
    } catch {
      return null;
    }
  }

  async registerAgent(data: {
    agent_id: string;
    name: string;
    agent_type: string;
    description?: string;
    capabilities?: string[];
    policy_pack?: string;
    mag_enabled?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    return this.request<AgentProfile>('/agents/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAgent(agentId: string) {
    try {
      return await this.request<AgentProfile>(`/agents/${agentId}`);
    } catch {
      return null;
    }
  }

  async getAgentTimeline(
    agentId: string,
    params?: { limit?: number; offset?: number; verdict?: string; days?: number }
  ) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.verdict) searchParams.set('verdict', params.verdict);
    if (params?.days) searchParams.set('days', params.days.toString());
    const query = searchParams.toString();
    try {
      return await this.request<{ events: AgentTimelineEvent[]; total: number }>(
        `/agents/${agentId}/timeline${query ? `?${query}` : ''}`
      );
    } catch {
      return null;
    }
  }

  async getAgentStats(agentId: string) {
    try {
      return await this.request<AgentStatsTimeSeries>(`/agents/${agentId}/stats`);
    } catch {
      return null;
    }
  }

  async updateAgentStatus(agentId: string, status: 'active' | 'paused' | 'retired') {
    return this.request<{ success: boolean; agent_id: string; status: string }>(
      `/agents/${agentId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
  }

  async getAgentAnomalies() {
    try {
      return await this.request<{
        flagged_agents: Array<{ agent_id: string; reason?: string; block_rate_7d?: number }>;
        total_flagged: number;
        scanned_at: string;
      }>('/agents/anomalies');
    } catch {
      return null;
    }
  }
}

// Types
export interface Decision {
  id: string;
  timestamp: string;
  created_at?: string; // Backend uses created_at
  verdict: 'allowed' | 'blocked' | 'confirm' | 'unknown' | string;
  tool?: { op?: string; name?: string } | string | null;
  agent_id?: string | null;
  reason_code?: string | null;
  latency_ms?: number | null;
  explanation?: string;
  safe_alternative?: string | null;
  policy_version?: string;
  intent_id?: string;
  request_payload?: object;
  action_id?: string; // Fallback if tool is missing
}

export interface TimeSeriesPoint {
  timestamp: string;
  label: string;
  allowed: number;
  blocked: number;
  confirm: number;
}

export interface BlockReason {
  reason: string;
  count: number;
}

export interface AlertPreferences {
  alert_on_blocked?: boolean;
  alert_on_policy_violation?: boolean;
  alert_on_drift?: boolean;
  alert_on_escalation?: boolean;
}

export const edonApi = new EdonApiClient();
export { getBaseUrl, getToken, getAgentId, isMockMode };

export interface AgentProfile {
  agent_id: string;
  name: string;
  agent_type: string;
  description: string;
  capabilities: string[];
  policy_pack: string;
  status: 'active' | 'paused' | 'retired';
  registered_at: string;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  mag_enabled?: boolean;
  stats: {
    total_actions: number;
    allow_count: number;
    block_count: number;
    block_rate: number;
    allow_rate: number;
    last_action_at: string | null;
  };
  trend_7d?: Array<{ date: string; count: number }>;
  top_tools?: Array<{ tool: string; count: number }>;
  top_block_reasons?: Array<{ reason_code: string; count: number }>;
  behavioral_cav_state?: { block_rate_7d: number; allow_rate_7d: number };
}

export interface AgentTimelineEvent {
  id: string;
  timestamp: string;
  action_type?: string;
  tool?: string;
  op?: string;
  verdict: string;
  reason_code?: string;
  latency_ms?: number;
  explanation?: string;
}

export interface AgentStatsTimeSeries {
  days: Array<{ date: string; allow: number; block: number; confirm: number }>;
}
