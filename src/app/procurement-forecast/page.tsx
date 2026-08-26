'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, UserPlus, UserMinus, Wrench, Package, RotateCcw, Download, Search, X, Pencil, Trash2, Upload, AlertTriangle, Inbox, TrendingUp } from 'lucide-react';
import { utils, write, read } from 'xlsx';
import { useToast } from '@/components/Toast';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

const COLORS = ['#0B5ED7', '#00A3E0', '#00B050', '#F59E0B', '#7B2D8E', '#003399', '#E74C3C', '#8E44AD'];

type Joiner = {
  id: string;
  candidatename: string;
  country: string;
  city: string | null;
  function: string | null;
  devicecategory: string;
  model: string | null;
  startdate: string | null;
  status: string;
  hiringmanager: string | null;
  businessunit: string | null;
  department: string | null;
  createdat: string;
  updatedat: string;
};

type Leaver = {
  id: string;
  employeename: string;
  country: string;
  city: string | null;
  function: string | null;
  devicecategory: string;
  model: string | null;
  lastworkingday: string | null;
  status: string;
  createdat: string;
};

type Stock = {
  id: string;
  country: string;
  devicecategory: string;
  model: string | null;
  quantity: number;
  lastupdated: string | null;
};

type ForecastRow = {
  month: string;
  country: string;
  deviceCategory: string;
  joiners: number;
  leavers: number;
  breakfixRunRate: number;
  demand: number;
  netDemand: number;
  currentStock: number;
  procurementNeed: number;
};

type ForecastResponse = {
  forecastMonths: string[];
  forecast: ForecastRow[];
  summary: { totalJoiners: number; totalLeavers: number; totalBreakfixRunRate: number; totalDemand: number; currentStock: number; totalToProcure: number };
  byCategory: { category: string; joiners: number; leavers: number; breakfix: number; demand: number; stock: number; toProcure: number }[];
  byCountry: { country: string; joiners: number; leavers: number; breakfix: number; demand: number; stock: number; toProcure: number }[];
};

type SortKey = 'candidatename' | 'country' | 'devicecategory' | 'startdate' | 'status' | 'businessunit';

