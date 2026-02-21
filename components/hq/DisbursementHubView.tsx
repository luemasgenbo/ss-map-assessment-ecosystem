import React, { useState, useEffect, useMemo } from 'react';
import { SchoolRegistryEntry, ForwardingData, GlobalSettings, StaffApplication } from '../../types';
import { supabase } from '../../supabaseClient';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface ItemizedClaim {
  id: string;
  email: string;
  name: string;
  total: number;
  status: 'PENDING' | 'PENDING_CLAIM_AUDIT' | 'AUTHORIZED_FOR_SETTLEMENT' | 'DISBURSED' | 'REJECTED';
  timestamp: string;
  amounts: { questions: number, invigilation: number, marking: number };
  source?: string;
  hub_id?: string;
  momoNumber?: string;
  momoNetwork?: string;
  role?: string;
  dateStarted?: string;
  dateEnded?: string;
  dateConfirmed?: string;
  auditorToken?: string;
  auditorFeedback?: string;
}

export default function DisbursementHubView({ registry, settings, onSettingChange }: { 
  registry: SchoolRegistryEntry[], 
  settings: GlobalSettings,
  onSettingChange: (k: keyof GlobalSettings, v: any) => void
}) {
  const [inflows, setInflows] = useState<ForwardingData[]>([]);
  const [claims, setClaims] = useState<ItemizedClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeClaim, setActiveClaim] = useState<ItemizedClaim | null>(null);
  const [currentVaultStats, setCurrentVaultStats] = useState({ q: 0, i: 0, m: 0, total: 0 });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: fwds } = await supabase.from('uba_persistence').select('payload').like('id', 'forward_%');
      const fetchedInflows = fwds ? fwds.map(d => d.payload as ForwardingData) : [];
      const { data: clms } = await supabase.from('uba_persistence').select('payload').like('id', 'claim_%');
      const fetchedClaims = clms ? clms.map(d => d.payload as ItemizedClaim) : [];
      setInflows(fetchedInflows);
      setClaims(fetchedClaims);
    } catch (e) {
      console.error("Liability Sync Failure:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!activeClaim) {
      setCurrentVaultStats({ q: 0, i: 0, m: 0, total: 0 });
      return;
    }
    const fetchSpecialistBalance = async () => {
      const email = activeClaim.email.toLowerCase();
      const { data: ledger } = await supabase
        .from('uba_transaction_ledger')
        .select('*')
        .eq('identity_email', email);

      if (ledger) {
        const getNet = (key: string) => ledger
          .filter(l => l.description?.toUpperCase().includes(key))
          .reduce((sum, l) => l.type === 'CREDIT' ? sum + l.amount : sum - l.amount, 0);

        const q = getNet('DEVELOPER');
        const i = getNet('INVIGILATOR');
        const m = getNet('EXAMINER');
        setCurrentVaultStats({ q, i, m, total: q + i + m });
      }
    };
    fetchSpecialistBalance();
  }, [activeClaim]);

  const financialSummary = useMemo(() => {
    const totalIn = inflows.reduce((a, b) => a + (b.bulkPayment?.amount || 0), 0);
    const totalOut = claims.filter(c => c.status === 'DISBURSED').reduce((a, b) => a + b.total, 0);
    const pendingSettlement = claims.filter(c => c.status === 'AUTHORIZED_FOR_SETTLEMENT').reduce((a, b) => a + b.total, 0);
    return { networkInflows: totalIn, totalDisbursements: totalOut, authorizedLiabilities: pendingSettlement, netTreasury: totalIn - totalOut };
  }, [inflows, claims]);

  const handleExecuteDisbursement = async () => {
    if (!activeClaim) return;
    setIsProcessing(true);
    try {
      const ts = new Date().toISOString();
      const normalizedEmail = activeClaim.email.toLowerCase();
      const isWithdrawal = activeClaim.source === 'FACILITATOR_VAULT_WITHDRAWAL';
      
      const { data: ident } = await supabase.from('uba_identities').select('monetary_balance, full_name').eq('email', normalizedEmail).maybeSingle();
      if (!ident) throw new Error(`Identity Node ${normalizedEmail} not found.`);

      const currentBal = ident.monetary_balance || 0;
      const nextBal = isWithdrawal ? (currentBal - activeClaim.total) : (currentBal + activeClaim.total);
      if (isWithdrawal && nextBal < -0.01) throw new Error("Handshake Error: Projected vault balance cannot be negative.");

      await supabase.from('uba_identities').update({ monetary_balance: nextBal }).eq('email', normalizedEmail);
      await supabase.from('uba_persistence').update({ payload: { ...activeClaim, status: 'DISBURSED', dateConfirmed: ts.split('T')[0] }, last_updated: ts }).eq('id', activeClaim.id);

      const ledgerEntries = [];
      const tokenShard = activeClaim.auditorToken ? ` TOKEN: [${activeClaim.auditorToken}]` : '';
      const feedbackShard = activeClaim.auditorFeedback ? ` FEEDBACK: ${activeClaim.auditorFeedback}` : '';
      
      if (isWithdrawal) {
         if ((activeClaim.amounts.questions || 0) > 0) {
            ledgerEntries.push({
               identity_email: normalizedEmail, hub_id: activeClaim.hub_id || 'HQ-TREASURY',
               type: 'DEBIT', asset_type: 'MONETARY_GHS', event_category: 'PAYOUT_CLAIM',
               amount: activeClaim.amounts.questions, description: `WITHDRAWAL: Questions Bank (DEVELOPER) Payout Shard (-).${tokenShard}${feedbackShard}`,
               timestamp: ts, status: 'COMPLETED'
            });
         }
         if ((activeClaim.amounts.invigilation || 0) > 0) {
            ledgerEntries.push({
               identity_email: normalizedEmail, hub_id: activeClaim.hub_id || 'HQ-TREASURY',
               type: 'DEBIT', asset_type: 'MONETARY_GHS', event_category: 'PAYOUT_CLAIM',
               amount: activeClaim.amounts.invigilation, description: `WITHDRAWAL: Invigilation Slots (INVIGILATOR) Payout Shard (-).${tokenShard}${feedbackShard}`,
               timestamp: ts, status: 'COMPLETED'
            });
         }
         if ((activeClaim.amounts.marking || 0) > 0) {
            ledgerEntries.push({
               identity_email: normalizedEmail, hub_id: activeClaim.hub_id || 'HQ-TREASURY',
               type: 'DEBIT', asset_type: 'MONETARY_GHS', event_category: 'PAYOUT_CLAIM',
               amount: activeClaim.amounts.marking, description: `WITHDRAWAL: Marking Proceeds (EXAMINER) Payout Shard (-).${tokenShard}${feedbackShard}`,
               timestamp: ts, status: 'COMPLETED'
            });
         }
      } else {
         if ((activeClaim.amounts.questions || 0) > 0) {
            ledgerEntries.push({
               identity_email: normalizedEmail, hub_id: 'HQ-TREASURY', type: 'CREDIT', asset_type: 'MONETARY_GHS',
               event_category: 'REWARD_CREDIT', amount: activeClaim.amounts.questions, 
               description: `HQ DISBURSEMENT: Questions Bank (DEVELOPER) Payout Shard (+).${tokenShard}${feedbackShard}`, 
               timestamp: ts, status: 'COMPLETED'
            });
         }
         if ((activeClaim.amounts.invigilation || 0) > 0) {
            ledgerEntries.push({
               identity_email: normalizedEmail, hub_id: 'HQ-TREASURY', type: 'CREDIT', asset_type: 'MONETARY_GHS',
               event_category: 'REWARD_CREDIT', amount: activeClaim.amounts.invigilation, 
               description: `HQ DISBURSEMENT: Invigilation Slots (INVIGILATOR) Payout Shard (+).${tokenShard}${feedbackShard}`, 
               timestamp: ts, status: 'COMPLETED'
            });
         }
         if ((activeClaim.amounts.marking || 0) > 0) {
            ledgerEntries.push({
               identity_email: normalizedEmail, hub_id: 'HQ-TREASURY', type: 'CREDIT', asset_type: 'MONETARY_GHS',
               event_category: 'REWARD_CREDIT', amount: activeClaim.amounts.marking, 
               description: `HQ DISBURSEMENT: Marking Proceeds (EXAMINER) Payout Shard (+).${tokenShard}${feedbackShard}`, 
               timestamp: ts, status: 'COMPLETED'
            });
         }
      }

      if (ledgerEntries.length > 0) await supabase.from('uba_transaction_ledger').insert(ledgerEntries);

      alert(`SETTLEMENT SUCCESS: GHS ${activeClaim.total.toFixed(2)} settled.`);
      setActiveClaim(null);
      await fetchData();
    } catch (e: any) {
      alert("Disbursement Fault: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 font-sans pb-32">
      

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
         <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] shadow-sm hover:border-blue-500/30 transition-all">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Network Inflows</span>
            <p className="text-3xl font-black text-white font-mono leading-none">GHS {financialSummary.networkInflows.toLocaleString()}</p>
         </div>
         <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] shadow-sm hover:border-red-500/30 transition-all">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Settled Total</span>
            <p className="text-3xl font-black text-red-500 font-mono leading-none">GHS {financialSummary.totalDisbursements.toLocaleString()}</p>
         </div>
         <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] shadow-sm hover:border-indigo-500/30 transition-all">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Liabilities Authorized</span>
            <p className="text-3xl font-black text-indigo-500 font-mono leading-none">GHS {financialSummary.authorizedLiabilities.toLocaleString()}</p>
         </div>
         <div className="bg-blue-900 border border-blue-800 p-8 rounded-[2.5rem] shadow-xl text-white">
            <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest block mb-2">Net Treasury Assets</span>
            <p className="text-3xl font-black font-mono leading-none">GHS {financialSummary.netTreasury.toLocaleString()}</p>
         </div>
      </div>

      <section className="space-y-6 max-w-7xl mx-auto w-full">
         <div className="flex items-center justify-between px-6">
            <h3 className="text-xl font-black uppercase text-emerald-400 tracking-tighter">Authorized Settlement Queue</h3>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{claims.filter(c => c.status === 'AUTHORIZED_FOR_SETTLEMENT').length} Authorized Shards</span>
         </div>
         <div className="bg-slate-900 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-16 border-b border-white/10">
                  <tr>
                     <th className="px-10">Specialist Identity</th>
                     <th className="px-6">Status / Security Shard</th>
                     <th className="px-6 text-center">Audit Actions</th>
                     <th className="px-10 text-right">Debit Magnitude</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {claims.filter(c => c.status === 'AUTHORIZED_FOR_SETTLEMENT').map((clm) => (
                     <tr key={clm.id} className="hover:bg-white/5 transition-colors h-28">
                        <td className="px-10">
                           <p className="text-xs font-black text-white uppercase">{clm.name}</p>
                           <p className="text-[9px] font-mono text-slate-500 mt-2 uppercase tracking-tighter">{clm.email}</p>
                        </td>
                        <td className="px-6">
                           <div className="flex flex-col gap-1">
                              <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">TOKEN_KEY: [ {clm.auditorToken || 'SYSTEM'} ]</span>
                              <span className="text-[9px] font-black text-slate-400 uppercase italic truncate max-w-[200px]">{clm.auditorFeedback || 'Authorized Handshake'}</span>
                           </div>
                        </td>
                        <td className="px-6 text-center">
                           <button onClick={() => setActiveClaim(clm)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-full text-[8px] font-black uppercase shadow-lg active:scale-95 transition-all">FINAL SETTLE</button>
                        </td>
                        <td className="px-10 text-right">
                           <span className="text-sm font-black font-mono text-emerald-400">GHS {clm.total.toFixed(2)}</span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </section>

      {activeClaim && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-3xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Final Settlement Gate</h3>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Handshake Protocol: [ {activeClaim.auditorToken || 'SYSTEM'} ]</p>
                 </div>
                 <button onClick={() => setActiveClaim(null)} className="text-slate-500 hover:text-white transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
              </div>

              <div className="p-10 space-y-8 text-slate-900">
                 <div className="grid grid-cols-2 gap-y-4 gap-x-10 border-b border-gray-100 pb-6">
                    <div className="space-y-1">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Payee Identity</span>
                       <p className="text-sm font-black text-blue-900 uppercase leading-none">{activeClaim.name}</p>
                    </div>
                    <div className="space-y-1 text-right">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Authorization Token</span>
                       <p className="text-sm font-black text-emerald-600 font-mono">{activeClaim.auditorToken || '---'}</p>
                    </div>
                 </div>

                 <div className="bg-blue-950 text-white p-8 rounded-[3rem] shadow-2xl flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative text-right">
                       <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Final Settlement:</span>
                       <p className="text-4xl font-black font-mono text-emerald-400 leading-none">GHS {activeClaim.total.toFixed(2)}</p>
                    </div>
                 </div>

                 <button onClick={handleExecuteDisbursement} disabled={isProcessing} className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all hover:bg-black">
                    {isProcessing ? 'SYNCHRONIZING LEDGER...' : `Settle & Dispatch GHS ${activeClaim.total.toFixed(2)}`}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
