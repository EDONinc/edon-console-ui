import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Gauge, ListChecks, FileSearch, Settings2, KeyRound, LogOut, User, CreditCard, Users, Key, ChevronDown, Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
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

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(true);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('edon_user_email') || '');
  const [userPlan, setUserPlan] = useState(() => localStorage.getItem('edon_plan') || 'Starter');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('edon_display_name') || '');
  const _hasAnyToken = () =>
    Boolean(
      localStorage.getItem('edon_token') ||
      localStorage.getItem('edon_api_key') ||
      localStorage.getItem('edon_session_token') ||
      (import.meta.env.MODE !== 'production' && import.meta.env.VITE_EDON_API_TOKEN)
    );
  const [hasToken, setHasToken] = useState(() => typeof window !== 'undefined' && _hasAnyToken());

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await edonApi.getHealth();
        setIsConnected(true);
        
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    
    // Listen for storage changes (when mock mode is toggled in Settings)
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
    }, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('edon-auth-updated', handleStorageChange as EventListener);
    };
  }, []);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-background/70"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* EDON wordmark */}
            <NavLink to="/" className="flex items-center shrink-0">
              <span className="edon-brand text-lg font-semibold tracking-[0.3em] text-foreground/90">
                EDON
              </span>
            </NavLink>

            {/* Navigation */}
            <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`nav-item flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                      isActive ? 'nav-item-active' : ''
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
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

            {/* Right side: status + user menu */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Live/Offline badge */}
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

              {hasToken && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 hover:bg-white/10 transition-colors">
                      {/* Avatar */}
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
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/team')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>Team</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/api-keys')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span>API Keys</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/billing')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span>Billing</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 cursor-pointer hover:bg-white/5">
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                      <span>Settings</span>
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
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </motion.header>
    </>
  );
}
