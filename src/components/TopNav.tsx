import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Gauge, ListChecks, FileSearch, Settings2,
  LogOut, User, CreditCard, Users, Key, ChevronDown, Bot,
  Bell, ShieldAlert, X, Menu,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { edonApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/decisions', label: 'Decisions', icon: ListChecks },
  { to: '/audit', label: 'Audit', icon: FileSearch },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

interface Notif {
  id: string;
  verdict: string;
  tool: string;
  agent_id: string | null;
  reason_code: string | null;
  timestamp: string;
}

const LAST_SEEN_KEY = 'edon_notifs_last_seen';

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(true);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('edon_user_email') || '');
  const [userPlan, setUserPlan] = useState(() => localStorage.getItem('edon_plan') || 'Starter');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('edon_display_name') || '');
  const [mobileOpen, setMobileOpen] = useState(false);

  const _hasAnyToken = () =>
    Boolean(
      localStorage.getItem('edon_token') ||
      localStorage.getItem('edon_api_key') ||
      localStorage.getItem('edon_session_token') ||
      (import.meta.env.MODE !== 'production' && import.meta.env.VITE_EDON_API_TOKEN)
    );
  const [hasToken, setHasToken] = useState(() => typeof window !== 'undefined' && _hasAnyToken());

  // ── Notifications ──────────────────────────────────────────────
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const lastSeenRef = useRef<string>(
    typeof window !== 'undefined' ? (localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString()) : new Date(0).toISOString()
  );

  const fetchNotifs = async () => {
    try {
      const result = await edonApi.getDecisions({ verdict: 'blocked', limit: 20 });
      const decisions = result?.decisions ?? [];
      const mapped: Notif[] = decisions.map((d: { id?: string; verdict?: string; tool?: { name?: string; op?: string } | string; agent_id?: string; reason_code?: string; timestamp?: string; created_at?: string }) => ({
        id: d.id ?? Math.random().toString(36).slice(2),
        verdict: d.verdict ?? 'blocked',
        tool: typeof d.tool === 'object' && d.tool
          ? [d.tool.name, d.tool.op].filter(Boolean).join('.')
          : (typeof d.tool === 'string' ? d.tool : '—'),
        agent_id: d.agent_id ?? null,
        reason_code: d.reason_code ?? null,
        timestamp: d.timestamp ?? d.created_at ?? new Date().toISOString(),
      }));

      setNotifs(mapped.slice(0, 10));

      const newCount = mapped.filter(
        (n) => new Date(n.timestamp) > new Date(lastSeenRef.current)
      ).length;
      setUnread(newCount);
    } catch {
      // silently ignore — don't surface notification errors in the nav
    }
  };

  const markAllRead = () => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    localStorage.setItem(LAST_SEEN_KEY, now);
    setUnread(0);
    setNotifsOpen(false);
  };

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ── Connection + auth polling ──────────────────────────────────
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await edonApi.getHealth();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    if (_hasAnyToken()) fetchNotifs();

    const handleStorageChange = () => {
      setHasToken(typeof window !== 'undefined' && _hasAnyToken());
      setUserEmail(localStorage.getItem('edon_user_email') || '');
      setUserPlan(localStorage.getItem('edon_plan') || 'Starter');
      setDisplayName(localStorage.getItem('edon_display_name') || '');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('edon-auth-updated', handleStorageChange as EventListener);

    const interval = setInterval(() => {
      checkConnection();
      setHasToken(typeof window !== 'undefined' && _hasAnyToken());
      if (_hasAnyToken()) fetchNotifs();
    }, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('edon-auth-updated', handleStorageChange as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-background/70"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">

            {/* EDON wordmark */}
            <NavLink to="/" className="flex items-center shrink-0">
              <span className="edon-brand text-lg font-semibold tracking-[0.3em] text-foreground/90">
                EDON
              </span>
            </NavLink>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`nav-item relative flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                      isActive ? 'nav-item-active' : ''
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="absolute inset-x-2 -bottom-1 h-0.5 bg-primary/80 rounded-full"
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">

              {/* Live / Offline badge */}
              <Badge
                variant="outline"
                className={`flex items-center gap-1.5 text-xs ${
                  isConnected
                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                    : 'border-red-500/40 text-red-400 bg-red-500/10'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
              </Badge>

              {/* Notifications bell */}
              {hasToken && (
                <div className="relative">
                  <button
                    onClick={() => { setNotifsOpen((v) => !v); if (!notifsOpen) markAllRead(); }}
                    className="relative flex items-center justify-center w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    aria-label="Governance alerts"
                  >
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {notifsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-10 w-80 rounded-xl border border-white/10 bg-[#0f1117] shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-semibold">Governance Alerts</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={markAllRead}
                              className="text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              Mark all read
                            </button>
                            <button onClick={() => setNotifsOpen(false)}>
                              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto">
                          {notifs.length === 0 ? (
                            <div className="py-8 text-center">
                              <ShieldCheck className="w-6 h-6 text-emerald-400/50 mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">No blocked actions recently</p>
                            </div>
                          ) : (
                            notifs.map((n) => (
                              <div
                                key={n.id}
                                className="px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => { navigate('/audit'); setNotifsOpen(false); }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-mono font-medium truncate">{n.tool}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {n.reason_code ?? 'blocked'}{n.agent_id ? ` · ${n.agent_id}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground/60 shrink-0">{relTime(n.timestamp)}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="px-4 py-2.5 border-t border-white/10">
                          <button
                            onClick={() => { navigate('/audit'); setNotifsOpen(false); }}
                            className="text-xs text-primary hover:underline"
                          >
                            View all in Audit →
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* User menu */}
              {hasToken && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 hover:bg-white/10 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-[#64dc78]/20 border border-[#64dc78]/40 flex items-center justify-center text-[10px] font-bold text-[#64dc78]">
                        {(displayName || userEmail || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden sm:inline text-xs text-foreground/80 max-w-[120px] truncate">
                        {displayName || userEmail || 'Account'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-[#0f1117] border border-white/10">
                    <DropdownMenuLabel className="pb-1">
                      <p className="text-sm font-medium text-foreground truncate">{displayName || userEmail || 'My Account'}</p>
                      {userEmail && displayName && (
                        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                      )}
                      <Badge variant="outline" className="mt-1 text-[10px] border-[#64dc78]/30 text-[#64dc78] bg-[#64dc78]/10">
                        {userPlan}
                      </Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <User className="w-4 h-4 text-muted-foreground" /><span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/team')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <Users className="w-4 h-4 text-muted-foreground" /><span>Team</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/api-keys')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <Key className="w-4 h-4 text-muted-foreground" /><span>API Keys</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/billing')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <CreditCard className="w-4 h-4 text-muted-foreground" /><span>Billing</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <Settings2 className="w-4 h-4 text-muted-foreground" /><span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-red-400 hover:bg-red-500/10 hover:text-red-400 focus:text-red-400"
                      onClick={() => {
                        ['edon_token','edon_api_key','edon_session_token','edon_user_email','edon_plan'].forEach(k => localStorage.removeItem(k));
                        window.dispatchEvent(new Event('edon-auth-updated'));
                        window.location.replace('/');
                      }}
                    >
                      <LogOut className="w-4 h-4" /><span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Mobile hamburger */}
              <button
                className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Open navigation"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/10 bg-background/95 overflow-hidden"
            >
              <nav className="container mx-auto px-6 py-3 flex flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
