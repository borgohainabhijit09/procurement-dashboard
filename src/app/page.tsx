'use client';

import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Truck, CheckCircle, Activity, X, Pencil, Trash2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronRight, ChevronDown, Plus, Wallet, TrendingDown, TrendingUp, Percent, Inbox, Search, Columns3, ArrowRight, Printer, AlertTriangle, Keyboard } from 'lucide-react';
import { utils, write } from 'xlsx';
import { useToast } from '@/components/Toast';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

type OrderSlot = {
  id: string;
  assetOrderId: string;
  slotNumber: number;
  orderedQty: number;
  orderDate: string | null;
  eta: string | null;
  status: string | null;
  pricePerUnit: string | null;
  lastUpdatedBy: string | null;
  lastUpdatedOn: string;
};

type AssetOrder = {
  id: string;
  bundle: number | null;
  region: string;
  country: string;
  model: string;
  quantity: number;
  inProgress: number;
  ordered: number;
  inTransit: number;
  delivered: number;
  toBeOrdered: number;
  status: string | null;
  halfYearPeriod: string | null;
  lastUpdatedBy: string | null;
  lastUpdatedOn: string;
  slots: OrderSlot[];
  earliestEta: string | null;
  slotCount: number;
};

type SortKey = keyof AssetOrder | 'pending' | 'earliestEta';

const COLORS = ['#0B5ED7', '#00A3E0', '#00B050', '#F59E0B', '#7B2D8E', '#003399'];
const STATUS_OPTIONS = ['Pending', 'In Progress', 'Ordered', 'Partially Delivered', 'Completed'];
const SLOT_STATUS_OPTIONS = ['Pending', 'Ordered', 'In Transit', 'Delivered'];
const PERIOD_OPTIONS = ['H1-2025', 'H2-2025', 'H1-2026', 'H2-2026', 'H1-2027', 'H2-2027'];

const STATUS_TRANSITIONS: Record<string, string> = {
  'Pending': 'In Progress',
  'In Progress': 'Ordered',
  'Ordered': 'Partially Delivered',
  'Partially Delivered': 'Completed',
};

const ALL_COLUMNS: { key: SortKey; label: string; align: string }[] = [
  { key: 'region', label: 'Region', align: '' },
  { key: 'country', label: 'Country', align: '' },
  { key: 'model', label: 'Model', align: '' },
  { key: 'quantity', label: 'Qty', align: 'text-right' },
  { key: 'ordered', label: 'Ordered', align: 'text-right' },
  { key: 'inTransit', label: 'In Transit', align: 'text-right' },
  { key: 'earliestEta', label: 'ETA', align: '' },
  { key: 'pending', label: 'Pending', align: 'text-right' },
  { key: 'delivered', label: 'Delivered', align: 'text-right' },
  { key: 'status', label: 'Status', align: '' },
];

type BudgetSummaryItem = {
  country: string;
  approved: number;
  spent: number;
  carryover: number;
  totalAvailable: number;
  remaining: number;
  utilization: number;
};

type BudgetSummaryResponse = {
  period: string;
  previousPeriod: string | null;
  summary: BudgetSummaryItem[];
  totals: { approved: number; spent: number; carryover: number; totalAvailable: number; remaining: number; utilization: number };
  availablePeriods: string[];
};

