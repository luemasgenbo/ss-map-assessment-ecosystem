import React, { useMemo, useState, useEffect } from 'react';
import { SchoolRegistryEntry } from '../../types';
import { supabase } from '../../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

interface NetworkDashboardProps {
  registry: SchoolRegistryEntry[];
  onExit: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

const NetworkDashboard: React.FC<NetworkDashboardProps> = ({ registry, onExit }) => {
  const [networkStats, setNetworkStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    activeNodes: 0,
    suspendedNodes: 0,
    schoolDistribution: [] as any[],
    statusData: [] as any[]
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchNetworkStats = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch granular counts
      const { count: studentCount } = await supabase.from('uba_pupils').select('*', { count: 'exact', head: true });
      const { count: staffCount } = await supabase.from('uba_facilitators').select('*', { count: 'exact', head: true });
      
      // 2. Fetch all pupils to calculate distribution (could be optimized with RPC)
      const { data: pupils } = await supabase.from('uba_pupils').select('hub_id');
      
      const distributionMap: Record<string, number> = {};
      pupils?.forEach(p => {
        distributionMap[p.hub_id] = (distributionMap[p.hub_id] || 0) + 1;
      });

      const schoolDistribution = registry
        .map(r => ({ name: r.name || 'Unknown', students: distributionMap[r.id] || 0 }))
        .sort((a, b) => b.students - a.students)
        .slice(0, 8);

      const activeNodes = registry.filter(r => r.status === 'active').length;
      const suspendedNodes = registry.filter(r => r.status === 'suspended').length;
      const auditNodes = registry.filter(r => r.status === 'audit').length;

      const statusData = [
        { name: 'Active', value: activeNodes },
        { name: 'Suspended', value: suspendedNodes },
        { name: 'Audit', value: auditNodes }
      ].filter(d => d.value > 0);

      setNetworkStats({
        totalStudents: studentCount || 0,
        totalStaff: staffCount || 0,
        activeNodes,
        suspendedNodes,
        schoolDistribution,
        statusData
      });
    } catch (e) {
      console.error("Dashboard Recall Failure:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkStats();
  }, [registry]);

  const stats = networkStats;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Dashboard Header with Exit */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">Network Overview</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Node Analytics</p>
        </div>
        <button 
          onClick={onExit}
          className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Exit System
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Institutions', value: registry.length, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-blue-50 text-blue-600' },
          { label: 'Network Census', value: stats.totalStudents, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Verified Specialists', value: stats.totalStaff, icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Active Nodes', value: stats.activeNodes, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-blue-600 text-white' },
        ].map((m, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 flex items-center gap-6 group hover:scale-105 transition-all">
            <div className={`w-14 h-14 ${m.color} rounded-2xl flex items-center justify-center shadow-lg`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={m.icon}/></svg>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</p>
              <p className="text-2xl font-black text-slate-900">{m.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Student Distribution */}
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black uppercase text-slate-900 tracking-tighter">Top Institutions by Census</h3>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Global Ranking</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.schoolDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="students" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black uppercase text-slate-900 tracking-tighter">Network Node Status</h3>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Operational Health</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-2xl border border-gray-100">
           <h3 className="text-lg font-black uppercase text-slate-900 tracking-tighter mb-6">Critical Network Alerts</h3>
           <div className="space-y-4">
              {registry.filter(r => r.status !== 'active').map((r, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </div>
                      <div>
                         <p className="text-xs font-black text-slate-900 uppercase">{r.name}</p>
                         <p className="text-[10px] font-bold text-red-500 uppercase">Status: {r.status.toUpperCase()}</p>
                      </div>
                   </div>
                   <button className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline">Investigate</button>
                </div>
              ))}
              {registry.filter(r => r.status !== 'active').length === 0 && (
                <div className="py-12 text-center opacity-30">
                   <p className="text-xs font-black uppercase tracking-widest">All Network Nodes Operational</p>
                </div>
              )}
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-white/5 text-white">
           <h3 className="text-lg font-black uppercase tracking-tighter mb-6">Quick Actions</h3>
           <div className="space-y-3">
              {[
                { label: 'Run Global Serialization', color: 'bg-blue-600' },
                { label: 'Disburse All Shards', color: 'bg-emerald-600' },
                { label: 'Generate Network Audit', color: 'bg-indigo-600' },
                { label: 'Sync Registry Mirror', color: 'bg-slate-800' }
              ].map((a, i) => (
                <button key={i} className={`w-full ${a.color} py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all active:scale-95`}>
                  {a.label}
                </button>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkDashboard;
