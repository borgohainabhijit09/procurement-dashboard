'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, RefreshCw, TrendingUp, Briefcase, DollarSign, ChevronLeft, ChevronRight, Menu, X, Lock, Tag, Wallet } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Asset Ordering', icon: Package, href: '/' },
  { label: 'Price Config', icon: Tag, href: '/price-configuration' },
  { label: 'Budget Mgmt', icon: Wallet, href: '/budget-management' },
  { label: 'PC Refresh', icon: RefreshCw, href: '/intelligent-pc-refresh', comingSoon: true },
  { label: 'Procurement Forecast', icon: TrendingUp, href: '/procurement-forecast', comingSoon: true },
  { label: 'Business IT', icon: Briefcase, href: '/business-it', comingSoon: true },
  { label: 'Financial Analysis', icon: DollarSign, href: '/financial-analysis', comingSoon: true },
];

function getInitialCollapsed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('sidebar-collapsed') === 'true';
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setMobileOpen(false);
      prevPathname.current = pathname;
    }
  }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`px-4 py-4 border-b border-white/10 ${collapsed ? 'px-2' : ''}`}>
        <Link href="/" className={`flex flex-col items-center gap-1 ${collapsed ? '' : 'items-start'}`}>
          <img src="/logo.png" alt="Philips" className={`w-auto transition-all ${collapsed ? 'h-6' : 'h-7'}`} />
          {!collapsed && (
            <>
              <h2 className="text-sm font-bold text-white leading-tight">DEX Portal</h2>
              <p className="text-[9px] text-blue-300">Digital Experience</p>
            </>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all group relative ${
                active
                  ? 'bg-[#0B5ED7] text-white shadow-md'
                  : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <item.icon size={18} className={active ? 'text-white' : 'text-blue-200/60 group-hover:text-white'} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.comingSoon && (
                    <span className="text-[9px] bg-white/10 text-blue-200/60 px-1.5 py-0.5 rounded-full">Soon</span>
                  )}
                </>
              )}
              {collapsed && item.comingSoon && (
                <Lock size={8} className="absolute top-1 right-1 text-blue-300/40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[9px] text-blue-300/40 text-center">Philips DEX &middot; v1.0</p>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={toggleCollapse}
        className="hidden lg:flex items-center justify-center py-3 border-t border-white/10 text-blue-200/40 hover:text-white hover:bg-white/5 transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-[#003399] text-white rounded-lg shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-60 bg-[#003399] z-50 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 text-white/60 hover:text-white"
        >
          <X size={18} />
        </button>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:block fixed top-0 left-0 h-full bg-[#003399] z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        {sidebarContent}
      </aside>
    </>
  );
}
