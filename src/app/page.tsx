'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Truck, CheckCircle, Activity, X, Pencil, Trash2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { utils, write } from 'xlsx';

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
  lastUpdatedBy: string | null;
  lastUpdatedOn: string;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Ordered', 'Partially Delivered', 'Completed'];

export default function Home() {
  const [allData, setAllData] = useState<AssetOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingOrder, setEditingOrder] = useState<AssetOrder | null>(null);
  const [sortKey, setSortKey] = useState<keyof AssetOrder | 'pending'>('region');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const orders = useMemo(() => {
    const filtered = allData.filter(o => {
      if (regionFilter && o.region !== regionFilter) return false;
      if (countryFilter && o.country !== countryFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      return true;
    });
    const getVal = (o: AssetOrder) => {
      if (sortKey === 'pending') return Math.max(0, o.quantity - o.ordered);
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
  }, [allData, regionFilter, countryFilter, statusFilter, sortKey, sortDir]);

  const handleSort = (key: keyof AssetOrder | 'pending') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: keyof AssetOrder | 'pending' }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} className="text-gray-300 ml-0.5" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-blue-600 ml-0.5" /> : <ArrowDown size={11} className="text-blue-600 ml-0.5" />;
  };

  const exportToExcel = () => {
    const data = orders.map(o => ({
      Region: o.region, Country: o.country, Model: o.model,
      Qty: o.quantity, Ordered: o.ordered, 'Pending Qty': Math.max(0, o.quantity - o.ordered),
      Delivered: o.delivered, Status: o.status || '',
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
      if (countryFilter && !validCountries.includes(countryFilter)) {
        setCountryFilter('');
      }
    }
  };

  const kpis = useMemo(() => ({
    totalOrdered: orders.reduce((sum, o) => sum + o.ordered, 0),
    totalDelivered: orders.reduce((sum, o) => sum + o.delivered, 0),
    totalInProgress: orders.reduce((sum, o) => sum + o.inProgress, 0),
    totalInTransit: orders.reduce((sum, o) => sum + o.inTransit, 0),
  }), [orders]);

  const regionChartData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => map.set(o.region, (map.get(o.region) || 0) + o.ordered));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const statusChartData = useMemo(() => {
    const totalOrdered = orders.reduce((s, o) => s + o.ordered, 0);
    const totalInTransit = orders.reduce((s, o) => s + o.inTransit, 0);
    const totalDelivered = orders.reduce((s, o) => s + o.delivered, 0);
    return [
      { name: 'Ordered', value: totalOrdered },
      { name: 'In Transit', value: totalInTransit },
      { name: 'Delivered', value: totalDelivered },
    ].filter(d => d.value > 0);
  }, [orders]);

  const deleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) setAllData(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Failed to delete order:', error);
    }
  };

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const pendingQty = editingOrder.quantity - editingOrder.ordered;
    const payload = { ...editingOrder, toBeOrdered: pendingQty < 0 ? 0 : pendingQty };
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        setAllData(prev => prev.map(o => o.id === updated.id ? updated : o));
        setEditingOrder(null);
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">

        {/* Header */}
        <header className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-3">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-tight">Asset Ordering Dashboard</h1>
                <p className="text-xs text-gray-400">Region & country-wise tracking</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wider">Region</label>
                <select value={regionFilter} onChange={e => handleRegionChange(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[130px]">
                  <option value="">All Regions</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wider">Country</label>
                <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[130px]" disabled={!regionFilter && countries.length > 20}>
                  <option value="">All Countries</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wider">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[130px]">
                  <option value="">All Statuses</option>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={() => { setRegionFilter(''); setCountryFilter(''); setStatusFilter(''); }} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1.5">
                <RotateCcw size={13} /> Clear
              </button>
              <button onClick={exportToExcel} disabled={orders.length === 0} className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-1.5">
                <Download size={13} /> Export Excel
              </button>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Ordered', value: kpis.totalOrdered, icon: Package, bg: 'bg-blue-50', fg: 'text-blue-600' },
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
                  <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} onClick={(data) => setRegionFilter(String(data?.name || ''))} className="cursor-pointer" />
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

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading && orders.length === 0 ? (
            <div className="p-10 text-center text-gray-400 flex flex-col items-center">
              <Activity className="animate-spin mb-3 text-blue-500" size={24} />
              <span className="text-sm">Loading data...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                    {[
                      { key: 'region' as const, label: 'Region', align: '' },
                      { key: 'country' as const, label: 'Country', align: '' },
                      { key: 'model' as const, label: 'Model', align: '' },
                      { key: 'quantity' as const, label: 'Qty', align: 'text-right' },
                      { key: 'ordered' as const, label: 'Ordered', align: 'text-right' },
                      { key: 'pending' as const, label: 'Pending Qty', align: 'text-right' },
                      { key: 'delivered' as const, label: 'Delivered', align: 'text-right' },
                      { key: 'status' as const, label: 'Status', align: '' },
                    ].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} className={`px-3 py-2 font-semibold border-b border-gray-100 cursor-pointer hover:bg-gray-100 select-none transition-colors ${col.align}`}>
                        <span className="inline-flex items-center gap-0.5">{col.label}<SortIcon col={col.key} /></span>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold border-b border-gray-100 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(order => {
                    const pending = Math.max(0, order.quantity - order.ordered);
                    return (
                      <tr key={order.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{order.region}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-600">{order.country}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-600">{order.model}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-medium text-gray-700">{order.quantity.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-semibold text-blue-600">{order.ordered.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-semibold text-amber-600">{pending.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-semibold text-emerald-600">{order.delivered.toLocaleString()}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full leading-relaxed
                            ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                              order.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                              order.status === 'Ordered' ? 'bg-purple-100 text-purple-700' :
                              order.status === 'Partially Delivered' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'}`}>
                            {order.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setEditingOrder(order)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteOrder(order.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-gray-400 text-sm">No orders match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Edit Order: <span className="font-mono text-gray-500">{editingOrder.id}</span></h3>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <form onSubmit={saveOrder} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Region</label>
                  <input type="text" value={editingOrder.region} onChange={e => setEditingOrder({ ...editingOrder, region: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Country</label>
                  <input type="text" value={editingOrder.country} onChange={e => setEditingOrder({ ...editingOrder, country: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Model</label>
                  <input type="text" value={editingOrder.model} onChange={e => setEditingOrder({ ...editingOrder, model: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Status</label>
                  <select value={editingOrder.status || ''} onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value || null })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                    <option value="">None</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Total Qty</label>
                  <input type="number" value={editingOrder.quantity} onChange={e => setEditingOrder({ ...editingOrder, quantity: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Ordered</label>
                  <input type="number" value={editingOrder.ordered} onChange={e => setEditingOrder({ ...editingOrder, ordered: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Delivered</label>
                  <input type="number" value={editingOrder.delivered} onChange={e => setEditingOrder({ ...editingOrder, delivered: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Pending Qty</label>
                  <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-amber-600 font-semibold">
                    {Math.max(0, editingOrder.quantity - editingOrder.ordered).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
