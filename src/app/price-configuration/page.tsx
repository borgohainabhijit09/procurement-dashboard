'use client';

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Plus, Pencil, Trash2, X, Search, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

type ModelPrice = {
  id: string;
  model: string;
  country: string;
  pricePerUnit: string;
  monthYear: string;
  lastUpdatedBy: string | null;
  lastUpdatedOn: string;
};

type SortKey = 'model' | 'country' | 'pricePerUnit' | 'monthYear';

const EMPTY_FORM = { model: '', country: '', pricePerUnit: '', monthYear: '' };

export default function PriceConfigurationPage() {
  const [prices, setPrices] = useState<ModelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('country');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModelPrice | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { toast } = useToast();

  const fetchData = () => {
    setLoading(true);
    fetch('/api/prices')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPrices(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const result = prices.filter(p => {
      if (filterCountry && p.country !== filterCountry) return false;
      if (filterModel && p.model !== filterModel) return false;
      if (filterMonth && p.monthYear !== filterMonth) return false;
      return true;
    });
    return [...result].sort((a, b) => {
      const av = sortKey === 'pricePerUnit' ? Number(a.pricePerUnit) : a[sortKey];
      const bv = sortKey === 'pricePerUnit' ? Number(b.pricePerUnit) : b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [prices, filterCountry, filterModel, filterMonth, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} className="text-gray-300 ml-0.5" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-[#0B5ED7] ml-0.5" /> : <ArrowDown size={11} className="text-[#0B5ED7] ml-0.5" />;
  };

  const countries = useMemo(() => Array.from(new Set(prices.map(p => p.country))).sort(), [prices]);
  const models = useMemo(() => Array.from(new Set(prices.map(p => p.model))).sort(), [prices]);
  const months = useMemo(() => Array.from(new Set(prices.map(p => p.monthYear))).sort().reverse(), [prices]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setIsNew(true);
    setModal(null);
  };

  const openEdit = (price: ModelPrice) => {
    setForm({ model: price.model, country: price.country, pricePerUnit: price.pricePerUnit, monthYear: price.monthYear });
    setIsNew(false);
    setModal(price);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isNew ? '/api/prices' : `/api/prices/${modal!.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pricePerUnit: Number(form.pricePerUnit) }),
      });
      if (res.ok) { setModal(null); fetchData(); toast(isNew ? 'Price entry created' : 'Price entry updated'); }
      else toast('Failed to save price', 'error');
    } catch (error) {
      console.error('Failed to save price:', error);
      toast('Failed to save price', 'error');
    }
  };

  const deletePrice = async (id: string) => {
    if (!confirm('Delete this price entry?')) return;
    try {
      const res = await fetch(`/api/prices/${id}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); toast('Price entry deleted'); }
      else toast('Failed to delete price', 'error');
    } catch (error) {
      console.error('Failed to delete price:', error);
      toast('Failed to delete price', 'error');
    }
  };

  const thClass = 'px-3 py-2 font-semibold border-b border-gray-100 cursor-pointer hover:bg-gray-100 select-none transition-colors';

  return (
    <div className="min-h-screen text-slate-900 font-sans">
      <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-4 pt-14 lg:pt-4">

        {/* Header */}
        <div className="bg-[#003399] rounded-lg shadow-sm px-5 py-3">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white tracking-tight">Price Configuration</h1>
              <p className="text-[11px] text-blue-200 hidden sm:block">Model pricing per country per month</p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Country</label>
                <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[120px]">
                  <option value="" className="text-gray-900">All</option>
                  {countries.map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Model</label>
                <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[120px]">
                  <option value="" className="text-gray-900">All</option>
                  {models.map(m => <option key={m} value={m} className="text-gray-900">{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Month</label>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[120px]">
                  <option value="" className="text-gray-900">All</option>
                  {months.map(m => <option key={m} value={m} className="text-gray-900">{m}</option>)}
                </select>
              </div>
              <button onClick={() => { setFilterCountry(''); setFilterModel(''); setFilterMonth(''); }} className="px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5">
                <RotateCcw size={13} /> Clear
              </button>
              <button onClick={openNew} className="px-3 py-1.5 text-sm bg-[#00B050] hover:bg-[#00913F] text-white rounded-md transition-colors flex items-center gap-1.5">
                <Plus size={13} /> Add Price
              </button>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-50 text-[#0B5ED7]"><DollarSign size={18} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Total Entries</p>
              <p className="text-lg font-bold text-gray-900">{filtered.length}</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600"><Search size={18} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Unique Models</p>
              <p className="text-lg font-bold text-gray-900">{new Set(filtered.map(p => p.model)).size}</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-50 text-purple-600"><DollarSign size={18} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Avg Price</p>
              <p className="text-lg font-bold text-gray-900">€{filtered.length > 0 ? (filtered.reduce((s, p) => s + Number(p.pricePerUnit), 0) / filtered.length).toFixed(2) : '0.00'}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-4"><SkeletonTable rows={8} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No price entries found"
              description={filterCountry || filterModel || filterMonth ? 'Try adjusting your filters.' : 'No model prices have been configured yet.'}
              action={!filterCountry && !filterModel && !filterMonth ? (
                <button onClick={openNew} className="text-xs text-[#0B5ED7] hover:underline">Add your first price entry</button>
              ) : (
                <button onClick={() => { setFilterCountry(''); setFilterModel(''); setFilterMonth(''); }} className="text-xs text-[#0B5ED7] hover:underline">Clear filters</button>
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                    {([
                      ['model', 'Model'],
                      ['country', 'Country'],
                      ['pricePerUnit', 'Price/Unit'],
                      ['monthYear', 'Month/Year'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key} onClick={() => handleSort(key)} className={thClass}>
                        <span className="inline-flex items-center gap-0.5">{label}<SortIcon col={key} /></span>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold border-b border-gray-100 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(price => (
                    <tr key={price.id} className="hover:bg-[#E8F0FE]/40 transition-colors">
                      <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{price.model}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{price.country}</td>
                      <td className="px-3 py-1.5 text-xs font-semibold text-[#0B5ED7]">€{Number(price.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{price.monthYear}</td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(price)} className="p-1.5 text-gray-400 hover:text-[#0B5ED7] hover:bg-[#E8F0FE] rounded transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deletePrice(price.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal !== null || isNew ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 bg-[#003399]">
              <h3 className="text-sm font-bold text-white">{isNew ? 'Add Price Entry' : 'Edit Price Entry'}</h3>
              <button onClick={() => { setModal(null); setIsNew(false); }} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Model</label>
                <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required placeholder="e.g. IntelliSpace CT 5000" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Country</label>
                <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required placeholder="e.g. India" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Price per Unit</label>
                <input type="number" step="0.01" value={form.pricePerUnit} onChange={e => setForm({ ...form, pricePerUnit: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Month / Year</label>
                <input type="text" value={form.monthYear} onChange={e => setForm({ ...form, monthYear: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required placeholder="e.g. 2026-08" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setModal(null); setIsNew(false); }} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-[#0B5ED7] hover:bg-[#0840A0] text-white rounded-md shadow-sm transition-colors">{isNew ? 'Create' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