export default function ProcurementForecastPage() {
  // Data
  const [joiners, setJoiners] = useState<Joiner[]>([]);
  const [leavers, setLeavers] = useState<Leaver[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [countryFilter, setCountryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'records'>('dashboard');

  // Table state
  const [sortKey, setSortKey] = useState<SortKey>('country');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [subTab, setSubTab] = useState<'joiners' | 'leavers' | 'stock'>('joiners');
  const PAGE_SIZE = 20;

  // Upload
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit modal
  const [editingJoiner, setEditingJoiner] = useState<Joiner | null>(null);
  const [form, setForm] = useState({ candidatename: '', country: '', city: '', function: '', devicecategory: '', model: '', startdate: '', status: 'Pending', hiringmanager: '', businessunit: '', department: '' });

  const { toast } = useToast();

  // ── Fetch ────────────────────────────────────────────
  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (countryFilter) params.set('country', countryFilter);
    if (categoryFilter) params.set('deviceCategory', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);

    Promise.all([
      fetch(`/api/joiners?${params}`).then(r => r.json()),
      fetch(`/api/leavers?${params}`).then(r => r.json()),
      fetch(`/api/stock`).then(r => r.json()),
      fetch(`/api/forecast?${params}`).then(r => r.json()),
    ]).then(([j, l, s, f]) => {
      if (Array.isArray(j)) setJoiners(j);
      if (Array.isArray(l)) setLeavers(l);
      if (Array.isArray(s)) setStock(s);
      if (f && f.forecast) setForecast(f);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const applyFilters = () => { setPage(1); fetchData(); };

  // ── Derived ──────────────────────────────────────────
  const countries = useMemo(() => Array.from(new Set([...joiners.map(j => j.country), ...leavers.map(l => l.country), ...stock.map(s => s.country)])).sort(), [joiners, leavers, stock]);
  const categories = useMemo(() => Array.from(new Set([...joiners.map(j => j.devicecategory), ...leavers.map(l => l.devicecategory), ...stock.map(s => s.devicecategory)])).sort(), [joiners, leavers, stock]);
  const statuses = useMemo(() => Array.from(new Set(joiners.map(j => j.status))).sort(), [joiners]);

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startingThisMonth = joiners.filter(j => j.startdate?.startsWith(thisMonth) && j.status !== 'Cancelled').length;
    const pendingEquipment = joiners.filter(j => j.status === 'Pending').length;
    const onboarded = joiners.filter(j => j.status === 'Onboarded' || j.status === 'Completed').length;
    return {
      totalJoiners: joiners.length,
      startingThisMonth,
      pendingEquipment,
      onboarded,
      totalLeavers: leavers.length,
      totalStock: stock.reduce((s, st) => s + Number(st.quantity), 0),
    };
  }, [joiners, leavers, stock]);

  // Charts
  const joinersByCountry = useMemo(() => {
    const map = new Map<string, number>();
    joiners.filter(j => j.status !== 'Cancelled').forEach(j => map.set(j.country, (map.get(j.country) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [joiners]);

  const joinersByCategory = useMemo(() => {
    const map = new Map<string, number>();
    joiners.filter(j => j.status !== 'Cancelled').forEach(j => map.set(j.devicecategory, (map.get(j.devicecategory) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [joiners]);

  const statusChartData = useMemo(() => {
    const map = new Map<string, number>();
    joiners.forEach(j => map.set(j.status || 'Pending', (map.get(j.status || 'Pending') || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [joiners]);

  // ── Table ────────────────────────────────────────────
  const tableData = useMemo(() => {
    const sq = searchQuery.toLowerCase().trim();
    const src = subTab === 'joiners' ? joiners : subTab === 'leavers' ? leavers.map(l => ({ ...l, candidatename: l.employeename, devicecategory: l.devicecategory, startdate: l.lastworkingday, status: l.status })) : stock.map(s => ({ id: s.id, candidatename: `${s.country} — ${s.devicecategory}`, country: s.country, devicecategory: s.devicecategory, model: s.model, startdate: s.lastupdated, status: `${s.quantity} in stock`, businessunit: '', city: null, function: null, hiringmanager: null, department: null, createdat: '', updatedat: '' }));

    const filtered = (src as Joiner[]).filter(r => {
      if (countryFilter && r.country !== countryFilter) return false;
      if (categoryFilter && r.devicecategory !== categoryFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (sq && !r.candidatename?.toLowerCase().includes(sq) && !r.country?.toLowerCase().includes(sq) && !r.devicecategory?.toLowerCase().includes(sq)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? '');
      const bv = String((b as Record<string, unknown>)[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [joiners, leavers, stock, subTab, countryFilter, categoryFilter, statusFilter, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableData.length / PAGE_SIZE));
  const pagedData = tableData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Excel Upload ─────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

      const mapped = rows.map(r => ({
        candidateName: (r['Candidate Name'] || r['candidateName'] || r['Name'] || r['name'] || '') as string,
        country: (r['Country'] || r['country'] || '') as string,
        city: (r['City'] || r['city'] || '') as string,
        function: (r['Function'] || r['function'] || r['Role'] || r['role'] || '') as string,
        deviceCategory: (r['Device Category'] || r['deviceCategory'] || r['Device'] || r['device'] || r['Equipment'] || r['equipment'] || '') as string,
        model: (r['Model'] || r['model'] || '') as string,
        startDate: (r['Start Date'] || r['startDate'] || r['Join Date'] || r['joinDate'] || '') as string,
        status: (r['Status'] || r['status'] || 'Pending') as string,
        hiringManager: (r['Hiring Manager'] || r['hiringManager'] || r['Manager'] || r['manager'] || '') as string,
        businessUnit: (r['Business Unit'] || r['businessUnit'] || r['BU'] || r['bu'] || '') as string,
        department: (r['Department'] || r['department'] || '') as string,
      })).filter(r => r.candidateName && r.country && r.deviceCategory);

      if (mapped.length === 0) { toast('No valid rows found. Check column headers.', 'error'); setUploading(false); return; }

      const res = await fetch('/api/joiners/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapped),
      });
      const data2 = await res.json();
      if (res.ok || res.status === 207) {
        toast(`Uploaded ${data2.count || data2.successCount || mapped.length} records`);
        fetchData();
      } else {
        toast(data2.error || 'Upload failed', 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast('Failed to parse file', 'error');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Export ───────────────────────────────────────────
  const exportToExcel = () => {
    const data = tableData.map(r => ({
      Name: r.candidatename, Country: r.country, City: r.city || '',
      Function: r.function || '', 'Device Category': r.devicecategory, Model: r.model || '',
      'Start Date': r.startdate ? new Date(r.startdate).toLocaleDateString() : '',
      Status: r.status, 'Hiring Manager': r.hiringmanager || '',
      'Business Unit': r.businessunit || '', Department: r.department || '',
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, subTab);
    const buf = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `procurement-${subTab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── CRUD ─────────────────────────────────────────────
  const openAdd = () => {
    setForm({ candidatename: '', country: '', city: '', function: '', devicecategory: '', model: '', startdate: '', status: 'Pending', hiringmanager: '', businessunit: '', department: '' });
    setEditingJoiner({} as Joiner);
  };

  const openEdit = (j: Joiner) => {
    setForm({
      candidatename: j.candidatename, country: j.country, city: j.city || '',
      function: j.function || '', devicecategory: j.devicecategory, model: j.model || '',
      startdate: j.startdate ? j.startdate.slice(0, 10) : '', status: j.status,
      hiringmanager: j.hiringmanager || '', businessunit: j.businessunit || '', department: j.department || '',
    });
    setEditingJoiner(j);
  };

  const saveJoiner = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingJoiner?.id ? `/api/joiners/${editingJoiner.id}` : '/api/joiners';
    const method = editingJoiner?.id ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startDate: form.startdate || null,
          candidateName: form.candidatename,
          deviceCategory: form.devicecategory,
          hiringManager: form.hiringmanager,
          businessUnit: form.businessunit,
        }),
      });
      if (res.ok) { setEditingJoiner(null); fetchData(); toast(editingJoiner?.id ? 'Updated' : 'Created'); }
      else toast('Failed to save', 'error');
    } catch { toast('Failed to save', 'error'); }
  };

  const deleteJoiner = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    try {
      const res = await fetch(`/api/joiners/${id}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); toast('Deleted'); } else toast('Failed to delete', 'error');
    } catch { toast('Failed to delete', 'error'); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';

  // ── Filter bar ───────────────────────────────────────
  return (
    <div className="min-h-screen text-slate-900 font-sans">
      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4 pt-14 lg:pt-4">

        {/* Header */}
        <div className="bg-[#003399] rounded-lg shadow-sm px-5 py-3">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Procurement Forecast</h1>
              <p className="text-[11px] text-blue-200 hidden sm:block">Joiners, leavers, break-fix &amp; stock prediction</p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Country</label>
                <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  <option value="" className="text-gray-900">All Countries</option>
                  {countries.map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Device Category</label>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  <option value="" className="text-gray-900">All Categories</option>
                  {categories.map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  <option value="" className="text-gray-900">All Statuses</option>
                  {statuses.map(s => <option key={s} value={s} className="text-gray-900">{s}</option>)}
                </select>
              </div>
              <button onClick={() => { setCountryFilter(''); setCategoryFilter(''); setStatusFilter(''); }} className="px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5">
                <RotateCcw size={13} /> Clear
              </button>
              <button onClick={applyFilters} className="px-3 py-1.5 text-sm bg-white text-[#003399] font-semibold rounded-md hover:bg-blue-50 transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          {([
            { key: 'dashboard' as const, label: 'Dashboard' },
            { key: 'records' as const, label: 'Records' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.key ? 'bg-[#0B5ED7] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === 'dashboard' && (<>
          {/* KPIs — Row 1 */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Joiners', value: kpis.totalJoiners, icon: Users, bg: 'bg-blue-50', fg: 'text-[#0B5ED7]' },
                { label: 'Starting This Month', value: kpis.startingThisMonth, icon: UserPlus, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
                { label: 'Equipment Pending', value: kpis.pendingEquipment, icon: Package, bg: 'bg-amber-50', fg: 'text-amber-600' },
                { label: 'Onboarded', value: kpis.onboarded, icon: Users, bg: 'bg-purple-50', fg: 'text-purple-600' },
                { label: 'Total Leavers', value: kpis.totalLeavers, icon: UserMinus, bg: 'bg-red-50', fg: 'text-red-600' },
                { label: 'Current Stock', value: kpis.totalStock, icon: Package, bg: 'bg-cyan-50', fg: 'text-cyan-600' },
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

          {/* Forecast Summary KPIs */}
          {forecast && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Forecast Joiners', value: forecast.summary.totalJoiners, icon: UserPlus, bg: 'bg-blue-50', fg: 'text-[#0B5ED7]' },
                { label: 'Forecast Leavers', value: forecast.summary.totalLeavers, icon: UserMinus, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
                { label: 'Break-fix Run-Rate', value: forecast.summary.totalBreakfixRunRate, icon: Wrench, bg: 'bg-amber-50', fg: 'text-amber-600' },
                { label: 'Total Demand', value: forecast.summary.totalDemand, icon: TrendingUp, bg: 'bg-orange-50', fg: 'text-orange-600' },
                { label: 'Stock Available', value: forecast.summary.currentStock, icon: Package, bg: 'bg-cyan-50', fg: 'text-cyan-600' },
                { label: 'To Procure', value: forecast.summary.totalToProcure, icon: AlertTriangle, bg: forecast.summary.totalToProcure > 0 ? 'bg-red-50' : 'bg-emerald-50', fg: forecast.summary.totalToProcure > 0 ? 'text-red-600' : 'text-emerald-600' },
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

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Joiners by Country</h3>
              <div className="h-56 w-full">
                {joinersByCountry.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={joinersByCountry}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="#0B5ED7" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">No joiner data</div>
                )}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Joiners by Device Category</h3>
              <div className="h-56 w-full">
                {joinersByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={joinersByCategory} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="#00A3E0" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
                )}
              </div>
            </div>
          </div>

          {/* Status Donut + Forecast by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h3>
              <div className="h-56 w-full">
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value"
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
                )}
              </div>
            </div>
            {forecast && forecast.byCategory.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Forecast by Device Category</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 text-[10px] uppercase border-b border-gray-100">
                        <th className="py-2 px-2 text-left font-medium">Category</th>
                        <th className="py-2 px-2 text-right font-medium">Joiners</th>
                        <th className="py-2 px-2 text-right font-medium">Leavers</th>
                        <th className="py-2 px-2 text-right font-medium">Break-fix</th>
                        <th className="py-2 px-2 text-right font-medium">Stock</th>
                        <th className="py-2 px-2 text-right font-medium">To Procure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {forecast.byCategory.map(c => (
                        <tr key={c.category} className="hover:bg-gray-50">
                          <td className="py-1.5 px-2 font-medium text-gray-700">{c.category}</td>
                          <td className="py-1.5 px-2 text-right text-[#0B5ED7] font-semibold">{c.joiners}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-600">{c.leavers}</td>
                          <td className="py-1.5 px-2 text-right text-amber-600">{c.breakfix}</td>
                          <td className="py-1.5 px-2 text-right text-cyan-600">{c.stock}</td>
                          <td className={`py-1.5 px-2 text-right font-semibold ${c.toProcure > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{c.toProcure}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Monthly Forecast Table */}
          {forecast && forecast.forecast.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Forecast Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-[10px] uppercase border-b border-gray-100">
                      <th className="py-2 px-2 text-left font-medium">Month</th>
                      <th className="py-2 px-2 text-left font-medium">Country</th>
                      <th className="py-2 px-2 text-left font-medium">Category</th>
                      <th className="py-2 px-2 text-right font-medium">Joiners</th>
                      <th className="py-2 px-2 text-right font-medium">Leavers</th>
                      <th className="py-2 px-2 text-right font-medium">Break-fix/mo</th>
                      <th className="py-2 px-2 text-right font-medium">Demand</th>
                      <th className="py-2 px-2 text-right font-medium">Net Demand</th>
                      <th className="py-2 px-2 text-right font-medium">Stock</th>
                      <th className="py-2 px-2 text-right font-medium">To Procure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {forecast.forecast.filter(r => r.demand > 0 || r.procurementNeed > 0).slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 px-2 text-gray-700 font-medium">{r.month}</td>
                        <td className="py-1.5 px-2 text-gray-600">{r.country}</td>
                        <td className="py-1.5 px-2 text-gray-600">{r.deviceCategory}</td>
                        <td className="py-1.5 px-2 text-right text-[#0B5ED7] font-semibold">{r.joiners}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-600">{r.leavers}</td>
                        <td className="py-1.5 px-2 text-right text-amber-600">{r.breakfixRunRate}</td>
                        <td className="py-1.5 px-2 text-right font-semibold text-gray-700">{r.demand}</td>
                        <td className="py-1.5 px-2 text-right font-semibold text-gray-700">{r.netDemand}</td>
                        <td className="py-1.5 px-2 text-right text-cyan-600">{r.currentStock}</td>
                        <td className={`py-1.5 px-2 text-right font-bold ${r.procurementNeed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{r.procurementNeed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>)}

        {/* ═══ RECORDS TAB ═══ */}
        {tab === 'records' && (<>
          {/* Sub-tabs + toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
              {([
                { key: 'joiners' as const, label: `Joiners (${joiners.length})` },
                { key: 'leavers' as const, label: `Leavers (${leavers.length})` },
                { key: 'stock' as const, label: `Stock (${stock.length})` },
              ]).map(t => (
                <button key={t.key} onClick={() => { setSubTab(t.key); setPage(1); }} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${subTab === t.key ? 'bg-white text-[#0B5ED7] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search..." className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none w-48 bg-white shadow-sm" />
              </div>
              {subTab === 'joiners' && (
                <>
                  <button onClick={openAdd} className="px-3 py-1.5 text-sm bg-[#0B5ED7] hover:bg-[#0840A0] text-white rounded-md shadow-sm transition-colors flex items-center gap-1.5">
                    + Add
                  </button>
                  <label className={`px-3 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                    <Upload size={13} /> {uploading ? 'Uploading...' : 'Upload Excel'}
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                  </label>
                </>
              )}
              <button onClick={exportToExcel} disabled={tableData.length === 0} className="px-3 py-1.5 text-sm bg-[#00B050] hover:bg-[#00913F] disabled:opacity-40 text-white rounded-md shadow-sm transition-colors flex items-center gap-1.5">
                <Download size={13} /> Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-4"><SkeletonTable rows={10} /></div>
            ) : tableData.length === 0 ? (
              <EmptyState icon={Inbox} title="No records found" description="Upload an Excel file or add records manually." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                      {subTab === 'joiners' && (
                        <>
                          {([
                            { key: 'candidatename' as SortKey, label: 'Name' },
                            { key: 'country' as SortKey, label: 'Country' },
                            { key: 'devicecategory' as SortKey, label: 'Device Category' },
                          ]).map(col => (
                            <th key={col.key} onClick={() => handleSort(col.key)} className="px-3 py-2 font-semibold border-b border-gray-100 cursor-pointer hover:bg-gray-100 select-none">
                              {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Model</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Start Date</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Status</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Manager</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100 text-center w-20">Actions</th>
                        </>
                      )}
                      {subTab === 'leavers' && (
                        <>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Name</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Country</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Device</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Last Day</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Status</th>
                        </>
                      )}
                      {subTab === 'stock' && (
                        <>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Country</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Device Category</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100">Model</th>
                          <th className="px-3 py-2 font-semibold border-b border-gray-100 text-right">Quantity</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedData.map((r) => (
                      <tr key={r.id} className="hover:bg-[#E8F0FE]/40 transition-colors">
                        {subTab === 'joiners' && (
                          <>
                            <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{r.candidatename}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{r.country}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{r.devicecategory}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{r.model || '--'}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{formatDate(r.startdate)}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${r.status === 'Onboarded' || r.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'In Progress' ? 'bg-[#E0EBFA] text-[#0840A0]' : r.status === 'Cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{r.hiringmanager || '--'}</td>
                            <td className="px-3 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-[#0B5ED7] hover:bg-[#E8F0FE] rounded transition-colors"><Pencil size={13} /></button>
                                <button onClick={() => deleteJoiner(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </>
                        )}
                        {subTab === 'leavers' && (
                          <>
                            <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{(r as unknown as Leaver).employeename}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{r.country}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{r.devicecategory}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{formatDate(r.startdate)}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${r.status === 'Exited' || r.status === 'Device Returned' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {r.status}
                              </span>
                            </td>
                          </>
                        )}
                        {subTab === 'stock' && (
                          <>
                            <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{r.country}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{r.devicecategory}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{r.model || '--'}</td>
                            <td className="px-3 py-1.5 text-xs text-right font-semibold text-[#0B5ED7]">{Number((r as unknown as Stock).quantity).toLocaleString()}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
                <span>Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, tableData.length)} of {tableData.length}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        </>)}
      </div>

      {/* Edit/Create Modal */}
      {editingJoiner !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 bg-[#003399]">
              <h3 className="text-sm font-bold text-white">{editingJoiner.id ? 'Edit' : 'Add'} Joiner</h3>
              <button onClick={() => setEditingJoiner(null)} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
            </div>
            <form onSubmit={saveJoiner} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Candidate Name', key: 'candidatename', type: 'text', required: true },
                  { label: 'Country', key: 'country', type: 'text', required: true },
                  { label: 'City', key: 'city', type: 'text' },
                  { label: 'Function', key: 'function', type: 'text' },
                  { label: 'Device Category', key: 'devicecategory', type: 'text', required: true },
                  { label: 'Model', key: 'model', type: 'text' },
                  { label: 'Start Date', key: 'startdate', type: 'date' },
                  { label: 'Status', key: 'status', type: 'select', options: ['Pending', 'In Progress', 'Onboarded', 'Completed', 'Cancelled'] },
                  { label: 'Hiring Manager', key: 'hiringmanager', type: 'text' },
                  { label: 'Business Unit', key: 'businessunit', type: 'text' },
                  { label: 'Department', key: 'department', type: 'text' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'department' ? 'col-span-2' : ''}>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">{f.label}</label>
                    {f.type === 'select' ? (
                      <select value={(form as Record<string, string>)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none bg-white">
                        {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required={f.required} />
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingJoiner(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-[#0B5ED7] hover:bg-[#0840A0] text-white rounded-md shadow-sm transition-colors">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
