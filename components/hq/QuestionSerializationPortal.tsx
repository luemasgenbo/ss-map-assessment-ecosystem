import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  SchoolRegistryEntry, 
  SerializedExam, 
  QuestionPack, 
  MasterQuestion,
  ForwardingData
} from '../../types';
import { SUBJECT_LIST } from '../../constants';

interface IngestionItem {
  id: string;
  type: 'OBJECTIVE' | 'THEORY';
  strand: string;
  subStrand: string;
  indicator: string;
  questionText: string;
  instruction: string;
  correctKey: string;
  answerScheme: string;
  weight: number;
  blooms: string;
  ghanaianLanguageTag?: string;
}

interface EmbossmentHistoryEntry {
  id: string;
  schoolName: string;
  schoolId: string;
  subject: string;
  mockSeries: string;
  paymentRef: string;
  studentCount: number;
  timestamp: string;
  languages: Record<string, string>;
  pupilList: any[];
  variants: string[]; // List of variant keys A-E
}

const QuestionSerializationPortal: React.FC<{ registry: SchoolRegistryEntry[] }> = ({ registry }) => {
  const [selectedSubject, setSelectedSubject] = useState(SUBJECT_LIST[0]);
  const [selectedMock, setSelectedMock] = useState('MOCK 1');
  const [activeTab, setActiveTab] = useState<'INGESTION' | 'PACKS' | 'EMBOSSING' | 'HISTORY'>('INGESTION');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  
  const [ingestionList, setIngestionList] = useState<IngestionItem[]>([]);
  const [historyList, setHistoryList] = useState<EmbossmentHistoryEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serializedData, setSerializedData] = useState<SerializedExam | null>(null);
  const [forwardRequests, setForwardRequests] = useState<ForwardingData[]>([]);

  const bufferId = `ingestion_buffer_${selectedSubject.replace(/\s+/g, '')}`;

  useEffect(() => {
    const fetchData = async () => {
      const { data: buffer } = await supabase.from('uba_persistence').select('payload').eq('id', bufferId).maybeSingle();
      if (buffer?.payload) setIngestionList(buffer.payload as IngestionItem[]);
      else setIngestionList([]);

      const { data: history } = await supabase.from('uba_persistence').select('payload').eq('id', 'global_embossment_history').maybeSingle();
      if (history?.payload) setHistoryList(history.payload as EmbossmentHistoryEntry[]);

      const { data: fwds } = await supabase.from('uba_persistence').select('payload').like('id', 'forward_%');
      if (fwds) setForwardRequests(fwds.map(d => d.payload as ForwardingData));
    };
    fetchData();
  }, [selectedSubject, bufferId]);

  useEffect(() => {
    const fetchExistingSerialization = async () => {
       const mockKey = selectedMock.replace(/\s+/g, '');
       const subKey = selectedSubject.replace(/\s+/g, '');
       const { data } = await supabase.from('uba_persistence').select('payload').eq('id', `global_serialized_${mockKey}_${subKey}`).maybeSingle();
       if (data?.payload) setSerializedData(data.payload as SerializedExam);
       else setSerializedData(null);
    };
    fetchExistingSerialization();
  }, [selectedSubject, selectedMock]);

  const handlePurgeIngestionBuffer = async () => {
    if (!window.confirm("CRITICAL: Wipe entire subject ingestion buffer?")) return;
    await supabase.from('uba_persistence').delete().eq('id', bufferId);
    setIngestionList([]);
  };

  const handleExecuteSerialization = async () => {
    if (ingestionList.length === 0) return alert("Populate Ingestion List first.");
    setIsProcessing(true);
    try {
      const mockKey = selectedMock.replace(/\s+/g, '');
      const subKey = selectedSubject.replace(/\s+/g, '');

      const generateShuffledVariant = (v: 'A' | 'B' | 'C' | 'D' | 'E'): QuestionPack => {
         const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);
         const objs = ingestionList.filter(i => i.type === 'OBJECTIVE').map(i => ({ ...i, originalIndex: 0, parts: [] } as unknown as MasterQuestion));
         const theories = ingestionList.filter(i => i.type === 'THEORY').map(i => ({ ...i, originalIndex: 0, parts: [] } as unknown as MasterQuestion));

         return {
           variant: v,
           generalRules: 'Attempt all questions. Precision is required.',
           sectionInstructions: { A: 'Multiple Choice.', B: 'Theoretical Analysis.' },
           objectives: shuffle(objs),
           theory: shuffle(theories),
           schemeCode: `HQ-${v}-${Date.now().toString(36).toUpperCase()}`,
           matchingMatrix: {}
         };
      };

      const examData: SerializedExam = {
        schoolId: 'NETWORK-HQ',
        mockSeries: selectedMock,
        subject: selectedSubject,
        packs: {
          A: generateShuffledVariant('A'), B: generateShuffledVariant('B'),
          C: generateShuffledVariant('C'), D: generateShuffledVariant('D'),
          E: generateShuffledVariant('E')
        },
        timestamp: new Date().toISOString()
      };

      await supabase.from('uba_persistence').upsert({
        id: `global_serialized_${mockKey}_${subKey}`,
        hub_id: 'HQ-HUB',
        payload: examData,
        last_updated: new Date().toISOString()
      });

      setSerializedData(examData);
      alert("SERIALIZATION COMPLETE: 5 variants generated for the network.");
      setActiveTab('PACKS');
    } catch (e) {
      alert("Serialization Error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTextPack = (variantKey: 'A' | 'B' | 'C' | 'D' | 'E', includeAnswers: boolean) => {
    if (!serializedData) return;
    const pack = serializedData.packs[variantKey];
    let content = `UNITED BAYLOR ACADEMY - ${serializedData.subject.toUpperCase()}\n`;
    content += `SERIES: ${serializedData.mockSeries} | VARIANT: ${variantKey}\n`;
    content += `TYPE: ${includeAnswers ? 'MASTER (+ANS)' : 'GENERIC (NO ANS)'}\n`;
    content += `================================================================\n\n`;

    content += `SECTION A: OBJECTIVES\n`;
    pack.objectives.forEach((q, i) => {
      content += `${i + 1}. ${q.questionText}\n`;
      const opts = q.answerScheme.split('|');
      if (opts.length === 4) {
        content += `   A. ${opts[0]}   B. ${opts[1]}\n   C. ${opts[2]}   D. ${opts[3]}\n`;
      }
      if (includeAnswers) content += `   >> KEY: ${q.correctKey}\n`;
      content += `\n`;
    });

    content += `\nSECTION B: THEORY\n`;
    pack.theory.forEach((q, i) => {
      content += `QUESTION ${i + 1}\n${q.questionText}\n`;
      if (includeAnswers) content += `\n>> MARKING SCHEME:\n${q.answerScheme}\n`;
      content += `\n----------------------------------------------------------\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${serializedData.subject}_VAR_${variantKey}_${includeAnswers ? 'MASTER' : 'GENERIC'}.txt`;
    link.click();
  };

  const handleExecuteEmbossment = async () => {
    if (!selectedInstitution) return alert("Select institution first.");
    if (!serializedData) return alert("Run Global Serialization first.");
    
    setIsProcessing(true);
    try {
      const mockKey = selectedMock.replace(/\s+/g, '');
      const subKey = selectedSubject.replace(/\s+/g, '');
      const schoolsToPush = selectedInstitution === 'ALL_NETWORK_NODES' ? registry : registry.filter(r => r.id === selectedInstitution);
      
      const newHistoryEntries: EmbossmentHistoryEntry[] = [];

      for (const school of schoolsToPush) {
        await supabase.from('uba_persistence').upsert({
           id: `special_mock_${school.id}_${mockKey}_${subKey}`,
           hub_id: school.id,
           payload: serializedData,
           last_updated: new Date().toISOString()
        });

        const request = forwardRequests.find(f => f.schoolId === school.id);
        const pupils = request ? Object.keys(request.pupilPayments).map((id, i) => ({
           id,
           serial: (['A','B','C','D','E'] as const)[i % 5],
           lang: request.pupilLanguages[parseInt(id)] || 'N/A'
        })) : [];

        newHistoryEntries.push({
           id: `HIST-${Date.now()}-${school.id}`,
           schoolName: school.name,
           schoolId: school.id,
           subject: selectedSubject,
           mockSeries: selectedMock,
           paymentRef: request?.bulkPayment?.transactionId || 'INDIVIDUAL',
           studentCount: school.studentCount || 0,
           timestamp: new Date().toISOString(),
           languages: request?.pupilLanguages || {},
           pupilList: pupils,
           variants: ['A','B','C','D','E']
        });
      }

      const nextHistory = [...newHistoryEntries, ...historyList];
      await supabase.from('uba_persistence').upsert({
         id: 'global_embossment_history',
         hub_id: 'HQ-HUB',
         payload: nextHistory,
         last_updated: new Date().toISOString()
      });
      setHistoryList(nextHistory);

      alert(`EMBOSSMENT SUCCESS: Serialization shard pushed to ${schoolsToPush.length} node(s). History archived.`);
    } catch (e) {
      alert("Embossment Handshake Error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAuditDocument = (entry: EmbossmentHistoryEntry) => {
     let doc = `UNITED BAYLOR ACADEMY - OFFICIAL EMBOSSMENT AUDIT DOCUMENT\n`;
     doc += `==========================================================\n\n`;
     doc += `INSTITUTION:      ${entry.schoolName.toUpperCase()}\n`;
     doc += `NODE ID:          ${entry.schoolId}\n`;
     doc += `SUBJECT:          ${entry.subject.toUpperCase()}\n`;
     doc += `SERIES:           ${entry.mockSeries}\n`;
     doc += `PAYMENT REF:      ${entry.paymentRef}\n`;
     doc += `NUMBER ON ROLL:   ${entry.studentCount}\n`;
     doc += `DATE EMBOSSED:    ${new Date(entry.timestamp).toLocaleString()}\n\n`;
     
     doc += `PUPIL INDEX REGISTRY & VARIANT ASSIGNMENT:\n`;
     doc += `----------------------------------------------------------\n`;
     doc += `ID       | VARIANT | LANGUAGE OPTION\n`;
     entry.pupilList.forEach(p => {
        doc += `${p.id.padEnd(8)} | ${p.serial.padEnd(7)} | ${p.lang}\n`;
     });
     doc += `\n`;

     doc += `VARIANT COMPOSITION (A-E) METADATA:\n`;
     doc += `----------------------------------------------------------\n`;
     entry.variants.forEach(v => {
        const pack = serializedData?.packs[v as keyof typeof serializedData.packs];
        doc += `VARIANT ${v} KEY SHARD:\n`;
        if (pack) {
           pack.objectives.forEach((q: MasterQuestion, i: number) => {
              doc += ` Q${i+1}: ${q.correctKey} |`;
           });
        }
        doc += `\n\n`;
     });

     doc += `==========================================================\n`;
     doc += `AUDIT END | HQ MASTER SIGNATURE: ${entry.timestamp}\n`;

     const blob = new Blob([doc], { type: 'text/plain' });
     const link = document.createElement('a');
     link.href = URL.createObjectURL(blob);
     link.download = `Audit_${entry.schoolId}_${entry.subject.replace(/\s/g,'_')}.txt`;
     link.click();
  };

  return (
    <div className="animate-in fade-in duration-700 h-full flex flex-col text-slate-100 overflow-hidden font-sans">
      
      {/* BRANDING HEADER */}
      <div className="mb-10 border-b border-slate-800 pb-10">
         <div className="flex items-center gap-6 mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div>
               <h1 className="text-4xl font-black uppercase text-white tracking-tighter leading-none">Master Hub Serialization</h1>
               <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.5em] mt-2">Integrated Variant & Embossment Engine</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-1.5 md:col-span-1">
               <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject Shard</label>
               <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-4 focus:ring-blue-500/10">
                  {SUBJECT_LIST.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
               </select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
               <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Series Focus</label>
               <select value={selectedMock} onChange={e => setSelectedMock(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-4 focus:ring-blue-500/10">
                  {Array.from({length: 10}, (_, i) => `MOCK ${i+1}`).map(m => <option key={m} value={m}>{m}</option>)}
               </select>
            </div>
            <div className="md:col-span-2">
               <button 
                  onClick={handleExecuteSerialization} 
                  disabled={isProcessing} 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95 disabled:opacity-50"
               >
                  {isProcessing ? 'PROCESSING SHARDS...' : 'Run Global Serialization'}
               </button>
            </div>
         </div>
      </div>

      {/* TAB SYSTEM */}
      <div className="flex bg-slate-900/50 p-2 rounded-3xl border border-slate-800 mb-8 self-start gap-2 shadow-inner">
         {[
           { id: 'INGESTION', label: 'Ingestion' },
           { id: 'PACKS', label: 'Variant Packs' },
           { id: 'EMBOSSING', label: 'Paper Embossing' },
           { id: 'HISTORY', label: 'Emboss History' }
         ].map(t => (
           <button 
             key={t.id} 
             onClick={() => setActiveTab(t.id as any)} 
             className={`px-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === t.id ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white'}`}
           >
              {t.label}
           </button>
         ))}
      </div>

      {activeTab === 'INGESTION' && (
        <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in">
           <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl flex-1 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                 <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Active Ingestion List ({ingestionList.length})</h4>
                 <button onClick={handlePurgeIngestionBuffer} className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest">Wipe Buffer</button>
              </div>
              <div className="overflow-y-auto no-scrollbar flex-1">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900/50 sticky top-0 z-10 text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] border-b border-slate-800 h-16">
                       <tr>
                          <th className="px-6 text-center w-16">Sec</th>
                          <th className="px-4 text-center w-16">Q#</th>
                          <th className="px-6">Content & Instructions</th>
                          <th className="px-6 w-56">Assessment Key/Parts</th>
                          <th className="px-6 w-32 text-right pr-12">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                       {ingestionList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-blue-900/5 group transition-colors min-h-[100px]">
                             <td className="px-6 text-center">
                                <span className={`px-2 py-1 rounded text-[11px] font-black ${item.type === 'OBJECTIVE' ? 'bg-blue-600/10 text-blue-400' : 'bg-indigo-600/10 text-indigo-400'}`}>
                                   {item.type === 'OBJECTIVE' ? 'A' : 'B'}
                                </span>
                             </td>
                             <td className="px-4 text-center font-mono font-black text-slate-500 text-lg">
                                {(idx + 1).toString().padStart(2, '0')}
                             </td>
                             <td className="px-6 py-4 space-y-3">
                                <div className="flex items-center gap-3">
                                   <p className="text-[12px] font-bold text-slate-200 uppercase leading-relaxed">{item.questionText}</p>
                                   {item.ghanaianLanguageTag && (
                                      <span className="shrink-0 bg-emerald-600 text-white px-2 py-0.5 rounded-[4px] text-[7px] font-black uppercase shadow-lg border border-emerald-400/50">{item.ghanaianLanguageTag}</span>
                                   )}
                                </div>
                                {item.type === 'OBJECTIVE' && (
                                   <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      {item.answerScheme.split('|').map((opt, oi) => (
                                         <p key={oi} className="text-[9px] font-bold text-slate-500 uppercase">
                                            <span className="text-blue-500 mr-1">{['A','B','C','D'][oi]}.</span> {opt}
                                         </p>
                                      ))}
                                   </div>
                                )}
                             </td>
                             <td className="px-6">
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center">
                                   <span className="text-[7px] font-black text-slate-600 uppercase block mb-1">Assessment Matrix</span>
                                   <p className="text-[11px] font-black text-emerald-400 uppercase truncate">
                                      {item.type === 'OBJECTIVE' ? `KEY: ${item.correctKey}` : 'SCHEME DEFINED'}
                                   </p>
                                </div>
                             </td>
                             <td className="px-6 text-right pr-12">
                                <button onClick={()=>setIngestionList(prev=>prev.filter(x=>x.id!==item.id))} className="text-slate-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all">
                                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'PACKS' && (
         <div className="flex-1 overflow-y-auto no-scrollbar animate-in slide-in-from-right-4 duration-500">
            {serializedData ? (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                  {(['A','B','C','D','E'] as const).map(v => (
                     <div key={v} className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center text-center space-y-6 group hover:border-blue-500 transition-all">
                        <div className="w-20 h-20 bg-blue-600/10 rounded-[2rem] flex items-center justify-center font-black text-3xl text-blue-500 border border-blue-500/20 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                           {v}
                        </div>
                        <div className="space-y-1">
                           <h5 className="text-sm font-black text-white uppercase">Variant {v} Pack</h5>
                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{serializedData.subject}</p>
                        </div>
                        <div className="w-full space-y-3 pt-4">
                           <button onClick={()=>downloadTextPack(v, true)} className="w-full bg-slate-950 border border-slate-800 text-white py-3 rounded-2xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg">
                              Download Master (+Ans)
                           </button>
                           <button onClick={()=>downloadTextPack(v, false)} className="w-full bg-slate-950 border border-slate-800 text-white py-3 rounded-2xl text-[9px] font-black uppercase hover:bg-blue-600 transition-all shadow-lg">
                              Download Generic (No Ans)
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            ) : <div className="h-full flex items-center justify-center opacity-20"><p className="font-black uppercase text-sm tracking-[0.5em]">No serialized variants generated.</p></div>}
         </div>
      )}

      {activeTab === 'EMBOSSING' && (
         <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-12 rounded-[4rem] shadow-2xl space-y-10 text-center relative overflow-hidden">
               <h3 className="text-3xl font-black text-white uppercase tracking-tight">Institutional Embossment</h3>
               <div className="space-y-6">
                  <div className="space-y-2 text-left">
                     <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-4">Target Network Node</label>
                     <select 
                        value={selectedInstitution}
                        onChange={e => setSelectedInstitution(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-[2.5rem] px-8 py-6 text-sm font-black text-white outline-none focus:ring-4 focus:ring-indigo-500/10"
                     >
                        <option value="">SELECT INSTITUTION...</option>
                        <option value="ALL_NETWORK_NODES" className="text-blue-400">ALL SCHOOLS (NETWORK-WIDE)</option>
                        {registry.map(school => (
                           <option key={school.id} value={school.id}>{school.name.toUpperCase()} ({school.id})</option>
                        ))}
                     </select>
                  </div>
                  <button 
                     onClick={handleExecuteEmbossment}
                     disabled={isProcessing || !selectedInstitution || !serializedData}
                     className="w-full bg-white text-slate-950 py-8 rounded-[3rem] font-black text-sm uppercase tracking-[0.4em] shadow-2xl transition-all active:scale-95 disabled:opacity-30"
                  >
                     {isProcessing ? 'EXECUTING HANDSHAKE...' : 'Execute Embossment'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {activeTab === 'HISTORY' && (
         <div className="flex-1 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest border-b border-slate-800">
                     <tr>
                        <th className="px-8 py-6">Institutional Node</th>
                        <th className="px-6 py-6">Cycle Shard</th>
                        <th className="px-6 py-6">Payment Ref</th>
                        <th className="px-6 py-6 text-center">Census</th>
                        <th className="px-8 py-6 text-right">Audit Document</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {historyList.map(entry => (
                        <tr key={entry.id} className="hover:bg-blue-600/5 transition-all">
                           <td className="px-8 py-6">
                              <span className="font-black text-white uppercase text-xs">{entry.schoolName}</span>
                              <p className="text-[8px] font-mono text-slate-600 uppercase mt-1">{entry.schoolId}</p>
                           </td>
                           <td className="px-6 py-6">
                              <span className="text-[10px] font-black text-blue-400 uppercase">{entry.subject}</span>
                              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{entry.mockSeries}</p>
                           </td>
                           <td className="px-6 py-6">
                              <span className="font-mono text-emerald-400 text-[10px] font-black">{entry.paymentRef}</span>
                           </td>
                           <td className="px-6 py-6 text-center">
                              <span className="bg-slate-950 px-4 py-1 rounded-xl border border-slate-800 text-[11px] font-black text-white">{entry.studentCount}</span>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <button 
                                 onClick={() => downloadAuditDocument(entry)}
                                 className="bg-white/5 border border-white/10 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-white transition-all hover:text-slate-950"
                              >
                                 Unified Audit Doc
                              </button>
                           </td>
                        </tr>
                     ))}
                     {historyList.length === 0 && <tr><td colSpan={5} className="py-40 text-center opacity-20 uppercase font-black text-sm tracking-[0.5em]">No Embossment Archive Found</td></tr>}
                  </tbody>
               </table>
            </div>
         </div>
      )}
    </div>
  );
};

export default QuestionSerializationPortal;