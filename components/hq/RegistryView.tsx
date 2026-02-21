import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SchoolRegistryEntry, ForwardingData, GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';
import EditableField from '../shared/EditableField';

interface RegistryViewProps {
  registry: SchoolRegistryEntry[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onRemoteView: (schoolId: string) => void;
  onUpdateRegistry: (next: SchoolRegistryEntry[]) => void;
  onLogAction: (action: string, target: string, details: string) => void;
}

const RegistryView: React.FC<RegistryViewProps> = ({ registry, searchTerm, setSearchTerm, onRemoteView, onUpdateRegistry, onLogAction }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inflows, setInflows] = useState<ForwardingData[]>([]);
  const [totalSettledPayouts, setTotalSettledPayouts] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
       // 1. Fetch Inflows from uba_school_forwarding
       const { data: infData } = await supabase.from('uba_school_forwarding').select('*');
       if (infData) setInflows(infData.map(d => ({
         schoolId: d.school_id,
         schoolName: d.school_name,
         bulkPayment: { amount: d.bulk_payment_amount },
         pupilPayments: (d.payload as any)?.pupilPayments || {}
       }) as ForwardingData));

       // 2. Fetch Settled Claims from uba_claims for Net Calculation
       const { data: claimData } = await supabase
         .from('uba_claims')
         .select('total_amount')
         .eq('status', 'DISBURSED');
       
       if (claimData) {
          const settled = claimData.reduce((sum, p) => sum + (p.total_amount || 0), 0);
          setTotalSettledPayouts(settled);
       }
    };
    fetchData();
  }, []);

  const financialSummary = useMemo(() => {
    const gross = inflows.reduce((a, b) => a + (b.bulkPayment?.amount || 0), 0);
    const net = gross - totalSettledPayouts;
    return { gross, net };
  }, [inflows, totalSettledPayouts]);

  const query = (searchTerm || "").toLowerCase();
  const filtered = registry.filter(r => 
    (r.name || "").toLowerCase().includes(query) || 
    (r.id || "").toLowerCase().includes(query)
  );

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const next = registry.map(r => r.id === id ? { ...r, status: nextStatus as any } : r);
    onUpdateRegistry(next);
    const school = registry.find(r => r.id === id);
    if (school) {
      await supabase.from('uba_persistence').upsert({
        id: `registry_${id}`, hub_id: id, payload: { ...school, status: nextStatus }, last_updated: new Date().toISOString()
      });
      onLogAction("STATUS_CHANGE", id, `Institutional state modulated to ${nextStatus.toUpperCase()}.`);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col font-sans pb-20">
      
      <div className="space-y-10 max-w-7xl mx-auto w-full">

         {/* INFLOW MATRIX HEADER (NET INFLOW SOURCE) */}
         <section className="space-y-6">
            <div className="flex items-center justify-between px-6">
               <h3 className="text-xl font-black uppercase text-emerald-400 tracking-tighter">Institutional Sources of Fund</h3>
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{inflows.length} Source Nodes</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-16 border-b border-slate-800">
                     <tr>
                        <th className="px-8">Institutional Node</th>
                        <th className="px-6 text-center">Census Audit</th>
                        <th className="px-8 text-right">Fund Shard</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {inflows.map((inf, i) => (
                        <tr key={i} className="hover:bg-emerald-500/5 transition-colors h-20">
                           <td className="px-8">
                              <p className="text-xs font-black text-white uppercase">{inf.schoolName}</p>
                              <p className="text-[8px] font-mono text-slate-600 mt-2 uppercase tracking-tighter">Node ID: {inf.schoolId}</p>
                           </td>
                           <td className="px-6 text-center">
                              <span className="text-xs font-black text-blue-400 font-mono">#{Object.keys(inf.pupilPayments || {}).length} CANDIDATES</span>
                           </td>
                           <td className="px-8 text-right">
                              <span className="text-sm font-black text-emerald-400 font-mono">GHS {(inf.bulkPayment?.amount || 0).toFixed(2)}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
                  <tfoot className="bg-slate-950 border-t border-slate-800">
                     <tr className="h-14">
                        <td colSpan={2} className="px-8 text-right text-[8px] font-black text-slate-500 uppercase">Gross Source Volume:</td>
                        <td className="px-8 text-right text-sm font-black text-slate-300 font-mono">GHS {financialSummary.gross.toFixed(2)}</td>
                     </tr>
                     <tr className="h-14 bg-red-950/10">
                        <td colSpan={2} className="px-8 text-right text-[8px] font-black text-red-500 uppercase">Specialist Payout Deductions:</td>
                        <td className="px-8 text-right text-sm font-black text-red-400 font-mono">- GHS {totalSettledPayouts.toFixed(2)}</td>
                     </tr>
                     <tr className="h-20 border-t border-slate-800">
                        <td colSpan={2} className="px-8 text-right text-[9px] font-black text-emerald-400 uppercase tracking-widest">Net Sourced Funds (Active Treasury):</td>
                        <td className="px-8 text-right text-2xl font-black text-emerald-400 font-mono">GHS {financialSummary.net.toFixed(2)}</td>
                     </tr>
                  </tfoot>
               </table>
            </div>
         </section>

         {/* REGISTRY MATRIX */}
         <div className="space-y-6">
            <div className="flex items-center justify-between px-6">
               <h3 className="text-xl font-black uppercase text-blue-400 tracking-tighter">Institutional Network Registry</h3>
               <div className="relative w-full md:w-80">
                  <input type="text" placeholder="Search registry shards..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 text-xs font-bold text-white outline-none" />
               </div>
            </div>
            <div ref={scrollRef} className="bg-slate-900/50 border border-slate-800 rounded-[3rem] overflow-x-auto shadow-2xl no-scrollbar scroll-smooth">
               <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-[0.3em] sticky top-0 z-10 border-b border-slate-800 h-20">
                     <tr>
                        <th className="px-10 text-center w-16">State</th>
                        <th className="px-6 min-w-[300px]">Institutional Shard Identity</th>
                        <th className="px-6">Node Access Key</th>
                        <th className="px-6 text-center w-56">Active Census</th>
                        <th className="px-10 text-right">Command Portal</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {filtered.map(school => (
                        <tr key={school.id} className="hover:bg-blue-600/5 transition-all group h-24">
                           <td className="px-10 text-center">
                              <button onClick={() => toggleStatus(school.id, school.status)} className={`w-3 h-3 rounded-full mx-auto transition-all ${school.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></button>
                           </td>
                           <td className="px-6">
                              <span className="font-black text-white uppercase text-base leading-none group-hover:text-blue-400 transition-colors">{school.name}</span>
                           </td>
                           <td className="px-6 font-mono text-blue-500 text-[11px] font-black">{school.id}</td>
                           <td className="px-6 text-center">
                              <span className="text-base font-black text-emerald-400 font-mono">{school.studentCount || 0}</span>
                           </td>
                           <td className="px-10 text-right">
                              <button onClick={() => onRemoteView(school.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95">Access</button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default RegistryView;