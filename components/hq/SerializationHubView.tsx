
import React, { useState, useEffect, useMemo } from 'react';
import { SchoolRegistryEntry, SerializationData, SerializedPupil, ForwardingData } from '../../types';
import { supabase } from '../../supabaseClient';

interface SerializationHubViewProps {
  registry: SchoolRegistryEntry[];
  onLogAction: (action: string, target: string, details: string) => void;
}

const SerializationHubView: React.FC<SerializationHubViewProps> = ({ registry, onLogAction }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedMock, setSelectedMock] = useState('MOCK 1');
  const [forwardRequests, setForwardRequests] = useState<ForwardingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSerialization, setActiveSerialization] = useState<SerializationData | null>(null);

  const fetchForwardRequests = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('uba_school_forwarding').select('*');
      if (data) setForwardRequests(data.map(d => ({
        schoolId: d.school_id,
        schoolName: d.school_name,
        submissionTimestamp: d.submission_timestamp,
        approvalStatus: d.approval_status,
        feedback: d.feedback,
        bulkPayment: { amount: d.bulk_payment_amount, transactionId: d.transaction_id },
        ...(d.payload || {})
      }) as ForwardingData));
    } catch (e) {
      console.error("Recall Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchForwardRequests(); }, []);

  const selectedRequest = useMemo(() => forwardRequests.find(r => r.schoolId === selectedSchoolId), [forwardRequests, selectedSchoolId]);
  const selectedSchool = registry.find(r => r.id === selectedSchoolId);

  // Summarize languages for the auditor
  const languageSummary = useMemo(() => {
    if (!selectedRequest) return null;
    const counts: Record<string, number> = {};
    // Fix: cast to string[] to resolve 'unknown' index type error in counts[lang]
    (Object.values(selectedRequest.pupilLanguages) as string[]).forEach(lang => {
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return counts;
  }, [selectedRequest]);

  const handleApproveHandshake = async () => {
    if (!selectedSchoolId || !selectedRequest) return;
    setIsProcessing(true);
    try {
      const ts = new Date().toISOString();
      
      await supabase.from('uba_school_forwarding').update({
        approval_status: 'APPROVED',
        submission_timestamp: ts
      }).eq('school_id', selectedSchoolId);

      setForwardRequests(prev => prev.map(r => r.schoolId === selectedSchoolId ? { ...r, approvalStatus: 'APPROVED' } : r));
      onLogAction("HANDSHAKE_VERIFIED", selectedSchoolId, `Payment token ${selectedRequest.bulkPayment?.transactionId} and languages verified.`);
      alert("HANDSHAKE ACCEPTED: Institutional node marked as PAID and eligible for serialization.");
    } catch (e: any) {
      alert("Approval Fault: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSerialization = async () => {
    if (!selectedSchoolId || !selectedRequest) return;
    if (selectedRequest.approvalStatus !== 'APPROVED') return alert("PROTOCOL ERROR: Handshake must be verified and approved before serialization.");
    
    setIsProcessing(true);
    try {
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      const schoolCode = selectedSchoolId.slice(-3).toUpperCase();
      
      // Generate Serialized Pupil Shards
      const serializedPupils: SerializedPupil[] = Object.keys(selectedRequest.pupilPayments).map((pIdStr, i) => {
        const pId = parseInt(pIdStr);
        const serials: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
        const serial = serials[i % 5];
        return {
          id: pId,
          name: "CANDIDATE NODE", // Real name inherited by the local app during mirror
          serial,
          questionCode: `${selectedSchoolId}/M${selectedMock.split(' ')[1]}/${serial}/${pId}`,
          indexNumber: `${schoolCode}${yearSuffix}${pId.toString().padStart(4, '0')}`
        };
      });

      const serializationPayload: SerializationData = {
        schoolId: selectedSchoolId,
        schoolName: selectedSchool?.name || "Unknown",
        mockSeries: selectedMock,
        startDate: new Date().toLocaleDateString(),
        examinerName: "NETWORK REGISTRY",
        chiefExaminerName: "HQ CONTROLLER",
        pupils: serializedPupils,
        timestamp: new Date().toISOString()
      };

      // 1. Push serialization shard
      await supabase.from('uba_persistence').upsert({
        id: `serialization_${selectedSchoolId}_${selectedMock.replace(/\s+/g, '')}`,
        hub_id: selectedSchoolId,
        payload: serializationPayload,
        last_updated: new Date().toISOString()
      });

      // 2. Mirror Index/PINs to uba_identities for Pupil Login
      const identityShards = serializedPupils.map(p => ({
        email: `${p.indexNumber?.toLowerCase()}@uba.internal`,
        full_name: p.name,
        node_id: p.indexNumber!,
        hub_id: selectedSchoolId,
        role: 'pupil',
        unique_code: Math.floor(100000 + Math.random() * 900000).toString() // 6-digit Private PIN
      }));

      await supabase.from('uba_identities').upsert(identityShards, { onConflict: 'node_id' });

      // 3. Finalize forwarding status
      await supabase.from('uba_school_forwarding').update({
        approval_status: 'SERIALIZED',
        submission_timestamp: new Date().toISOString()
      }).eq('school_id', selectedSchoolId);

      setActiveSerialization(serializationPayload);
      onLogAction("EXAM_SERIALIZATION", selectedSchoolId, `Generated ${serializedPupils.length} identity codes.`);
      alert("SERIALIZATION SUCCESSFUL: Index numbers and PINs projected to the institutional registry.");
      fetchForwardRequests();
    } catch (err: any) {
      alert(`Serialization Fault: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-700 h-full flex flex-col font-sans min-h-screen">
      
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black uppercase text-white tracking-tighter flex items-center gap-4">
             <div className="w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)] animate-pulse"></div>
             Serialization Command Hub
          </h2>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Integrated Handshake Verification & Endorsement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 overflow-hidden">
         
         {/* LEFT: FORWARDED QUEUE */}
         <div className="xl:col-span-4 flex flex-col gap-6">
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[3.5rem] shadow-2xl flex-1 flex flex-col overflow-hidden">
               <div className="flex justify-between items-center border-b border-slate-800 pb-5 mb-5">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Forwarding Shards</h3>
                  <button onClick={fetchForwardRequests} className="text-[8px] font-black text-slate-500 hover:text-white transition-colors">SYNC QUEUE</button>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                  {forwardRequests.map(r => (
                    <button 
                      key={r.schoolId} 
                      onClick={() => setSelectedSchoolId(r.schoolId)} 
                      className={`w-full p-6 rounded-[2rem] border text-left transition-all ${selectedSchoolId === r.schoolId ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                    >
                       <p className="text-[13px] font-black text-white uppercase truncate">{r.schoolName}</p>
                       <div className="flex justify-between items-center mt-3">
                          <span className="text-[7px] font-mono text-white/40">{r.schoolId}</span>
                          <span className={`text-[7px] font-black px-2 py-0.5 rounded uppercase ${
                            r.approvalStatus === 'SERIALIZED' ? 'bg-emerald-600 text-white' : 
                            r.approvalStatus === 'APPROVED' ? 'bg-blue-600 text-white' : 
                            'bg-amber-600/20 text-amber-500'
                          }`}>
                             {r.approvalStatus}
                          </span>
                       </div>
                    </button>
                  ))}
               </div>
            </div>
         </div>

         {/* RIGHT: AUDIT & EXECUTION TERMINAL */}
         <div className="xl:col-span-8 flex flex-col gap-8">
            {selectedRequest ? (
               <div className="bg-slate-900 border border-white/5 rounded-[3.5rem] p-10 shadow-2xl space-y-10 flex-1 flex flex-col animate-in slide-in-from-right-4 overflow-y-auto no-scrollbar">
                  
                  {/* HEADER & STATUS */}
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-8 gap-8">
                     <div className="space-y-1">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.5em]">Institutional Node Audit</span>
                        <h4 className="text-3xl font-black text-white uppercase tracking-tight leading-none">{selectedRequest.schoolName}</h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Dispatched: {new Date(selectedRequest.submissionTimestamp).toLocaleString()}</p>
                     </div>
                     <div className="flex gap-3">
                        {selectedRequest.approvalStatus === 'PENDING' && (
                           <button 
                             onClick={handleApproveHandshake}
                             disabled={isProcessing}
                             className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 disabled:opacity-30"
                           >
                             Verify & Accept Paid
                           </button>
                        )}
                        {selectedRequest.approvalStatus === 'APPROVED' && (
                           <button 
                             onClick={handleExecuteSerialization}
                             disabled={isProcessing}
                             className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-5 rounded-2xl font-black text-[10px] uppercase shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-95 disabled:opacity-30"
                           >
                             Push for Serialization
                           </button>
                        )}
                        {selectedRequest.approvalStatus === 'SERIALIZED' && (
                           <div className="bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                              Node Serialized
                           </div>
                        )}
                     </div>
                  </div>

                  {/* AUDIT CARDS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     {/* FINANCIAL HANDSHAKE CARD */}
                     <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                           <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                           <h5 className="text-[11px] font-black text-white uppercase tracking-widest">Financial Shard Verification</h5>
                        </div>
                        <div className="space-y-4">
                           <div className="flex justify-between items-end">
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Transaction ID (Token)</span>
                              <span className="text-sm font-mono font-black text-emerald-400">{selectedRequest.bulkPayment?.transactionId || 'INDIVIDUAL'}</span>
                           </div>
                           <div className="flex justify-between items-end">
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Liquidation Magnitude</span>
                              <span className="text-xl font-black text-white font-mono">GHS {selectedRequest.bulkPayment?.amount.toFixed(2)}</span>
                           </div>
                           <div className="pt-4 border-t border-white/5 italic">
                              <p className="text-[9px] text-slate-400 uppercase leading-relaxed font-bold">"Verification of this token authorizes the push for pupil identity generation."</p>
                           </div>
                        </div>
                     </div>

                     {/* LANGUAGE & ROSTER CARD */}
                     <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                           <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                           <h5 className="text-[11px] font-black text-white uppercase tracking-widest">Roster & Language Audit</h5>
                        </div>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Roster Volume</span>
                              <span className="bg-blue-900/40 text-blue-400 px-4 py-1 rounded-xl text-xs font-black">{Object.keys(selectedRequest.pupilPayments).length} Pupils</span>
                           </div>
                           <div className="space-y-2">
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Language Distribution</span>
                              <div className="flex flex-wrap gap-2">
                                 {languageSummary && Object.entries(languageSummary).map(([lang, count]) => (
                                    <div key={lang} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-3">
                                       <span className="text-[9px] font-black text-white">{lang}</span>
                                       <span className="w-px h-3 bg-white/10"></span>
                                       <span className="text-[10px] font-black text-blue-400 font-mono">{count}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* FEEDBACK SHARD */}
                  <div className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-white/5 italic">
                     <span className="text-[9px] font-black text-slate-500 uppercase block mb-3 tracking-widest">Institutional Feedback Shard:</span>
                     <p className="text-sm font-medium text-slate-300 leading-relaxed uppercase">"{selectedRequest.feedback || 'System handshake synchronized without manual context.'}"</p>
                  </div>

               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-20 border-4 border-dashed border-slate-800 rounded-[4rem]">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <p className="text-white font-black uppercase text-sm tracking-[0.5em] mt-8">Select Institutional Forwarding Shard</p>
               </div>
            )}
         </div>
      </div>

      <footer className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.5em] text-slate-600 no-print">
         <span>Master Hub Endpoint: HQ-CLUSTER-01</span>
         <span className="bg-white/5 px-6 py-2 rounded-full border border-white/5">Handshake Integrity Verified — 2026</span>
      </footer>
    </div>
  );
};

export default SerializationHubView;
