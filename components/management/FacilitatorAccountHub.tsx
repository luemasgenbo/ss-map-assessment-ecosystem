import React, { useState, useEffect, useMemo } from 'react';
import { StaffAssignment, GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface Transaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  asset_type: 'MONETARY_GHS' | 'MERIT_TOKEN';
  amount: number;
  description: string;
  timestamp: string;
  status?: 'PENDING_HQ' | 'AWAITING_PHONE_AUTH' | 'DISBURSED' | 'REJECTED' | 'COMPLETED';
}

interface FacilitatorAccountHubProps {
  activeFacilitator: StaffAssignment;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
}

export default function FacilitatorAccountHub({ activeFacilitator, settings, onSettingChange }: FacilitatorAccountHubProps) {
  const [ledger, setLedger] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  
  // Itemized withdrawal state
  const [withdrawAmounts, setWithdrawAmounts] = useState({
    q: '',
    i: '',
    m: ''
  });
  
  const [momoNumber, setMomoNumber] = useState('');
  const [endpointNetwork, setEndpointNetwork] = useState('MTN MOBILE MONEY');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchFinancials = async () => {
    if (!activeFacilitator || !activeFacilitator.email) return;
    setIsLoading(true);
    try {
      const { data: ledgerData } = await supabase
        .from('uba_transaction_ledger')
        .select('*')
        .eq('identity_email', activeFacilitator.email.toLowerCase())
        .order('timestamp', { ascending: false });
      
      if (ledgerData) setLedger(ledgerData as Transaction[]);
    } catch (e) {
      console.error("Recall Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
    const interval = setInterval(fetchFinancials, 20000);
    return () => clearInterval(interval);
  }, [activeFacilitator.email]);

  const stats = useMemo(() => {
    const getNetVolume = (roleKey: string) => {
       return ledger
         .filter(t => t.description?.toUpperCase().includes(roleKey))
         .reduce((acc, t) => t.type === 'CREDIT' ? acc + t.amount : acc - t.amount, 0);
    };

    const qNet = getNetVolume('DEVELOPER');
    const iNet = getNetVolume('INVIGILATOR');
    const mNet = getNetVolume('EXAMINER');
    const availableTotal = qNet + iNet + mNet;

    return { 
      qEarnings: Math.max(0, qNet), 
      iEarnings: Math.max(0, iNet), 
      mEarnings: Math.max(0, mNet), 
      totalGross: ledger.filter(t => t.type === 'CREDIT').reduce((a,b) => a + b.amount, 0),
      availableBalance: Math.max(0, availableTotal)
    };
  }, [ledger]);

  const totalClaimAmount = useMemo(() => {
    return (parseFloat(withdrawAmounts.q) || 0) + (parseFloat(withdrawAmounts.i) || 0) + (parseFloat(withdrawAmounts.m) || 0);
  }, [withdrawAmounts]);

  const handleWithdrawShard = async () => {
    const amt = totalClaimAmount;
    if (isNaN(amt) || amt <= 0 || amt > stats.availableBalance) return alert("INVALID WITHDRAWAL: Check shard magnitude or available balance.");
    
    if ((parseFloat(withdrawAmounts.q) || 0) > stats.qEarnings) return alert("INSUFFICIENT SHARDS: Questions Bank balance exceeded.");
    if ((parseFloat(withdrawAmounts.i) || 0) > stats.iEarnings) return alert("INSUFFICIENT SHARDS: Invigilation Slots balance exceeded.");
    if ((parseFloat(withdrawAmounts.m) || 0) > stats.mEarnings) return alert("INSUFFICIENT SHARDS: Marking Proceeds balance exceeded.");
    
    if (!momoNumber || !activeFacilitator.email) return alert("HANDSHAKE ERROR: Provide target MoMo node number.");

    setIsProcessing(true);
    try {
      const ts = new Date().toISOString();
      const claimId = `claim_withdrawal_${activeFacilitator.email.replace(/[@.]/g, '_')}_${Date.now()}`;
      
      const payload = {
        id: claimId,
        email: activeFacilitator.email.toLowerCase(),
        name: activeFacilitator.name.toUpperCase(),
        hub_id: settings.schoolNumber,
        momoNumber,
        momoNetwork: endpointNetwork,
        amounts: { 
          questions: parseFloat(withdrawAmounts.q) || 0, 
          invigilation: parseFloat(withdrawAmounts.i) || 0, 
          marking: parseFloat(withdrawAmounts.m) || 0 
        },
        total: amt,
        status: 'PENDING_CLAIM_AUDIT',
        timestamp: ts,
        source: 'FACILITATOR_VAULT_WITHDRAWAL'
      };

      await supabase.from('uba_persistence').insert({
        id: claimId,
        hub_id: 'HQ-CLAIMS-UNIT',
        payload: payload,
        last_updated: ts
      });

      alert(`WITHDRAWAL PUSHED: GHS ${amt.toFixed(2)} claim sent to HQ Claims Unit for audit.`);
      setIsWithdrawModalOpen(false);
      setWithdrawAmounts({ q: '', i: '', m: '' });
      fetchFinancials();
    } catch (e: any) {
      alert("Withdrawal Fault: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseToken = (description: string) => {
    const match = description.match(/TOKEN:\s*\[(.*?)\]/);
    return match ? match[1] : 'SYSTEM';
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20 font-sans max-w-6xl mx-auto">
      
      <section className="relative overflow-hidden group space-y-10">
         <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -mr-40 -mt-40 blur-[120px]"></div>
         
         <div className="flex flex-col md:flex-row justify-between items-center bg-slate-950 p-10 rounded-[4rem] border border-white/5 shadow-2xl gap-8">
            <div className="space-y-4 flex-1">
               <h2 className="text-5xl font-black uppercase tracking-tighter leading-none text-white">{activeFacilitator.name}</h2>
               <div className="flex items-center gap-4">
                  <div className="bg-emerald-500/20 px-6 py-2 rounded-2xl border border-emerald-500/30 flex flex-col">
                     <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Available Payout</span>
                     <p className="text-3xl font-black text-white font-mono leading-none">GHS {stats.availableBalance.toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-500/20 px-6 py-2 rounded-2xl border border-blue-500/30 flex flex-col">
                     <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Lifetime Gross</span>
                     <p className="text-3xl font-black text-white font-mono leading-none">GHS {stats.totalGross.toFixed(2)}</p>
                  </div>
               </div>
            </div>
            <button 
              onClick={() => setIsWithdrawModalOpen(true)}
              disabled={stats.availableBalance < 0.01}
              className="bg-white text-blue-950 px-12 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-30 h-fit"
            >
              Withdraw Shard
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: 'Questions Bank (DEVELOPER)', val: stats.qEarnings, tag: 'DEVELOPER', color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
              { label: 'Invigilation Slots (INVIGILATOR)', val: stats.iEarnings, tag: 'INVIGILATOR', color: 'text-blue-400', bg: 'bg-blue-500/5' },
              { label: 'Marking Proceeds (EXAMINER)', val: stats.mEarnings, tag: 'EXAMINER', color: 'text-indigo-400', bg: 'bg-indigo-500/5' }
            ].map(card => (
              <div key={card.label} className={`p-8 rounded-[3rem] border border-white/5 shadow-2xl space-y-6 ${card.bg} transition-all hover:scale-[1.02] border-b-4 border-b-white/10`}>
                 <div className="flex justify-between items-center">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">{card.label}</h4>
                    <span className={`text-[8px] font-black ${card.color} border border-white/10 px-3 py-1 rounded-full uppercase`}>{card.tag}</span>
                 </div>
                 <p className={`text-3xl font-black font-mono ${card.color}`}>GHS {card.val.toFixed(2)}</p>
                 <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full bg-current opacity-30`} style={{ width: `${Math.min(100, (card.val / (stats.totalGross || 1)) * 100)}%` }}></div>
                 </div>
              </div>
            ))}
         </div>
      </section>

      {/* FINANCIAL LEDGER TABLE */}
      <section className="space-y-6">
         <div className="flex items-center justify-between px-6">
            <h3 className="text-xl font-black uppercase text-slate-900 tracking-tighter">Recent Activity Ledger</h3>
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Network Ledger Synchronized</span>
            </div>
         </div>
         
         <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-16 border-b border-white/10">
                     <th className="px-10">Timestamp</th>
                     <th className="px-6">Description / Shard Logic</th>
                     <th className="px-6 text-center">Security Token</th>
                     <th className="px-6 text-center">Type</th>
                     <th className="px-10 text-right">Magnitude (GHS)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {ledger.map((t, i) => {
                     const token = parseToken(t.description);
                     return (
                        <tr key={t.id || i} className="hover:bg-slate-50 transition-colors h-20">
                           <td className="px-10">
                              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                                 {new Date(t.timestamp).toLocaleDateString()}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500">
                                 {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                           </td>
                           <td className="px-6">
                              <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-2">
                                 {t.description.split('.')[0]}
                              </p>
                              <div className="flex items-center gap-2">
                                 <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                                    t.description.includes('DEVELOPER') ? 'bg-emerald-100 text-emerald-600' :
                                    t.description.includes('INVIGILATOR') ? 'bg-blue-100 text-blue-600' :
                                    t.description.includes('EXAMINER') ? 'bg-indigo-100 text-indigo-600' :
                                    'bg-gray-100 text-gray-600'
                                 }`}>
                                    {t.description.includes('DEVELOPER') ? 'DEVELOPER' : 
                                     t.description.includes('INVIGILATOR') ? 'INVIGILATOR' : 
                                     t.description.includes('EXAMINER') ? 'EXAMINER' : 'GENERAL'}
                                 </span>
                              </div>
                           </td>
                           <td className="px-6 text-center">
                              <span className={`font-mono text-[10px] font-black ${token === 'SYSTEM' ? 'text-slate-300' : 'text-blue-600'}`}>
                                 {token}
                              </span>
                           </td>
                           <td className="px-6 text-center">
                              <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${
                                 t.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                              }`}>
                                 {t.type}
                              </span>
                           </td>
                           <td className="px-10 text-right">
                              <span className={`text-sm font-black font-mono ${
                                 t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
                              }`}>
                                 {t.type === 'CREDIT' ? '+' : '-'} {t.amount.toFixed(2)}
                              </span>
                           </td>
                        </tr>
                     );
                  })}
                  {ledger.length === 0 && !isLoading && (
                     <tr>
                        <td colSpan={5} className="py-32 text-center opacity-20 flex flex-col items-center gap-4">
                           <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                           <p className="font-black uppercase text-xs tracking-widest">Vault Activity Vacant</p>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </section>

      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-4 overflow-y-auto">
           <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-8 text-slate-900 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="text-center space-y-1">
                 <h3 className="text-2xl font-black uppercase tracking-tight">Withdraw Shard</h3>
                 <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Vault to MoMo Handshake</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-3">
                   <div className="space-y-1">
                      <div className="flex justify-between items-end px-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Questions (DEVELOPER)</label>
                        <span className="text-[7px] font-bold text-emerald-600 uppercase">Avail: GHS {stats.qEarnings.toFixed(2)}</span>
                      </div>
                      <input 
                        type="number" 
                        value={withdrawAmounts.q} 
                        onChange={e => setWithdrawAmounts({...withdrawAmounts, q: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-lg font-black text-blue-900 outline-none focus:border-blue-500" 
                        placeholder="0.00"
                      />
                   </div>

                   <div className="space-y-1">
                      <div className="flex justify-between items-end px-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Invigilation (INVIGILATOR)</label>
                        <span className="text-[7px] font-bold text-blue-600 uppercase">Avail: GHS {stats.iEarnings.toFixed(2)}</span>
                      </div>
                      <input 
                        type="number" 
                        value={withdrawAmounts.i} 
                        onChange={e => setWithdrawAmounts({...withdrawAmounts, i: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-lg font-black text-blue-900 outline-none focus:border-blue-500" 
                        placeholder="0.00"
                      />
                   </div>

                   <div className="space-y-1">
                      <div className="flex justify-between items-end px-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Marking (EXAMINER)</label>
                        <span className="text-[7px] font-bold text-indigo-600 uppercase">Avail: GHS {stats.mEarnings.toFixed(2)}</span>
                      </div>
                      <input 
                        type="number" 
                        value={withdrawAmounts.m} 
                        onChange={e => setWithdrawAmounts({...withdrawAmounts, m: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-lg font-black text-blue-900 outline-none focus:border-blue-500" 
                        placeholder="0.00"
                      />
                   </div>
                </div>

                <div className="bg-blue-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center">
                   <span className="text-[9px] font-black uppercase tracking-widest">Total Claims Volume</span>
                   <span className="text-xl font-black font-mono">GHS {totalClaimAmount.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Endpoint Network</label>
                     <select 
                       value={endpointNetwork} 
                       onChange={e => setEndpointNetwork(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[9px] font-black text-blue-900 outline-none focus:border-blue-500 uppercase"
                     >
                        <option value="MTN MOBILE MONEY">MTN MOBILE MONEY</option>
                        <option value="VODAFONE CASH">VODAFONE CASH</option>
                        <option value="AIRTELTIGO MONEY">AIRTELTIGO MONEY</option>
                     </select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">MoMo Number</label>
                     <input 
                       type="text" 
                       value={momoNumber} 
                       onChange={e => setMomoNumber(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-blue-900 outline-none focus:border-blue-500" 
                       placeholder="024 XXX XXXX"
                     />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                 <button 
                   onClick={handleWithdrawShard} 
                   disabled={isProcessing || totalClaimAmount <= 0}
                   className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30"
                 >
                    {isProcessing ? 'SYNCHRONIZING...' : 'Push Withdrawal Claim'}
                 </button>
                 <button onClick={() => setIsWithdrawModalOpen(false)} className="w-full py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-950 transition-colors">Cancel Handshake</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
