import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { StaffAssignment, GlobalSettings, SchoolRegistryEntry } from '../../types';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';
import EditableField from '../shared/EditableField';

interface StaffAssetNode {
  email: string;
  fullName: string;
  hubId: string;
  nodeId: string;
  schoolName: string;
  qBankAsset: number;
  invigAsset: number;
  markingAsset: number;
  liquidBalance: number;
  rank: number;
}

const StaffFinancialsView: React.FC<{ registry: SchoolRegistryEntry[], settings: GlobalSettings, onSettingChange: (k: keyof GlobalSettings, v: any) => void }> = ({ registry, settings, onSettingChange }) => {
  const [assetNodes, setAssetNodes] = useState<StaffAssetNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchNetworkFinancials = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const { data: idents } = await supabase.from('uba_identities').select('*').eq('role', 'facilitator');
      const { data: ledger } = await supabase.from('uba_transaction_ledger').select('*');

      let rows: StaffAssetNode[] = [];
      if (idents) {
        rows = idents.map(ident => {
          const myLogs = ledger?.filter(l => l.identity_email.toLowerCase() === ident.email.toLowerCase()) || [];
          const school = registry.find(r => r.id === ident.hub_id);
          
          const getNetVolumeForRole = (roleKey: string) => {
             return myLogs
               .filter(l => l.description?.toUpperCase().includes(roleKey))
               .reduce((sum, l) => l.type === 'CREDIT' ? sum + l.amount : sum - l.amount, 0);
          };

          const qNet = getNetVolumeForRole('DEVELOPER');
          const iNet = getNetVolumeForRole('INVIGILATOR');
          const mNet = getNetVolumeForRole('EXAMINER');
          const liquidBalance = qNet + iNet + mNet;

          return {
            email: ident.email, 
            fullName: ident.full_name, 
            hubId: ident.hub_id, 
            nodeId: ident.node_id,
            schoolName: school?.name || 'Awaiting Node Auth',
            qBankAsset: Math.max(0, qNet), 
            invigAsset: Math.max(0, iNet), 
            markingAsset: Math.max(0, mNet), 
            liquidBalance: Math.max(0, liquidBalance),
            rank: 0
          };
        });
      }

      rows.sort((a, b) => b.liquidBalance - a.liquidBalance);
      rows.forEach((r, i) => r.rank = i + 1);
      setAssetNodes(rows);
    } catch (e) {
      console.error("Asset Reconciliation Fault:", e);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [registry]);

  useEffect(() => { 
    fetchNetworkFinancials();
    const poller = setInterval(() => fetchNetworkFinancials(true), 15000);
    return () => clearInterval(poller);
  }, [fetchNetworkFinancials]);

  const filteredNodes = useMemo(() => {
    return assetNodes.filter(a => 
      a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.schoolName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assetNodes, searchTerm]);

  return (
    <div className="animate-in fade-in duration-700 h-full flex flex-col font-sans pb-20 overflow-hidden">
      
      <div className="max-w-7xl mx-auto w-full">

         <div className="flex flex-col xl:flex-row justify-between items-center gap-8 mb-10">
            <div className="space-y-1">
               <h2 className="text-3xl font-black uppercase text-white tracking-tight leading-none">
                 {assetNodes.length} Verified Specialist Nodes
               </h2>
               <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Network-Wide Asset Ranking Matrix</p>
            </div>
            <div className="relative w-full md:w-96">
               <input 
                 type="text" 
                 placeholder="Search Specialist or Academy..." 
                 value={searchTerm} 
                 onChange={e=>setSearchTerm(e.target.value)} 
                 className="bg-slate-900 border border-slate-800 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20 w-full transition-all uppercase" 
               />
            </div>
         </div>

         <section className="bg-slate-900 border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl mb-12">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-20 border-b border-white/5">
                  <tr>
                     <th className="px-10 w-16 text-center">Rank</th>
                     <th className="px-10">Specialist Node & Academy Shard</th>
                     <th className="px-6 text-center">Questions</th>
                     <th className="px-6 text-center">Invigilation</th>
                     <th className="px-6 text-center">Marking</th>
                     <th className="px-10 text-right text-emerald-400">Net Asset</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {filteredNodes.map((node, i) => (
                     <tr key={i} className={`hover:bg-white/5 transition-all h-28 group ${i < 3 ? 'bg-blue-600/5' : ''}`}>
                        <td className="px-10 text-center">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xl ${node.rank <= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                              {node.rank}
                           </div>
                        </td>
                        <td className="px-10">
                           <span className="text-base font-black text-white uppercase group-hover:text-blue-400 transition-colors leading-none block">{node.fullName}</span>
                           <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-2">{node.schoolName}</p>
                        </td>
                        <td className="px-6 text-center">
                           <span className="text-sm font-black text-slate-300 font-mono">GHS {node.qBankAsset.toFixed(2)}</span>
                        </td>
                        <td className="px-6 text-center">
                           <span className="text-sm font-black text-slate-300 font-mono">GHS {node.invigAsset.toFixed(2)}</span>
                        </td>
                        <td className="px-6 text-center">
                           <span className="text-sm font-black text-slate-300 font-mono">GHS {node.markingAsset.toFixed(2)}</span>
                        </td>
                        <td className="px-10 text-right">
                           <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">GHS {node.liquidBalance.toFixed(2)}</span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </section>

         <div className="flex justify-between items-end pt-16 border-t-2 border-slate-900 bg-white/5 p-12 rounded-[4rem]">
            <div className="w-[35%] text-center border-t border-slate-700 pt-4">
               <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">
                <EditableField value="RECONCILIATION OFFICER" onChange={()=>{}} />
               </p>
            </div>
            <div className="w-[35%] text-center border-t border-slate-700 pt-4">
               <p className="font-black text-[14px] uppercase text-blue-400 leading-none">
                 <EditableField value={settings.headTeacherName} onChange={(v) => onSettingChange('headTeacherName', v)} />
               </p>
               <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none mt-1">NETWORK DIRECTOR</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default StaffFinancialsView;