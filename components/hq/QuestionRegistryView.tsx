import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { MasterQuestion, BloomsScale } from '../../types';

interface HQQuestionRecord extends MasterQuestion {
  id: string;
  external_id: string;
  hub_id: string;
  facilitator_email: string;
  subject: string;
  type: 'OBJECTIVE' | 'THEORY';
  blooms_level: string;
  strand: string;
  strand_code: string;
  sub_strand: string;
  sub_strand_code: string;
  indicator_code: string;
  indicator_text: string;
  question_text: string;
  correct_key: string;
  answer_scheme: string;
  weight: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  usage_count: number;
  wrong_count: number;
  created_at: string;
  diagram_url: string;
  answer_diagram_url?: string;
  is_structured: boolean;
  section?: 'A' | 'B';
  ghanaian_language_tag?: string;
}

const BLOOMS: BloomsScale[] = ['Knowledge', 'Understanding', 'Application', 'Analysis', 'Synthesis', 'Evaluation'];
const GH_LANGS = ["TWI (AKUAPEM)", "TWI (ASANTE)", "FANTE", "GA", "EWE", "DANGME", "NZEMA", "KASEM", "GONJA"];

const QuestionRegistryView: React.FC = () => {
  const [questions, setQuestions] = useState<HQQuestionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPushing, setIsPushing] = useState(false);
  const [viewTheoryAns, setViewTheoryAns] = useState<string | null>(null);
  const [showStructured, setShowStructured] = useState(true);

  // Multiplier Rates
  const RATE_OBJ = 0.01;
  const RATE_THEORY = 10.00;

  // Comprehensive Filter State
  const [filters, setFilters] = useState({
    subject: 'ALL',
    type: 'ALL',
    strand: '',
    subStrand: '',
    indicator: '',
    weight: '',
    searchTerm: ''
  });

  const fetchGlobalRegistry = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('uba_questions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setQuestions(data as HQQuestionRecord[]);
    } catch (err) {
      console.error("Registry Retrieval Fault:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchGlobalRegistry(); }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleEdit = (q: HQQuestionRecord) => {
    const opts = q.type === 'OBJECTIVE' ? (q.answer_scheme || '|||').split('|') : ['', '', '', ''];
    setEditingId(q.id);
    setEditFormData({
      ...q,
      optionA: opts[0] || '',
      optionB: opts[1] || '',
      optionC: opts[2] || '',
      optionD: opts[3] || '',
      answerScheme: q.type === 'THEORY' ? q.answer_scheme : '',
      ghanaianLanguageTag: q.ghanaian_language_tag || '',
      is_structured: q.is_structured ?? true,
      section: q.section || 'A',
      answer_diagram_url: q.answer_diagram_url || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const finalAnswerScheme = editFormData.type === 'OBJECTIVE' 
      ? `${editFormData.optionA}|${editFormData.optionB}|${editFormData.optionC}|${editFormData.optionD}`
      : editFormData.answerScheme;

    try {
      const { error } = await supabase
        .from('uba_questions')
        .update({
          subject: editFormData.subject,
          instruction: editFormData.instruction,
          type: editFormData.type,
          blooms_level: editFormData.blooms_level,
          question_text: editFormData.question_text,
          correct_key: editFormData.correct_key,
          answer_scheme: finalAnswerScheme,
          weight: editFormData.weight,
          strand: editFormData.strand?.toUpperCase(),
          strand_code: editFormData.strand_code?.toUpperCase(),
          sub_strand: editFormData.sub_strand?.toUpperCase(),
          sub_strand_code: editFormData.sub_strand_code?.toUpperCase(),
          indicator_code: editFormData.indicator_code?.toUpperCase(),
          indicator_text: editFormData.indicator_text?.toUpperCase(),
          diagram_url: editFormData.diagram_url,
          answer_diagram_url: editFormData.answer_diagram_url,
          is_structured: editFormData.is_structured,
          section: editFormData.section,
          ghanaian_language_tag: editFormData.ghanaianLanguageTag
        })
        .eq('id', editingId);

      if (error) throw error;
      setQuestions(prev => prev.map(q => q.id === editingId ? { ...q, ...editFormData, answer_scheme: finalAnswerScheme, ghanaian_language_tag: editFormData.ghanaianLanguageTag } : q));
      setEditingId(null);
      alert("MATRIX SHARD MODULATED: Relational registry updated.");
    } catch (err: any) {
      alert("Update Failed: " + err.message);
    }
  };

  const handleDownloadSelected = () => {
    if (selectedIds.size === 0) return alert("Select shards for extraction.");
    const selectedData = questions.filter(q => selectedIds.has(q.id));
    let content = `SS-MAP - HQ SHARD EXTRACTION\nDATE: ${new Date().toLocaleString()}\n==========================================\n\n`;
    selectedData.forEach((q, i) => {
      content += `[${i + 1}] ID: ${q.external_id}\nSUBJECT: ${q.subject} | TAG: ${q.ghanaian_language_tag || 'N/A'}\nCONTENT: ${q.question_text}\n------------------------------------------\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HQ_Extraction_${new Date().getTime()}.txt`;
    link.click();
  };

  const handlePushToSerialization = async () => {
    if (selectedIds.size === 0) return alert("Select shards to push.");
    const selectedQuestions = questions.filter(q => selectedIds.has(q.id));
    const subjectsInvolved = Array.from(new Set(selectedQuestions.map(q => q.subject)));

    if (subjectsInvolved.length > 1) {
       alert("PROTOCOL ERROR: Multiple subjects detected. Please filter by a single subject before pushing to Serialization.");
       return;
    }

    setIsPushing(true);
    try {
      const targetSubject = subjectsInvolved[0] as string;
      const bufferId = `ingestion_buffer_${targetSubject.replace(/\s+/g, '')}`;
      const { data: existing } = await supabase.from('uba_persistence').select('payload').eq('id', bufferId).maybeSingle();
      const currentPayload = (existing?.payload as any[]) || [];

      const newItems = selectedQuestions.map(q => ({
          id: q.id,
          type: q.type,
          strand: q.strand,
          subStrand: q.sub_strand,
          indicator: q.indicator_code,
          questionText: q.question_text,
          instruction: q.instruction || 'ATTEMPT ALL QUESTIONS.',
          correctKey: q.correct_key,
          answerScheme: q.answer_scheme,
          weight: q.weight,
          blooms: q.blooms_level,
          isStructured: q.is_structured ?? true,
          section: q.section,
          answerDiagramUrl: q.answer_diagram_url,
          ghanaianLanguageTag: q.ghanaian_language_tag
      }));

      const merged = [...currentPayload];
      newItems.forEach(item => {
         if (!merged.some(m => m.id === item.id)) merged.push(item);
      });

      await supabase.from('uba_persistence').upsert({
         id: bufferId,
         hub_id: 'HQ-HUB',
         payload: merged,
         last_updated: new Date().toISOString()
      });

      alert(`HANDSHAKE SUCCESSFUL: ${newItems.length} shards pushed to ${targetSubject} Ingestion buffer.`);
      setSelectedIds(new Set());
    } catch (err: any) {
      alert("Push Fault: " + err.message);
    } finally {
      setIsPushing(false);
    }
  };

  const filtered = useMemo(() => {
    return questions.filter(q => {
      const matchSub = filters.subject === 'ALL' || q.subject === filters.subject;
      const matchType = filters.type === 'ALL' || q.type === filters.type;
      const matchStrand = !filters.strand || (q.strand_code || "").toLowerCase().includes(filters.strand.toLowerCase()) || (q.strand || "").toLowerCase().includes(filters.strand.toLowerCase());
      const matchSubStrand = !filters.subStrand || (q.sub_strand_code || "").toLowerCase().includes(filters.subStrand.toLowerCase()) || (q.sub_strand || "").toLowerCase().includes(filters.subStrand.toLowerCase());
      const matchIndicator = !filters.indicator || (q.indicator_code || "").toLowerCase().includes(filters.indicator.toLowerCase()) || (q.indicator_text || "").toLowerCase().includes(filters.indicator.toLowerCase());
      const matchWeight = !filters.weight || q.weight.toString() === filters.weight;
      const matchSearch = !filters.searchTerm || q.question_text.toLowerCase().includes(filters.searchTerm.toLowerCase()) || (q.facilitator_email || "").toLowerCase().includes(filters.searchTerm.toLowerCase()) || (q.ghanaian_language_tag || "").toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      const matchStructure = (q.is_structured ?? true) === showStructured;

      return matchSub && matchType && matchStrand && matchSubStrand && matchIndicator && matchWeight && matchSearch && matchStructure;
    });
  }, [questions, filters, showStructured]);

  const uniqueSubjects = ['ALL', ...Array.from(new Set(questions.map(q => q.subject)))];

  if (isLoading) return <div className="h-full flex items-center justify-center p-20 opacity-20 text-xs font-black uppercase tracking-widest">Querying Matrix...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-950 font-sans min-h-screen">
      
      {/* Edit Shard Modal */}
      {editingId && (
        <div className="fixed inset-0 z-[600] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase">Instructional Shard Modulation</h3>
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Master Edit Node</p>
                 </div>
                 <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Target Subject</label>
                      <select value={editFormData.subject} onChange={e=>setEditFormData({...editFormData, subject: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900">
                         {uniqueSubjects.filter(s => s !== 'ALL').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Instruction</label>
                      <input type="text" value={editFormData.instruction || ''} onChange={e=>setEditFormData({...editFormData, instruction: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900" />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Structure Type</label>
                       <select value={editFormData.is_structured ? 'true' : 'false'} onChange={e=>setEditFormData({...editFormData, is_structured: e.target.value === 'true'})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900">
                          <option value="true">STRUCTURED</option>
                          <option value="false">NONE STRUCTURED</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Modality</label>
                       <select value={editFormData.type} onChange={e=>setEditFormData({...editFormData, type: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900">
                          <option value="OBJECTIVE">OBJECTIVE</option>
                          <option value="THEORY">THEORY</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-500 uppercase ml-2">{editFormData.type === 'THEORY' && !editFormData.is_structured ? 'Theory Section' : 'Cognitive Scale'}</label>
                       {editFormData.type === 'THEORY' && !editFormData.is_structured ? (
                          <select value={editFormData.section} onChange={e=>setEditFormData({...editFormData, section: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900">
                             <option value="A">SECTION A</option>
                             <option value="B">SECTION B</option>
                          </select>
                       ) : (
                          <select value={editFormData.blooms_level} onChange={e=>setEditFormData({...editFormData, blooms_level: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900">
                             {BLOOMS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                       )}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Weight Magnitude</label>
                       <input type="number" value={editFormData.weight} onChange={e=>setEditFormData({...editFormData, weight: parseInt(e.target.value)||1})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-900" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Illustration Shard URL</label>
                       <input type="text" value={editFormData.diagram_url || ''} onChange={e=>setEditFormData({...editFormData, diagram_url: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-5 py-4 text-xs font-mono font-black" placeholder="HTTPS://DATA.CLOUD/IMAGE" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Answer/Rubric Illustration URL</label>
                       <input type="text" value={editFormData.answer_diagram_url || ''} onChange={e=>setEditFormData({...editFormData, answer_diagram_url: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-5 py-4 text-xs font-mono font-black" placeholder="HTTPS://DATA.CLOUD/RUBRIC" />
                    </div>
                 </div>

                 {editFormData.is_structured ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="space-y-4">
                          <div className="flex gap-2">
                             <input type="text" placeholder="S-CODE" value={editFormData.strand_code} onChange={e=>setEditFormData({...editFormData, strand_code: e.target.value.toUpperCase()})} className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                             <input type="text" placeholder="STRAND" value={editFormData.strand} onChange={e=>setEditFormData({...editFormData, strand: e.target.value.toUpperCase()})} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                          </div>
                          <div className="flex gap-2">
                             <input type="text" placeholder="SS-CODE" value={editFormData.sub_strand_code} onChange={e=>setEditFormData({...editFormData, sub_strand_code: e.target.value.toUpperCase()})} className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                             <input type="text" placeholder="SUB-STRAND" value={editFormData.sub_strand} onChange={e=>setEditFormData({...editFormData, sub_strand: e.target.value.toUpperCase()})} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                          </div>
                          <div className="flex gap-2">
                             <input type="text" placeholder="I-CODE" value={editFormData.indicator_code} onChange={e=>setEditFormData({...editFormData, indicator_code: e.target.value.toUpperCase()})} className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                             <input type="text" placeholder="INDICATOR" value={editFormData.indicator_text} onChange={e=>setEditFormData({...editFormData, indicator_text: e.target.value.toUpperCase()})} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
                       <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest">None Structured Mode</p>
                       <p className="text-[7px] text-amber-600 font-bold uppercase mt-1">Strand/Indicator mapping is disabled for this shard.</p>
                    </div>
                 )}

                 {editFormData.subject === "Ghana Language (Twi)" && (
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-emerald-600 uppercase ml-2">Ghanaian Language Tag</label>
                       <select value={editFormData.ghanaianLanguageTag} onChange={e=>setEditFormData({...editFormData, ghanaianLanguageTag: e.target.value})} className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-emerald-900">
                          <option value="">SELECT DIALECT...</option>
                          {GH_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                    </div>
                 )}

                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Main Question Statement</label>
                    <textarea 
                      value={editFormData.question_text} 
                      onChange={e=>setEditFormData({...editFormData, question_text: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10" 
                      rows={12} 
                    />
                 </div>

                 {editFormData.type === 'OBJECTIVE' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/30 p-8 rounded-[2.5rem] border border-blue-100">
                       {['A', 'B', 'C', 'D'].map((label) => (
                          <div key={label} className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Alternative {label}</label>
                             <textarea 
                                value={editFormData[`option${label}`]} 
                                onChange={e => setEditFormData({...editFormData, [`option${label}`]: e.target.value.toUpperCase()})}
                                className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500"
                                placeholder={`Enter statement for option ${label}...`}
                                rows={2}
                             />
                          </div>
                       ))}
                       <div className="md:col-span-2 pt-4">
                          <label className="text-[8px] font-black text-blue-600 uppercase ml-2">Correct Answer Key</label>
                          <select value={editFormData.correct_key} onChange={e=>setEditFormData({...editFormData, correct_key: e.target.value})} className="w-full bg-white border border-blue-200 rounded-xl px-6 py-3 text-xs font-black uppercase">
                             {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>Option {l} is correct</option>)}
                          </select>
                       </div>
                    </div>
                 )}

                 {editFormData.type === 'THEORY' && (
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Answer Scheme / Rubric</label>
                       <textarea 
                         value={editFormData.answerScheme} 
                         onChange={e=>setEditFormData({...editFormData, answerScheme: e.target.value})} 
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10" 
                         rows={10} 
                       />
                    </div>
                 )}
              </div>

              <div className="p-8 border-t border-gray-100 flex justify-end gap-4">
                 <button onClick={() => setEditingId(null)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">Cancel Shard</button>
                 <button onClick={handleSaveEdit} className="bg-blue-900 text-white px-12 py-4 rounded-2xl font-black text-[10px] uppercase shadow-2xl transition-all active:scale-95">Commit Shard Modulation</button>
              </div>
           </div>
        </div>
      )}

      {/* Advanced Control Matrix */}
      <div className="p-8 border-b border-slate-900 bg-slate-900/40 space-y-6">
         <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-1">
               <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg"></div>
                  Master Instructional Hub (SuperAdmin)
               </h2>
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{filtered.length} Shards Filtered in Registry</p>
            </div>
            <div className="flex gap-4">
               <button onClick={handleDownloadSelected} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase border border-white/10 transition-all flex items-center gap-2">
                  Extract Selected ({selectedIds.size})
               </button>
               <button 
                  onClick={handlePushToSerialization}
                  disabled={isPushing || selectedIds.size === 0}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
               >
                  Push to Serialization ({selectedIds.size})
               </button>
            </div>
         </div>

         {/* Filter UI Matrix */}
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Structure</label>
               <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                  <button 
                    onClick={() => setShowStructured(true)}
                    className={`flex-1 py-1.5 rounded text-[8px] font-black uppercase transition-all ${showStructured ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                  >
                     Structured
                  </button>
                  <button 
                    onClick={() => setShowStructured(false)}
                    className={`flex-1 py-1.5 rounded text-[8px] font-black uppercase transition-all ${!showStructured ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                  >
                     None
                  </button>
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Subject</label>
               <select value={filters.subject} onChange={e=>setFilters({...filters, subject: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                  {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Format</label>
               <select value={filters.type} onChange={e=>setFilters({...filters, type: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                  <option value="ALL">ALL FORMATS</option>
                  <option value="OBJECTIVE">OBJECTIVE</option>
                  <option value="THEORY">THEORY</option>
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Strand</label>
               <input type="text" placeholder="FILTER STRAND..." value={filters.strand} onChange={e=>setFilters({...filters, strand: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Sub-Strand</label>
               <input type="text" placeholder="FILTER SUB..." value={filters.subStrand} onChange={e=>setFilters({...filters, subStrand: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Indicator</label>
               <input type="text" placeholder="FILTER IND..." value={filters.indicator} onChange={e=>setFilters({...filters, indicator: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Weight</label>
               <input type="text" placeholder="WGT" value={filters.weight} onChange={e=>setFilters({...filters, weight: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest block ml-1">Universal Search</label>
               <input type="text" placeholder="SEARCH CONTENT..." value={filters.searchTerm} onChange={e=>setFilters({...filters, searchTerm: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-x-auto p-10">
         <table className="w-full text-left border-collapse bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest border-b border-slate-800">
               <tr>
                  <th className="px-6 py-5 w-12 text-center">SEL</th>
                  <th className="px-6 py-5 w-48">Handshake Meta</th>
                  <th className="px-6 py-5">Cognitive Content & Matrix</th>
                  <th className="px-4 py-5 text-center">Freq (Uses)</th>
                  <th className="px-4 py-5 text-center">Yield Value</th>
                  <th className="px-8 py-5 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
               {filtered.map((q) => {
                  const isSelected = selectedIds.has(q.id);
                  const yieldVal = (q.usage_count || 0) * (q.type === 'OBJECTIVE' ? RATE_OBJ : RATE_THEORY);
                  return (
                    <tr key={q.id} className={`hover:bg-white/5 transition-all group ${isSelected ? 'bg-blue-900/10' : ''}`}>
                       <td className="px-6 py-6 text-center">
                          <button onClick={()=>toggleSelect(q.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-slate-800 text-transparent hover:border-blue-500'}`}>
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                       </td>
                       <td className="px-6 py-6">
                          <div className="space-y-1">
                             <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${q.type === 'OBJECTIVE' ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{q.type}</span>
                             <p className="text-xs font-black text-white uppercase truncate">{q.subject}</p>
                             {q.ghanaian_language_tag && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[6px] font-black uppercase tracking-widest">{q.ghanaian_language_tag}</span>}
                             <div className="flex flex-col gap-0.5 mt-1">
                                <p className="text-[7px] font-black text-slate-600 uppercase">WGT: {q.weight}</p>
                                <p className="text-[7px] font-black text-slate-500 uppercase truncate">FAC: {q.facilitator_email?.split('@')[0]}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-6">
                          <div className="space-y-2">
                             <p className="text-[12px] font-bold text-slate-300 uppercase leading-relaxed line-clamp-2">"{q.question_text}"</p>
                             <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest"><span className="text-slate-600 mr-1">STRAND:</span>{q.strand_code || q.strand}</span>
                                <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest"><span className="text-slate-600 mr-1">SUB:</span>{q.sub_strand_code || q.sub_strand}</span>
                                <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest"><span className="text-slate-600 mr-1">IND:</span>{q.indicator_code}</span>
                                <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest">
                                   <span className="text-slate-600 mr-1">ANS:</span>
                                   {q.type === 'OBJECTIVE' ? q.correct_key : (
                                      <button onClick={() => setViewTheoryAns(q.answer_scheme)} className="underline hover:text-orange-300">VIEW RUBRIC</button>
                                   )}
                                </span>
                             </div>
                          </div>
                       </td>
                       <td className="px-4 py-6 text-center">
                          <div className="space-y-1">
                             <span className="text-xl font-black text-blue-300 font-mono">{q.usage_count || 0}</span>
                             <p className="text-[7px] font-black text-slate-600 uppercase">Handshakes</p>
                          </div>
                       </td>
                       <td className="px-4 py-6 text-center">
                          <div className="space-y-1">
                             <span className="text-lg font-black text-emerald-400 font-mono">GHS {isNaN(yieldVal) ? '0.00' : yieldVal.toFixed(2)}</span>
                             <p className="text-[7px] font-black text-slate-600 uppercase">Multiplier Logic</p>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                             <button onClick={()=>handleEdit(q)} className="bg-slate-800 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all">Edit</button>
                             <button onClick={async () => {
                                if(window.confirm("Purge instructional shard?")) {
                                   await supabase.from('uba_questions').delete().eq('id', q.id);
                                   fetchGlobalRegistry();
                                }
                             }} className="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all">Purge</button>
                          </div>
                       </td>
                    </tr>
                  );
               })}
               {filtered.length === 0 && (
                  <tr>
                     <td colSpan={6} className="py-40 text-center opacity-20">
                        <p className="font-black uppercase text-sm tracking-[1em] text-white">Registry Vacant / No Shards Matched</p>
                     </td>
                  </tr>
               )}
            </tbody>
         </table>
      </div>
      
      <footer className="p-8 bg-slate-950 border-t border-slate-900 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">
         <div className="flex gap-10">
            <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-700 uppercase">Global Volume</span>
               <p className="text-xl font-black text-white font-mono">{questions.length}</p>
            </div>
            <div className="space-y-1 border-l border-slate-900 pl-10">
               <span className="text-[8px] font-black text-slate-700 uppercase">Network Revenue</span>
               <p className="text-xl font-black text-emerald-400 font-mono">GHS {questions.reduce((a,b)=>a+((b.usage_count||0)*(b.type==='OBJECTIVE'?RATE_OBJ:RATE_THEORY)), 0).toFixed(2)}</p>
            </div>
         </div>
         <p className="italic text-slate-800">SS-MAP HQ INTELLIGENCE TERMINAL v10.2</p>
      </footer>

      {/* Theory Answer Popout */}
      {viewTheoryAns && (
        <div className="fixed inset-0 z-[700] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">Theory Rubric Shard</h3>
              <button onClick={() => setViewTheoryAns(null)} className="text-slate-400 hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-10">
              <div className="bg-slate-50 border border-gray-100 rounded-3xl p-8 min-h-[200px] max-h-[400px] overflow-y-auto no-scrollbar">
                <p className="text-sm font-bold text-slate-700 uppercase leading-relaxed whitespace-pre-wrap">{viewTheoryAns}</p>
              </div>
              <button onClick={() => setViewTheoryAns(null)} className="w-full mt-8 bg-blue-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Close Shard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionRegistryView;
