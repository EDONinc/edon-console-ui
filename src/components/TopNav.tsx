import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Gauge, ListChecks, FileSearch, Settings2, KeyRound, CreditCard, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { edonApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/decisions', label: 'Decisions', icon: ListChecks },
  { to: '/audit', label: 'Audit', icon: FileSearch },
  { to: '/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/pricing', label: 'Pricing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

export function TopNav() {
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(true);
  const [hasToken, setHasToken] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('edon_token'));

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
      setHasToken(typeof window !== 'undefined' && !!localStorage.getItem('edon_token'));
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('edon-auth-updated', handleStorageChange as EventListener);

    const interval = setInterval(() => {
      checkConnection();
      setHasToken(typeof window !== 'undefined' && !!localStorage.getItem('edon_token'));
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

            {/* Status Badges */}
            <div className="flex items-center gap-2">
              {hasToken && (
                <>
                  <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 flex items-center gap-1.5 text-xs">
                    <KeyRound className="w-3 h-3" />
                    <span className="hidden sm:inline">Signed in</span>
                  </Badge>
                  <button
                    title="Sign out"
                    onClick={() => {
                      localStorage.removeItem('edon_token');
                      localStorage.removeItem('edon_api_key');
                      localStorage.removeItem('edon_session_token');
                      localStorage.removeItem('edon_user_email');
                      localStorage.removeItem('edon_plan');
                      window.location.replace('/');
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <Badge
                variant="outline"
                className={`flex items-center gap-1.5 text-xs ${
                  isConnected
                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                    : 'border-red-500/40 text-red-400 bg-red-500/10'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
              </Badge>
            </div>
          </div>
        </div>
      </motion.header>
    </>
  );
}