export default function Home() {
  const [allData, setAllData] = useState<AssetOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('H2-2026');
  const [tab, setTab] = useState<'dashboard' | 'orders'>('dashboard');
  const [editingOrder, setEditingOrder] = useState<AssetOrder | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('region');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [slotModal, setSlotModal] = useState<{ order: AssetOrder; slot?: OrderSlot } | null>(null);
  const [slotForm, setSlotForm] = useState({ orderedQty: 0, orderDate: '', eta: '', status: 'Pending', pricePerUnit: '' });
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const { toast } = useToast();

  // Feature 1: Search
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Feature 2: Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(ALL_COLUMNS.map(c => c.key)));
  const [showColDropdown, setShowColDropdown] = useState(false);
  const colDropdownRef = useRef<HTMLDivElement>(null);

  // Feature 5: Keyboard shortcuts
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = (period?: string) => {
    const p = period || periodFilter;
    fetch(`/api/orders?period=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/budgets/summary?period=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(data => { if (data && data.totals) setBudgetSummary(data); })
      .catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const orders = useMemo(() => {
    const sq = searchQuery.toLowerCase().trim();
    const filtered = allData.filter(o => {
      if (regionFilter && o.region !== regionFilter) return false;
      if (countryFilter && o.country !== countryFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (sq && !o.model.toLowerCase().includes(sq) && !o.country.toLowerCase().includes(sq) && !o.region.toLowerCase().includes(sq) && !o.id.toLowerCase().includes(sq) && !String(o.bundle).includes(sq)) return false;
      return true;
    });
    const getVal = (o: AssetOrder) => {
      if (sortKey === 'pending') return Math.max(0, Number(o.quantity) - Number(o.ordered));
      if (sortKey === 'earliestEta') return o.earliestEta || 'zzz';
      return o[sortKey];
    };
    return [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      const aStr = String(av ?? '');
      const bStr = String(bv ?? '');
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [allData, regionFilter, countryFilter, statusFilter, searchQuery, sortKey, sortDir]);

  // Feature 3: Advance status
  const advanceOrderStatus = async (order: AssetOrder) => {
    const nextStatus = STATUS_TRANSITIONS[order.status || 'Pending'];
    if (!nextStatus) return;
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAllData(prev => prev.map(o => o.id === updated.id ? { ...updated, slots: o.slots } : o));
        toast(`Status moved to ${nextStatus}`);
      } else toast('Failed to update status', 'error');
    } catch {
      toast('Failed to update status', 'error');
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} className="text-gray-300 ml-0.5" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-[#0B5ED7] ml-0.5" /> : <ArrowDown size={11} className="text-[#0B5ED7] ml-0.5" />;
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      if (next.size === 0) return prev;
      return next;
    });
  };

  // Feature 5: Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setTab('orders');
        return;
      }

      if (e.key === 'Escape') {
        setShowColDropdown(false);
        setShowShortcutsHelp(false);
        setEditingOrder(null);
        setSlotModal(null);
        return;
      }

      if (isInput) return;

      if (e.key === 'e' && tab === 'orders') {
        e.preventDefault();
        exportToExcel();
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }

      if (tab === 'orders') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedRowIndex(prev => Math.min(prev + 1, orders.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedRowIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && focusedRowIndex >= 0 && focusedRowIndex < orders.length) {
          e.preventDefault();
          toggleRow(orders[focusedRowIndex].id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, orders, focusedRowIndex]);

  // Close column dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) setShowColDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset focused row when data changes
  useEffect(() => { setFocusedRowIndex(-1); }, [orders]);

  // Feature 6: Print budget summary
  const printBudgetSummary = () => {
    window.print();
  };

  const exportToExcel = () => {
    const data = orders.map(o => ({
      Region: o.region, Country: o.country, Model: o.model,
      Qty: o.quantity, Ordered: o.ordered, 'In Transit': o.inTransit,
      'Pending Qty': Math.max(0, Number(o.quantity) - Number(o.ordered)),
      Delivered: o.delivered, ETA: o.earliestEta ? new Date(o.earliestEta).toLocaleDateString() : '',
      Status: o.status || '', Period: o.halfYearPeriod || '',
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Orders');
    const colWidths = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length, ...data.map(r => String((r as Record<string, unknown>)[k] ?? '').length)) + 2 }));
    ws['!cols'] = colWidths;
    const buf = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `asset-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  };

  const regions = useMemo(() => Array.from(new Set(allData.map(o => o.region))).sort(), [allData]);
  const countries = useMemo(() => {
    const filtered = regionFilter ? allData.filter(o => o.region === regionFilter) : allData;
    return Array.from(new Set(filtered.map(o => o.country))).sort();
  }, [allData, regionFilter]);
  const statuses = useMemo(() => Array.from(new Set(allData.map(o => o.status || 'Unknown'))).sort(), [allData]);

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    if (value) {
      const validCountries = Array.from(new Set(
        allData.filter(o => o.region === value).map(o => o.country)
      ));
      if (countryFilter && !validCountries.includes(countryFilter)) setCountryFilter('');
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    setLoading(true);
    fetchData(value);
  };

  const kpis = useMemo(() => ({
    totalOrdered: orders.reduce((sum, o) => sum + Number(o.ordered), 0),
    totalDelivered: orders.reduce((sum, o) => sum + Number(o.delivered), 0),
    totalInProgress: orders.reduce((sum, o) => sum + Number(o.inProgress), 0),
    totalInTransit: orders.reduce((sum, o) => sum + Number(o.inTransit), 0),
  }), [orders]);

  const regionChartData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => map.set(o.region, (map.get(o.region) || 0) + Number(o.ordered)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const statusChartData = useMemo(() => {
    const totalOrdered = orders.reduce((s, o) => s + Number(o.ordered), 0);
    const totalInTransit = orders.reduce((s, o) => s + Number(o.inTransit), 0);
    const totalDelivered = orders.reduce((s, o) => s + Number(o.delivered), 0);
    return [
      { name: 'Ordered', value: totalOrdered },
      { name: 'In Transit', value: totalInTransit },
      { name: 'Delivered', value: totalDelivered },
    ].filter(d => d.value > 0);
  }, [orders]);

  const filteredBudgetSummary = useMemo(() => {
    if (!budgetSummary) return null;
    const activeCountries = new Set(orders.map(o => o.country));
    const hasFilter = !!(regionFilter || countryFilter);
    const filtered = hasFilter
      ? budgetSummary.summary.filter(s => activeCountries.has(s.country))
      : budgetSummary.summary;
    const totals = filtered.reduce(
      (acc, s) => ({
        approved: acc.approved + s.approved,
        spent: acc.spent + s.spent,
        carryover: acc.carryover + s.carryover,
        totalAvailable: acc.totalAvailable + s.totalAvailable,
        remaining: acc.remaining + s.remaining,
      }),
      { approved: 0, spent: 0, carryover: 0, totalAvailable: 0, remaining: 0 }
    );
    const utilization = totals.totalAvailable > 0
      ? Math.round((totals.spent / totals.totalAvailable) * 1000) / 10
      : 0;
    return { ...budgetSummary, summary: filtered, totals: { ...totals, utilization } };
  }, [budgetSummary, regionFilter, countryFilter, orders]);

  const deleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) { setAllData(prev => prev.filter(o => o.id !== id)); toast('Order deleted'); }
      else toast('Failed to delete order', 'error');
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast('Failed to delete order', 'error');
    }
  };

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOrder)
      });
      if (res.ok) {
        const updated = await res.json();
        setAllData(prev => prev.map(o => o.id === updated.id ? { ...updated, slots: o.slots } : o));
        setEditingOrder(null);
        toast('Order updated');
      } else toast('Failed to update order', 'error');
    } catch (error) {
      console.error('Failed to update order:', error);
      toast('Failed to update order', 'error');
    }
  };

  const saveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotModal) return;
    const { order, slot } = slotModal;
    const url = slot ? `/api/slots/${slot.id}` : `/api/orders/${order.id}/slots`;
    const method = slot ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slotForm,
          orderedQty: Number(slotForm.orderedQty),
          orderDate: slotForm.orderDate || null,
          eta: slotForm.eta || null,
          pricePerUnit: slotForm.pricePerUnit ? Number(slotForm.pricePerUnit) : null,
        })
      });
      if (res.ok) {
        setSlotModal(null);
        fetchData();
        toast(slot ? 'Slot updated' : 'Slot added');
      } else toast('Failed to save slot', 'error');
    } catch (error) {
      console.error('Failed to save slot:', error);
      toast('Failed to save slot', 'error');
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!confirm('Delete this slot?')) return;
    try {
      const res = await fetch(`/api/slots/${slotId}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); toast('Slot deleted'); }
      else toast('Failed to delete slot', 'error');
    } catch (error) {
      console.error('Failed to delete slot:', error);
      toast('Failed to delete slot', 'error');
    }
  };

  const openAddSlot = (order: AssetOrder) => {
    setSlotForm({ orderedQty: 0, orderDate: '', eta: '', status: 'Pending', pricePerUnit: '' });
    setSlotModal({ order });
  };

  const openEditSlot = (order: AssetOrder, slot: OrderSlot) => {
    setSlotForm({
      orderedQty: slot.orderedQty,
      orderDate: slot.orderDate ? slot.orderDate.slice(0, 10) : '',
      eta: slot.eta ? slot.eta.slice(0, 10) : '',
      status: slot.status || 'Pending',
      pricePerUnit: slot.pricePerUnit || '',
    });
    setSlotModal({ order, slot });
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';

  const alertCountries = useMemo(() => {
    if (!filteredBudgetSummary) return [];
    return filteredBudgetSummary.summary.filter(s => s.totalAvailable > 0 && (s.spent / s.totalAvailable) >= 0.8);
  }, [filteredBudgetSummary]);

  return (
    <div className="min-h-screen text-slate-900 font-sans">
      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4 pt-14 lg:pt-4">

        {/* Filter Bar */}
        <div className="bg-[#003399] rounded-lg shadow-sm px-5 py-3 no-print">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Asset Ordering</h1>
              <p className="text-[11px] text-blue-200 hidden sm:block">Region & country-wise tracking</p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Region</label>
                <select value={regionFilter} onChange={e => handleRegionChange(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  <option value="" className="text-gray-900">All Regions</option>
                  {regions.map(r => <option key={r} value={r} className="text-gray-900">{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Country</label>
                <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]" disabled={!regionFilter && countries.length > 20}>
                  <option value="" className="text-gray-900">All Countries</option>
                  {countries.map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  <option value="" className="text-gray-900">All Statuses</option>
                  {statuses.map(s => <option key={s} value={s} className="text-gray-900">{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Period</label>
                <select value={periodFilter} onChange={e => handlePeriodChange(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  {PERIOD_OPTIONS.map(p => <option key={p} value={p} className="text-gray-900">{p}</option>)}
                </select>
              </div>
              <button onClick={() => { setRegionFilter(''); setCountryFilter(''); setStatusFilter(''); setSearchQuery(''); }} className="px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5">
                <RotateCcw size={13} /> Clear
              </button>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1 no-print">
          {([
            { key: 'dashboard' as const, label: 'Dashboard' },
            { key: 'orders' as const, label: 'Orders' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-[#0B5ED7] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* === Dashboard Tab === */}
        {tab === 'dashboard' && (<>

        {/* Budget Alerts Banner */}
        {alertCountries.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3 no-print">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Budget Alert — {alertCountries.length} {alertCountries.length === 1 ? 'country' : 'countries'} above 80% utilization</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {alertCountries.map(c => `${c.country} (${Math.round((c.spent / c.totalAvailable) * 100)}%)`).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        {loading && allData.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Ordered', value: kpis.totalOrdered, icon: Package, bg: 'bg-blue-50', fg: 'text-[#0B5ED7]' },
              { label: 'Delivered', value: kpis.totalDelivered, icon: CheckCircle, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
              { label: 'In Transit', value: kpis.totalInTransit, icon: Truck, bg: 'bg-amber-50', fg: 'text-amber-600' },
              { label: 'In Progress', value: kpis.totalInProgress, icon: Activity, bg: 'bg-purple-50', fg: 'text-purple-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
                <div className={`p-2 rounded-md ${kpi.bg} ${kpi.fg}`}><kpi.icon size={18} /></div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-lg font-bold text-gray-900">{kpi.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Budget KPIs */}
        {filteredBudgetSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Approved Budget', value: `\u20AC${filteredBudgetSummary.totals.approved.toLocaleString()}`, icon: Wallet, bg: 'bg-blue-50', fg: 'text-[#0B5ED7]' },
              { label: 'Total Spent', value: `\u20AC${filteredBudgetSummary.totals.spent.toLocaleString()}`, icon: TrendingDown, bg: 'bg-red-50', fg: 'text-red-600' },
              { label: 'Carryover Savings', value: `\u20AC${filteredBudgetSummary.totals.carryover.toLocaleString()}`, icon: TrendingUp, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
              { label: 'Budget Utilization', value: `${filteredBudgetSummary.totals.utilization}%`, icon: Percent, bg: 'bg-amber-50', fg: 'text-amber-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
                <div className={`p-2 rounded-md ${kpi.bg} ${kpi.fg}`}><kpi.icon size={18} /></div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Orders by Region</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Bar dataKey="value" fill="#0B5ED7" radius={[3, 3, 0, 0]} onClick={(data) => setRegionFilter(String(data?.name || ''))} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1">Click a bar to filter by region</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Order Pipeline</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Budget vs Actual */}
        {filteredBudgetSummary && filteredBudgetSummary.summary.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" id="budget-summary">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Budget Overview — {filteredBudgetSummary.period}</h3>
                {filteredBudgetSummary.totals.carryover > 0 && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    +\u20AC{filteredBudgetSummary.totals.carryover.toLocaleString()} savings carried over from {filteredBudgetSummary.previousPeriod}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase">Total Utilization</p>
                  <p className="text-lg font-bold text-gray-900">{filteredBudgetSummary.totals.utilization}%</p>
                </div>
                <button onClick={printBudgetSummary} className="no-print px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1.5" title="Print budget summary">
                  <Printer size={13} /> Print
                </button>
              </div>
            </div>

            {/* Print header - only visible when printing */}
            <div className="print-only mb-4 border-b border-gray-300 pb-3">
              <h2 className="text-lg font-bold text-[#003399]">Philips DEX — Half-Year Budget Summary</h2>
              <p className="text-sm text-gray-600">Period: {filteredBudgetSummary.period} | Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            {/* Country cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBudgetSummary.summary.map(item => {
                const pct = item.totalAvailable > 0 ? Math.round((item.spent / item.totalAvailable) * 100) : 0;
                const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-[#0B5ED7]';
                const isAlert = pct >= 80;
                return (
                  <div key={item.country} className={`border rounded-lg p-3 space-y-2 transition-colors print-budget-card ${
                    isAlert ? 'border-red-300 bg-red-50/50 shadow-sm shadow-red-100' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-700">{item.country}</span>
                      <div className="flex items-center gap-1.5">
                        {isAlert && <AlertTriangle size={11} className="text-red-500" />}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          pct > 90 ? 'bg-red-50 text-red-700' : pct > 70 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-[#0B5ED7]'
                        }`}>{pct}%</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>

                    {/* Amounts */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Budget</span>
                        <span className="font-medium text-gray-600">\u20AC{item.approved.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Spent</span>
                        <span className="font-medium text-amber-600">\u20AC{item.spent.toLocaleString()}</span>
                      </div>
                      {item.carryover > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Carryover</span>
                            <span className="font-medium text-emerald-600">+\u20AC{item.carryover.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Available</span>
                            <span className="font-medium text-gray-700">\u20AC{item.totalAvailable.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-400">Remaining</span>
                        <span className={`font-semibold ${item.remaining > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          \u20AC{item.remaining.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </>)}

        {/* === Orders Tab === */}
        {tab === 'orders' && (<>
        <div className="flex justify-between items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search model, country, ID... (Ctrl+K)"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none bg-white shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Column visibility dropdown */}
            <div className="relative" ref={colDropdownRef}>
              <button onClick={() => setShowColDropdown(!showColDropdown)} className="px-2.5 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-md shadow-sm transition-colors flex items-center gap-1.5" title="Toggle columns">
                <Columns3 size={13} /> Columns
              </button>
              {showColDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 p-2 min-w-[180px]">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold px-2 py-1">Visible Columns</p>
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-gray-300 text-[#0B5ED7] focus:ring-[#0B5ED7]"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Shortcuts hint */}
            <button onClick={() => setShowShortcutsHelp(!showShortcutsHelp)} className="no-print px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors" title="Keyboard shortcuts">
              <Keyboard size={14} />
            </button>

            <button onClick={exportToExcel} disabled={orders.length === 0} className="px-3 py-1.5 text-sm bg-[#00B050] hover:bg-[#00913F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md shadow-sm transition-colors flex items-center gap-1.5">
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts help panel */}
        {showShortcutsHelp && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 no-print">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Keyboard Shortcuts</h4>
              <button onClick={() => setShowShortcutsHelp(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { keys: 'Ctrl+K', desc: 'Focus search' },
                { keys: 'E', desc: 'Export Excel' },
                { keys: '↑ ↓', desc: 'Navigate rows' },
                { keys: 'Enter', desc: 'Expand/collapse row' },
                { keys: '?', desc: 'Toggle this help' },
                { keys: 'Esc', desc: 'Close modals' },
              ].map(s => (
                <div key={s.keys} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-600 shadow-sm">{s.keys}</kbd>
                  <span className="text-gray-500">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading && orders.length === 0 ? (
            <div className="p-4 space-y-4">
              <SkeletonTable rows={10} />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No orders found"
              description={regionFilter || countryFilter || statusFilter || searchQuery ? 'Try adjusting your filters or search to see more results.' : 'No asset orders have been created yet.'}
              action={(!regionFilter && !countryFilter && !statusFilter && !searchQuery) ? (
                <p className="text-xs text-gray-400">Orders will appear here once added through the API or seed script.</p>
              ) : (
                <button onClick={() => { setRegionFilter(''); setCountryFilter(''); setStatusFilter(''); setSearchQuery(''); }} className="text-xs text-[#0B5ED7] hover:underline">Clear all filters</button>
              )}
            />
          ) : (
            <div className="overflow-x-auto" ref={tableContainerRef}>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                    <th className="px-2 py-2 border-b border-gray-100 w-6" />
                    {ALL_COLUMNS.filter(col => visibleColumns.has(col.key)).map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} className={`px-3 py-2 font-semibold border-b border-gray-100 cursor-pointer hover:bg-gray-100 select-none transition-colors ${col.align}`}>
                        <span className="inline-flex items-center gap-0.5">{col.label}<SortIcon col={col.key} /></span>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold border-b border-gray-100 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order, idx) => {
                    const pending = Math.max(0, Number(order.quantity) - Number(order.ordered));
                    const isExpanded = expandedRows.has(order.id);
                    const isFocused = idx === focusedRowIndex;
                    const nextStatus = STATUS_TRANSITIONS[order.status || 'Pending'];
                    return (
                      <Fragment key={order.id}>
                        <tr className={`transition-colors ${isFocused ? 'bg-[#E8F0FE]' : 'hover:bg-[#E8F0FE]/40'}`}>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => toggleRow(order.id)} className="text-gray-400 hover:text-[#0B5ED7]">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          {visibleColumns.has('region') && <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{order.region}</td>}
                          {visibleColumns.has('country') && <td className="px-3 py-1.5 text-xs text-gray-600">{order.country}</td>}
                          {visibleColumns.has('model') && <td className="px-3 py-1.5 text-xs text-gray-600">{order.model}</td>}
                          {visibleColumns.has('quantity') && <td className="px-3 py-1.5 text-xs text-right font-medium text-gray-700">{order.quantity.toLocaleString()}</td>}
                          {visibleColumns.has('ordered') && <td className="px-3 py-1.5 text-xs text-right font-semibold text-[#0B5ED7]">{order.ordered.toLocaleString()}</td>}
                          {visibleColumns.has('inTransit') && <td className="px-3 py-1.5 text-xs text-right font-semibold text-amber-600">{order.inTransit.toLocaleString()}</td>}
                          {visibleColumns.has('earliestEta') && <td className="px-3 py-1.5 text-xs text-gray-500">{formatDate(order.earliestEta)}</td>}
                          {visibleColumns.has('pending') && <td className="px-3 py-1.5 text-xs text-right font-semibold text-amber-600">{pending.toLocaleString()}</td>}
                          {visibleColumns.has('delivered') && <td className="px-3 py-1.5 text-xs text-right font-semibold text-emerald-600">{order.delivered.toLocaleString()}</td>}
                          {visibleColumns.has('status') && (
                            <td className="px-3 py-1.5">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full leading-relaxed
                                ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                  order.status === 'In Progress' ? 'bg-[#E0EBFA] text-[#0840A0]' :
                                  order.status === 'Ordered' ? 'bg-purple-100 text-purple-700' :
                                  order.status === 'Partially Delivered' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'}`}>
                                {order.status || 'N/A'}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              {nextStatus && (
                                <button
                                  onClick={() => advanceOrderStatus(order)}
                                  className="p-1.5 text-gray-400 hover:text-[#0B5ED7] hover:bg-[#E8F0FE] rounded transition-colors group relative"
                                  title={`Move to ${nextStatus}`}
                                >
                                  <ArrowRight size={13} />
                                </button>
                              )}
                              <button onClick={() => openAddSlot(order)} className="p-1.5 text-gray-400 hover:text-[#00B050] hover:bg-emerald-50 rounded transition-colors" title="Add Slot">
                                <Plus size={13} />
                              </button>
                              <button onClick={() => setEditingOrder(order)} className="p-1.5 text-gray-400 hover:text-[#0B5ED7] hover:bg-[#E8F0FE] rounded transition-colors" title="Edit">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deleteOrder(order.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={ALL_COLUMNS.filter(col => visibleColumns.has(col.key)).length + 2} className="px-4 py-2 bg-gray-50/50">
                              {order.slots.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No order slots yet. Click + to add one.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400 text-[10px] uppercase">
                                      <th className="py-1 px-2 text-left font-medium">Slot</th>
                                      <th className="py-1 px-2 text-right font-medium">Qty</th>
                                      <th className="py-1 px-2 text-left font-medium">Order Date</th>
                                      <th className="py-1 px-2 text-left font-medium">ETA</th>
                                      <th className="py-1 px-2 text-left font-medium">Status</th>
                                      <th className="py-1 px-2 text-right font-medium">Price/Unit</th>
                                      <th className="py-1 px-2 text-right font-medium">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.slots.map(slot => (
                                      <tr key={slot.id} className="border-t border-gray-100">
                                        <td className="py-1 px-2 font-medium text-gray-700">#{slot.slotNumber}</td>
                                        <td className="py-1 px-2 text-right text-[#0B5ED7] font-semibold">{slot.orderedQty.toLocaleString()}</td>
                                        <td className="py-1 px-2 text-gray-600">{formatDate(slot.orderDate)}</td>
                                        <td className="py-1 px-2 text-gray-600">{formatDate(slot.eta)}</td>
                                        <td className="py-1 px-2">
                                          <span className={`inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded-full
                                            ${slot.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                                              slot.status === 'In Transit' ? 'bg-amber-100 text-amber-700' :
                                              slot.status === 'Ordered' ? 'bg-purple-100 text-purple-700' :
                                              'bg-gray-100 text-gray-600'}`}>
                                            {slot.status || 'Pending'}
                                          </span>
                                        </td>
                                        <td className="py-1 px-2 text-right text-gray-600">{slot.pricePerUnit ? `\u20AC${Number(slot.pricePerUnit).toLocaleString()}` : '--'}</td>
                                        <td className="py-1 px-2 text-right">
                                          <button onClick={() => openEditSlot(order, slot)} className="text-gray-400 hover:text-[#0B5ED7] mr-1"><Pencil size={11} /></button>
                                          <button onClick={() => deleteSlot(slot.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={11} /></button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={ALL_COLUMNS.filter(col => visibleColumns.has(col.key)).length + 2} className="p-10 text-center text-gray-400 text-sm">
                        <div className="flex flex-col items-center">
                          <Inbox size={24} className="mb-2 text-gray-300" />
                          <p>No orders match the current filters.</p>
                          <button onClick={() => { setRegionFilter(''); setCountryFilter(''); setStatusFilter(''); setSearchQuery(''); }} className="text-xs text-[#0B5ED7] hover:underline mt-1">Clear filters</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 bg-[#003399]">
              <h3 className="text-sm font-bold text-white">Edit Order: <span className="font-mono text-blue-200">{editingOrder.id}</span></h3>
              <button onClick={() => setEditingOrder(null)} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
            </div>
            <form onSubmit={saveOrder} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Region</label>
                  <input type="text" value={editingOrder.region} onChange={e => setEditingOrder({ ...editingOrder, region: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Country</label>
                  <input type="text" value={editingOrder.country} onChange={e => setEditingOrder({ ...editingOrder, country: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Model</label>
                  <input type="text" value={editingOrder.model} onChange={e => setEditingOrder({ ...editingOrder, model: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Status</label>
                  <select value={editingOrder.status || ''} onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value || null })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none bg-white">
                    <option value="">None</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Total Qty</label>
                  <input type="number" value={editingOrder.quantity} onChange={e => setEditingOrder({ ...editingOrder, quantity: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Period</label>
                  <input type="text" value={editingOrder.halfYearPeriod || ''} onChange={e => setEditingOrder({ ...editingOrder, halfYearPeriod: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" placeholder="H2-2026" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-md p-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[10px] text-gray-400 uppercase">Ordered</p><p className="text-sm font-bold text-[#0B5ED7]">{editingOrder.ordered.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase">In Transit</p><p className="text-sm font-bold text-amber-600">{editingOrder.inTransit.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase">Delivered</p><p className="text-sm font-bold text-emerald-600">{editingOrder.delivered.toLocaleString()}</p></div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-[#0B5ED7] hover:bg-[#0840A0] text-white rounded-md shadow-sm transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slot Modal */}
      {slotModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 bg-[#003399]">
              <h3 className="text-sm font-bold text-white">
                {slotModal.slot ? 'Edit Slot' : 'Add Slot'} — <span className="font-mono text-blue-200">{slotModal.order.id}</span>
              </h3>
              <button onClick={() => setSlotModal(null)} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
            </div>
            <form onSubmit={saveSlot} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Ordered Qty</label>
                  <input type="number" value={slotForm.orderedQty} onChange={e => setSlotForm({ ...slotForm, orderedQty: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Status</label>
                  <select value={slotForm.status} onChange={e => setSlotForm({ ...slotForm, status: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none bg-white">
                    {SLOT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Order Date</label>
                  <input type="date" value={slotForm.orderDate} onChange={e => setSlotForm({ ...slotForm, orderDate: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">ETA</label>
                  <input type="date" value={slotForm.eta} onChange={e => setSlotForm({ ...slotForm, eta: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Price per Unit (optional)</label>
                  <input type="number" step="0.01" value={slotForm.pricePerUnit} onChange={e => setSlotForm({ ...slotForm, pricePerUnit: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" placeholder="0.00" />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setSlotModal(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-[#0B5ED7] hover:bg-[#0840A0] text-white rounded-md shadow-sm transition-colors">{slotModal.slot ? 'Update Slot' : 'Add Slot'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
