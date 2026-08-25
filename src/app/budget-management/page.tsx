'use client';

import { useState, useEffect, useMemo } from 'react';
import { Wallet, Plus, Pencil, Trash2, X, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

type CountryBudget = {
  id: string;
  country: string;
  halfYearPeriod: string;
  approvedBudget: string;
  lastUpdatedBy: string | null;
  lastUpdatedOn: string;
};

type SortKey = 'country' | 'halfYearPeriod' | 'approvedBudget';

const EMPTY_FORM = { country: '', halfYearPeriod: 'H2-2026', approvedBudget: '' };
const PERIOD_OPTIONS = ['H2-2025', 'H1-2026', 'H2-2026', 'H1-2027', 'H2-2027'];

export default function BudgetManagementPage() {
  const [budgets, setBudgets] = useState<CountryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('country');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<CountryBudget | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { toast } = useToast();

  const fetchData = () => {
    setLoading(true);
    fetch('/api/budgets')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBudgets(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const result = budgets.filter(b => {
      if (filterPeriod && b.halfYearPeriod !== filterPeriod) return false;
      return true;
    });
    return [...result].sort((a, b) => {
      const av = sortKey === 'approvedBudget' ? Number(a.approvedBudget) : a[sortKey];
      const bv = sortKey === 'approvedBudget' ? Number(b.approvedBudget) : b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [budgets, filterPeriod, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} className="text-gray-300 ml-0.5" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-[#0B5ED7] ml-0.5" /> : <ArrowDown size={11} className="text-[#0B5ED7] ml-0.5" />;
  };

  const periods = useMemo(() => Array.from(new Set(budgets.map(b => b.halfYearPeriod))).sort().reverse(), [budgets]);
  const countries = useMemo(() => Array.from(new Set(budgets.map(b => b.country))).sort(), [budgets]);

  const totalBudget = useMemo(() => filtered.reduce((s, b) => s + Number(b.approvedBudget), 0), [filtered]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, halfYearPeriod: periods[0] || 'H2-2026' });
    setIsNew(true);
    setModal(null);
  };

  const openEdit = (budget: CountryBudget) => {
    setForm({ country: budget.country, halfYearPeriod: budget.halfYearPeriod, approvedBudget: budget.approvedBudget });
    setIsNew(false);
    setModal(budget);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isNew ? '/api/budgets' : `/api/budgets/${modal!.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, approvedBudget: Number(form.approvedBudget) }),
      });
      if (res.ok) { setModal(null); setIsNew(false); fetchData(); toast(isNew ? 'Budget entry created' : 'Budget entry updated'); }
      else toast('Failed to save budget', 'error');
    } catch (error) {
      console.error('Failed to save budget:', error);
      toast('Failed to save budget', 'error');
    }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm('Delete this budget entry?')) return;
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); toast('Budget entry deleted'); }
      else toast('Failed to delete budget', 'error');
    } catch (error) {
      console.error('Failed to delete budget:', error);
      toast('Failed to delete budget', 'error');
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
              <h1 className="text-lg font-bold text-white tracking-tight">Budget Management</h1>
              <p className="text-[11px] text-blue-200 hidden sm:block">Half-yearly approved budgets per country</p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-blue-200 mb-0.5 uppercase tracking-wider">Period</label>
                <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="px-2.5 py-1.5 text-sm border border-blue-400/30 rounded-md bg-white/10 text-white focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none min-w-[130px]">
                  <option value="" className="text-gray-900">All Periods</option>
                  {periods.map(p => <option key={p} value={p} className="text-gray-900">{p}</option>)}
                </select>
              </div>
              <button onClick={() => setFilterPeriod('')} className="px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5">
                <RotateCcw size={13} /> Clear
              </button>
              <button onClick={openNew} className="px-3 py-1.5 text-sm bg-[#00B050] hover:bg-[#00913F] text-white rounded-md transition-colors flex items-center gap-1.5">
                <Plus size={13} /> Add Budget
              </button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-50 text-[#0B5ED7]"><Wallet size={18} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Total Budget</p>
              <p className="text-lg font-bold text-gray-900">€{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600"><Wallet size={18} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Countries</p>
              <p className="text-lg font-bold text-gray-900">{countries.length}</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-50 text-purple-600"><Wallet size={18} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Avg Budget</p>
              <p className="text-lg font-bold text-gray-900">€{filtered.length > 0 ? (totalBudget / filtered.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p>
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
              title="No budget entries found"
              description={filterPeriod ? 'No budgets for the selected period.' : 'No country budgets have been configured yet.'}
              action={!filterPeriod ? (
                <button onClick={openNew} className="text-xs text-[#0B5ED7] hover:underline">Add your first budget entry</button>
              ) : (
                <button onClick={() => setFilterPeriod('')} className="text-xs text-[#0B5ED7] hover:underline">Clear period filter</button>
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                    {([
                      ['country', 'Country'],
                      ['halfYearPeriod', 'Period'],
                      ['approvedBudget', 'Approved Budget'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key} onClick={() => handleSort(key)} className={thClass}>
                        <span className="inline-flex items-center gap-0.5">{label}<SortIcon col={key} /></span>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold border-b border-gray-100 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(budget => (
                    <tr key={budget.id} className="hover:bg-[#E8F0FE]/40 transition-colors">
                      <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{budget.country}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#E8F0FE] text-[#0840A0]">
                          {budget.halfYearPeriod}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs font-semibold text-[#0B5ED7]">€{Number(budget.approvedBudget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(budget)} className="p-1.5 text-gray-400 hover:text-[#0B5ED7] hover:bg-[#E8F0FE] rounded transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteBudget(budget.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
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
              <h3 className="text-sm font-bold text-white">{isNew ? 'Add Budget Entry' : 'Edit Budget Entry'}</h3>
              <button onClick={() => { setModal(null); setIsNew(false); }} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Country</label>
                <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required placeholder="e.g. India" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Half-Year Period</label>
                <select value={form.halfYearPeriod} onChange={e => setForm({ ...form, halfYearPeriod: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none bg-white">
                  {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Approved Budget (€)</label>
                <input type="number" step="0.01" value={form.approvedBudget} onChange={e => setForm({ ...form, approvedBudget: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0B5ED7] focus:border-[#0B5ED7] outline-none" required placeholder="0.00" />
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
