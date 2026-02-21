
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterQuestion, StaffAssignment, GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';

interface SubjectQuestionsBankProps {
  activeFacilitator?: StaffAssignment | any | null;
  subjects: string[];
  settings: GlobalSettings;
}

const SubjectQuestionsBank: React.FC<SubjectQuestionsBankProps> = ({ activeFacilitator, subjects, settings }) => {
  const [selectedSubject, setSelectedSubject] = useState(activeFacilitator?.subject || activeFacilitator?.taughtSubject || subjects[0]);
  const [masterBank, setMasterBank] = useState<MasterQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [basket, setBasket] = useState<MasterQuestion[]>([]);
  const [timeLimit, setTimeLimit] = useState(30); 

  // Filter State
  const [fStrand, setFStrand] = useState('ALL');
  const [fSubStrand, setFSubStrand] = useState('ALL');
  const [fIndicator, setFIndicator] = useState('ALL');
  
  useEffect(() => {
    const sub = activeFacilitator?.subject || activeFacilitator?.taughtSubject;
    if (sub) setSelectedSubject(sub);
  }, [activeFacilitator]);

  const fetchBank = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('uba_questions')
        .select('*')
        .eq('subject', selectedSubject);

      if (error) throw error;

      if (data) {
        const mappedQs: MasterQuestion[] = data.map(q => ({
          id: q.external_id || q.id,
          originalIndex: 0, 
          type: q.type as 'OBJECTIVE' | 'THEORY',
          subject: q.subject,
          strand: q.strand || 'UNMAPPED',
          strandCode: q.strand_code || '',
          subStrand: q.sub_strand || 'UNMAPPED',
          subStrandCode: q.sub_strand_code || '',
          indicator: q.indicator_text || 'UNMAPPED',
          indicatorCode: q.indicator_code || '',
          questionText: q.question_text,
          instruction: q.instruction || '',
          correctKey: q.correct_key || '',
          answerScheme: q.answer_scheme || '',
          weight: q.weight || 1,
          blooms: q.blooms_level as any,
          parts: [],
          diagramUrl: q.diagram_url || '',
          facilitatorName: q.facilitator_email || 'NETWORK_SHARD'
        }));
        setMasterBank(mappedQs);
        // Reset filters when subject changes
        setFStrand('ALL');
        setFSubStrand('ALL');
        setFIndicator('ALL');
      }
    } catch (e: any) {
      console.warn("[BANK HANDSHAKE ERROR]", e.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSubject]);

  useEffect(() => { fetchBank(); }, [fetchBank]);

  // Derive unique filter options
  const filterOptions = useMemo(() => {
    const strands = new Set(['ALL']);
    const subStrands = new Set(['ALL']);
    const indicators = new Set(['ALL']);
    
    masterBank.forEach(q => {
      if (q.strand) strands.add(q.strand);
      if (q.subStrand) subStrands.add(q.subStrand);
      if (q.indicatorCode) indicators.add(q.indicatorCode);
    });

    return {
      strands: Array.from(strands).sort(),
      subStrands: Array.from(subStrands).sort(),
      indicators: Array.from(indicators).sort()
    };
  }, [masterBank]);

  const filteredQuestions = useMemo(() => {
    return masterBank.filter(q => {
      const matchStrand = fStrand === 'ALL' || q.strand === fStrand;
      const matchSub = fSubStrand === 'ALL' || q.subStrand === fSubStrand;
      const matchInd = fIndicator === 'ALL' || q.indicatorCode === fIndicator;
      return matchStrand && matchSub && matchInd;
    });
  }, [masterBank, fStrand, fSubStrand, fIndicator]);

  const groupedQuestions = useMemo(() => {
    const groups: Record<string, MasterQuestion[]> = {};
    filteredQuestions.forEach(q => {
      const key = `${q.indicatorCode || 'N/A'} - ${q.indicator || 'GENERAL'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(q);
    });
    return groups;
  }, [filteredQuestions]);

  const toggleBasket = (q: MasterQuestion) => {
    setBasket(prev => prev.some(x => x.id === q.id) ? prev.filter(x => x.id !== q.id) : [...prev, q]);
  };

  const handleForwardToPracticeHub = async () => {
    if (basket.length === 0) return alert("Select shards to forward.");
    setIsSyncing(true);
    try {
      const hubId = settings.schoolNumber;
      const subKey = selectedSubject.replace(/\s+/g, '');
      const shardId = `practice_shards_${hubId}_${subKey}`;

      await supabase.from('uba_instructional_shards').upsert({
        id: shardId,
        hub_id: hubId,
        payload: {
          id: shardId,
          title: `Practice: ${selectedSubject}`,
          subject: selectedSubject,
          timeLimit: timeLimit,
          questions: basket,
          pushedBy: activeFacilitator?.name || 'ADMIN_CORE',
          timestamp: new Date().toISOString()
        }
      });
      alert(`PRACTICE BROADCAST ACTIVE: ${basket.length} questions pushed with a ${timeLimit}-minute duration.`);
    } catch (e) {
      alert("Forwarding Interrupted.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadRegistry = () => {
    if (filteredQuestions.length === 0) return alert("No questions available in the current filtered view.");
    
    let content = `UNITED BAYLOR ACADEMY - ${selectedSubject.toUpperCase()} SHARD REGISTRY\n`;
    content += `EXPORT DATE: ${new Date().toLocaleString()}\n`;
    content += `FILTERED BY: ${fStrand !== 'ALL' ? fStrand : 'ALL STRANDS'} | ${fIndicator !== 'ALL' ? fIndicator : 'ALL INDICATORS'}\n`;
    content += `========================================================================\n\n`;
    
    filteredQuestions.forEach((q, i) => {
      content += `[ITEM ${i + 1}]\n`;
      content += `TYPE: ${q.type}\n`;
      content += `STRAND: ${q.strand} (${q.subStrand})\n`;
      content += `INDICATOR: ${q.indicatorCode}\n`;
      content += `CONTENT: ${q.questionText}\n`;
      
      if (q.type === 'OBJECTIVE') {
        const options = q.answerScheme.split('|');
        if (options.length === 4) {
          content += `OPTIONS:\n   A. ${options[0]}\n   B. ${options[1]}\n   C. ${options[2]}\n   D. ${options[3]}\n`;
        }
        content += `CORRECT KEY: ${q.correctKey}\n`;
      } else {
        content += `MARKING SCHEME: ${q.answerScheme}\n`;
      }
      
      content += `BLOOMS: ${q.blooms} | WEIGHT: ${q.weight}\n`;
      content += `------------------------------------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UBA_Bank_${selectedSubject.replace(/\s/g, '_')}_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans pb-32">
      {isSyncing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center space-y-6">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
           <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Mirroring Shards to Cloud Practice Layer...</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white border border-gray-100 rounded-[3rem] p-10 shadow-xl space-y-8 h-fit sticky top-24">
              <div className="space-y-1">
                 <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Extraction Basket</h4>
                 <p className="text-[9px] font-bold text-slate-400 uppercase">{basket.length} Selected Items</p>
              </div>
              
              <div className="space-y-3 max-h-[250px] overflow-y-auto no-scrollbar">
                 {basket.map(q => (
                    <div key={q.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100 group animate-in slide-in-from-left-2">
                       <p className="text-[10px] font-black text-blue-900 uppercase truncate max-w-[200px]">{q.questionText}</p>
                       <button onClick={() => toggleBasket(q)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                       </button>
                    </div>
                 ))}
                 {basket.length === 0 && <div className="py-12 text-center opacity-20 italic text-[10px] uppercase font-black">Basket is vacant</div>}
              </div>

              <div className="pt-8 border-t border-gray-100 space-y-5 bg-blue-50/20 p-6 rounded-3xl border border-blue-50">
                 <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-blue-900 uppercase tracking-[0.2em]">Exercise Duration</label>
                    <div className="flex items-center gap-2">
                       <input 
                         type="number"
                         value={timeLimit}
                         onChange={(e) => setTimeLimit(Math.min(180, Math.max(5, parseInt(e.target.value) || 5)))}
                         className="w-14 bg-white border border-blue-200 rounded-lg py-1 text-center font-black text-blue-900 text-xs focus:ring-4 focus:ring-blue-500/10 outline-none"
                       />
                       <span className="text-[9px] font-black text-blue-400 uppercase">MINS</span>
                    </div>
                 </div>
                 <input 
                    type="range" 
                    min="5" 
                    max="180" 
                    step="5" 
                    value={timeLimit} 
                    onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                    className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                 />
              </div>

              <div className="pt-4 space-y-4">
                 <button 
                   onClick={handleForwardToPracticeHub}
                   disabled={basket.length === 0}
                   className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl transition-all disabled:opacity-40"
                 >
                   Push to Practice Hub
                 </button>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
           {/* FILTER BAR */}
           <div className="bg-white border border-gray-100 p-8 rounded-[3rem] shadow-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Filter Strand</label>
                 <select value={fStrand} onChange={e=>setFStrand(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase text-blue-900 outline-none focus:border-blue-500">
                    {filterOptions.strands.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Filter Sub-Strand</label>
                 <select value={fSubStrand} onChange={e=>setFSubStrand(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase text-blue-900 outline-none focus:border-blue-500">
                    {filterOptions.subStrands.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Filter Indicator</label>
                 <select value={fIndicator} onChange={e=>setFIndicator(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase text-blue-900 outline-none focus:border-blue-500">
                    {filterOptions.indicators.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
              <button 
                 onClick={handleDownloadRegistry}
                 className="bg-slate-900 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
              >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                 Download Registry (.txt)
              </button>
           </div>

           {isLoading ? (
              <div className="py-40 flex flex-col items-center justify-center gap-6 opacity-30">
                 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-[10px] font-black uppercase tracking-0.4em">Relational Registry Query in progress...</p>
              </div>
           ) : (
             (Object.entries(groupedQuestions) as [string, MasterQuestion[]][]).map(([indicatorKey, qList]) => (
                <div key={indicatorKey} className="bg-white border border-gray-100 rounded-[3rem] shadow-xl overflow-hidden animate-in fade-in duration-700">
                   <div className="bg-slate-900 px-10 py-6 border-b border-white/5 flex justify-between items-center">
                      <div className="space-y-1">
                         <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Indicator Node</span>
                         <h4 className="text-xs font-black text-white uppercase">{indicatorKey}</h4>
                      </div>
                      <span className="bg-white/10 text-white/60 px-3 py-1 rounded-full text-[8px] font-black uppercase">{qList.length} SHARDS</span>
                   </div>
                   <div className="divide-y divide-gray-50">
                      {qList.map(q => {
                        const isSelected = basket.some(x => x.id === q.id);
                        return (
                          <div key={q.id} className="p-8 hover:bg-slate-50 transition-colors flex items-start gap-8 group">
                             <button 
                               onClick={() => toggleBasket(q)}
                               className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-gray-100 text-transparent group-hover:border-blue-200'}`}
                             >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                             </button>
                             <div className="flex-1 space-y-4">
                                <p className="text-[13px] font-black text-slate-800 uppercase leading-relaxed">"{q.questionText}"</p>
                                <div className="flex items-center gap-4 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                   <span className="bg-slate-100 px-2 py-0.5 rounded">Strand: {q.strand}</span>
                                   <span>Bloom: {q.blooms}</span>
                                   <span>•</span>
                                   <span>Type: {q.type}</span>
                                </div>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
             ))
           )}
           {masterBank.length === 0 && !isLoading && (
              <div className="py-60 text-center opacity-20 flex flex-col items-center gap-6 border-4 border-dashed border-gray-100 rounded-[4rem]">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20m10-10H2"/></svg>
                 <p className="font-black uppercase text-sm tracking-[0.5em]">Relational Bank Vacant</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default SubjectQuestionsBank;
