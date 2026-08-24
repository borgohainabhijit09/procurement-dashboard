'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Truck, CheckCircle, Activity, X } from 'lucide-react';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Home() {
  const [allData, setAllData] = useState<AssetOrder[]>([]);
  const [orders, setOrders] = useState<AssetOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [regionFilter, setRegionFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<AssetOrder | null>(null);

  // Fetch all data once for extracting global filter options and maybe dashboard base data
  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        setAllData(data);
        setOrders(data);
        setLoading(false);
      });
  }, []);

  // Fetch filtered data when filters change
  useEffect(() => {
    if (allData.length === 0) return;
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (regionFilter) queryParams.append('region', regionFilter);
    if (countryFilter) queryParams.append('country', countryFilter);
    if (statusFilter) queryParams.append('status', statusFilter);
    
    fetch(`/api/orders?${queryParams.toString()}`)
      .then(r => r.json())
      .then(data => {
        setOrders(data);
        setLoading(false);
      });
  }, [regionFilter, countryFilter, statusFilter, allData.length]);

  // Dependent Filters Logic
  const regions = useMemo(() => Array.from(new Set(allData.map(o => o.region))).sort(), [allData]);
  const countries = useMemo(() => {
    const filteredByRegion = regionFilter ? allData.filter(o => o.region === regionFilter) : allData;
    return Array.from(new Set(filteredByRegion.map(o => o.country))).sort();
  }, [allData, regionFilter]);
  
  const statuses = useMemo(() => Array.from(new Set(allData.map(o => o.status || 'Unknown'))).sort(), [allData]);

  // Reset country filter if the selected country is not in the updated dependent list
  useEffect(() => {
    if (countryFilter && !countries.includes(countryFilter)) {
      setCountryFilter('');
    }
  }, [countries, countryFilter]);

  // KPI Calculations (based on currently filtered orders)
  const kpis = useMemo(() => {
    return {
      totalOrdered: orders.reduce((sum, o) => sum + o.ordered, 0),
      totalDelivered: orders.reduce((sum, o) => sum + o.delivered, 0),
      totalInProgress: orders.reduce((sum, o) => sum + o.inProgress, 0),
      totalInTransit: orders.reduce((sum, o) => sum + o.inTransit, 0),
    };
  }, [orders]);

  // Chart Data Calculations (using allData or orders? usually dashboard charts use global or partially filtered. Let's use orders so it reflects current drill-down)
  const regionChartData = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      map.set(o.region, (map.get(o.region) || 0) + o.ordered);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [orders]);

  const statusChartData = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      const s = o.status || 'Unknown';
      map.set(s, (map.get(s) || 0) + o.ordered);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const deleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAllData(prev => prev.filter(o => o.id !== id));
        setOrders(prev => prev.filter(o => o.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete order:', error);
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
        setAllData(prev => prev.map(o => o.id === updated.id ? updated : o));
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        setEditingOrder(null);
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Filters */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Asset Ordering</h1>
            <p className="text-sm text-slate-500 mt-1">Interactive region and country-wise tracking</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Region</label>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-slate-50 shadow-inner min-w-[150px]">
                <option value="">All Regions</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Country</label>
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-slate-50 shadow-inner min-w-[150px]" disabled={!regionFilter && countries.length > 20}>
                <option value="">All Countries</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg bg-slate-50 shadow-inner min-w-[150px]">
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button 
                onClick={() => { setRegionFilter(''); setCountryFilter(''); setStatusFilter(''); }} 
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Package size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Ordered</p>
              <h3 className="text-2xl font-bold text-slate-800">{kpis.totalOrdered.toLocaleString()}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Delivered</p>
              <h3 className="text-2xl font-bold text-slate-800">{kpis.totalDelivered.toLocaleString()}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Truck size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">In Transit</p>
              <h3 className="text-2xl font-bold text-slate-800">{kpis.totalInTransit.toLocaleString()}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Activity size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">In Progress</p>
              <h3 className="text-2xl font-bold text-slate-800">{kpis.totalInProgress.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Orders by Region</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionChartData}>
                  <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} />
                  <YAxis />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    onClick={(data) => setRegionFilter(data.name)} // Interactive chart filtering!
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">Click a bar to filter by region</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Orders by Status</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => setStatusFilter(data.name)} // Interactive chart filtering!
                    className="cursor-pointer"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">Click a slice to filter by status</p>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading && orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <Activity className="animate-spin mb-4 text-blue-500" size={32} />
              Loading data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold border-b border-slate-100">ID</th>
                    <th className="p-4 font-semibold border-b border-slate-100">Region / Country</th>
                    <th className="p-4 font-semibold border-b border-slate-100">Model</th>
                    <th className="p-4 font-semibold border-b border-slate-100 text-right">Qty</th>
                    <th className="p-4 font-semibold border-b border-slate-100 text-right">Ordered</th>
                    <th className="p-4 font-semibold border-b border-slate-100 text-right">Delivered</th>
                    <th className="p-4 font-semibold border-b border-slate-100">Status</th>
                    <th className="p-4 font-semibold border-b border-slate-100 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700">{order.id}</td>
                      <td className="p-4 text-sm text-slate-600">
                        <div className="font-medium text-slate-800">{order.region}</div>
                        <div className="text-xs text-slate-500">{order.country}</div>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{order.model}</td>
                      <td className="p-4 text-sm text-right font-medium text-slate-700">{order.quantity}</td>
                      <td className="p-4 text-sm text-right text-blue-600 font-semibold">{order.ordered}</td>
                      <td className="p-4 text-sm text-right text-green-600 font-semibold">{order.delivered}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                          ${order.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                            order.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 
                            'bg-slate-100 text-slate-800'}`}>
                          {order.status || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-right space-x-3">
                        <button onClick={() => setEditingOrder(order)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                        <button onClick={() => deleteOrder(order.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">No orders match the current filters.</td>
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
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Edit Order: {editingOrder.id}</h3>
              <button onClick={() => setEditingOrder(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={saveOrder} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <input type="text" value={editingOrder.region} onChange={e => setEditingOrder({...editingOrder, region: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <input type="text" value={editingOrder.country} onChange={e => setEditingOrder({...editingOrder, country: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                  <input type="text" value={editingOrder.model} onChange={e => setEditingOrder({...editingOrder, model: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <input type="text" value={editingOrder.status || ''} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ordered</label>
                  <input type="number" value={editingOrder.ordered} onChange={e => setEditingOrder({...editingOrder, ordered: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivered</label>
                  <input type="number" value={editingOrder.delivered} onChange={e => setEditingOrder({...editingOrder, delivered: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
