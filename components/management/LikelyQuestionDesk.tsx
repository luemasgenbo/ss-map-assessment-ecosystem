import React, { useState, useEffect, useMemo } from 'react';
import { MasterQuestion, BloomsScale, StaffAssignment, GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';

interface LikelyQuestionDeskProps {
  activeFacilitator?: StaffAssignment | any | null;
  schoolName?: string;
  subjects?: string[];
  facilitators?: Record<string, StaffAssignment>;
  isAdmin?: boolean;
  settings: GlobalSettings;
}

const BLOOMS: BloomsScale[] = ['Knowledge', 'Understanding', 'Application', 'Analysis', 'Synthesis', 'Evaluation'];
const GH_LANGS = ["TWI (AKUAPEM)", "TWI (ASANTE)", "FANTE", "GA", "EWE", "DANGME", "NZEMA", "KASEM", "GONJA"];

const LikelyQuestionDesk: React.FC<LikelyQuestionDeskProps> = ({ 
  activeFacilitator, subjects = [], facilitators = {}, settings, isAdmin
}) => {
  const filteredSubjects = useMemo(() => {
    if (!isAdmin && activeFacilitator?.subject) {
      return subjects.filter(s => s === activeFacilitator.subject);
    }
    return subjects;
  }, [subjects, activeFacilitator, isAdmin]);

  const [questions, setQuestions] = useState<MasterQuestion[]>([]);
  const initialSubject = activeFacilitator?.subject || activeFacilitator?.taughtSubject || filteredSubjects[0] || 'English Language';
  const [targetSubject, setTargetSubject] = useState(initialSubject);
  const [targetFacilitatorEmail, setTargetFacilitatorEmail] = useState(activeFacilitator?.email || '');
  
  const [formData, setFormData] = useState({
    type: 'OBJECTIVE' as 'OBJECTIVE' | 'THEORY',
    strand: '', 
    strandCode: '', 
    subStrand: '', 
    subStrandCode: '', 
    indicator: '', 
    indicatorCode: '',
    questionText: '', 
    instruction: '', 
    correctKey: 'A', 
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    answerScheme: '', 
    diagramUrl: '',
    weight: 1, 
    blooms: 'Knowledge' as BloomsScale,
    ghanaianLanguageTag: '',
    isStructured: true,
    section: 'A' as 'A' | 'B',
    answerDiagramUrl: ''
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [viewTheoryAns, setViewTheoryAns] = useState<string | null>(null);

  useEffect(() => {
    const sub = activeFacilitator?.subject || activeFacilitator?.taughtSubject;
    if (sub) setTargetSubject(sub);
    if (activeFacilitator?.email) setTargetFacilitatorEmail(activeFacilitator.email);
  }, [activeFacilitator]);

  useEffect(() => {
    const fetchMySubmissions = async () => {
       const { data } = await supabase
         .from('uba_questions')
         .select('*')
         .eq('hub_id', settings.schoolNumber)
         .eq('subject', targetSubject);
       
       if (data) {
          const mapped = data.map(q => ({
             id: q.external_id,
             originalIndex: 0,
             type: q.type as any,
             subject: q.subject,
             strand: q.strand,
             strandCode: q.strand_code,
             subStrand: q.sub_strand,
             subStrandCode: q.sub_strand_code,
             indicator: q.indicator_text,
             indicatorCode: q.indicator_code,
             questionText: q.question_text,
             instruction: q.instruction,
             correctKey: q.correct_key,
             answerScheme: q.answer_scheme,
             weight: q.weight,
             blooms: q.blooms_level as any,
             parts: [],
             diagramUrl: q.diagram_url,
             answerDiagramUrl: q.answer_diagram_url,
             isStructured: q.is_structured ?? true,
             section: q.section,
             ghanaianLanguageTag: q.ghanaian_language_tag
          }));
          setQuestions(mapped);
       }
    };
    fetchMySubmissions();
  }, [targetSubject, settings.schoolNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.questionText.trim()) return;
    if (!targetFacilitatorEmail) return alert("Select a facilitator for attribution.");
    
    // Validate tag for Ghanaian Language
    if (targetSubject === "Ghana Language (Twi)" && !formData.ghanaianLanguageTag) {
       return alert("Ghanaian Language items MUST be tagged with a specific dialect (e.g. FANTE, GA).");
    }

    const finalAnswerScheme = formData.type === 'OBJECTIVE' 
      ? `${formData.optionA}|${formData.optionB}|${formData.optionC}|${formData.optionD}`
      : formData.answerScheme;

    setIsSyncing(true);

    const questionId = `LQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const facilitatorName = (Object.values(facilitators) as StaffAssignment[]).find(f => f.email === targetFacilitatorEmail)?.name || 'UNKNOWN';
    
    const newQ: MasterQuestion = {
      id: questionId,
      originalIndex: questions.length + 1,
      ...formData,
      answerScheme: finalAnswerScheme,
      subject: targetSubject,
      facilitatorName: facilitatorName,
      isTraded: false,
      parts: []
    };

    try {
      const insertData: any = {
        external_id: questionId,
        hub_id: settings.schoolNumber,
        facilitator_email: targetFacilitatorEmail,
        subject: targetSubject,
        type: formData.type,
        blooms_level: formData.blooms,
        strand: formData.strand,
        strand_code: formData.strandCode,
        sub_strand: formData.subStrand,
        sub_strand_code: formData.subStrandCode,
        indicator_code: formData.indicatorCode,
        indicator_text: formData.indicator,
        question_text: formData.questionText,
        instruction: formData.instruction,
        correct_key: formData.correctKey,
        answer_scheme: finalAnswerScheme,
        weight: formData.weight,
        diagram_url: formData.diagramUrl,
        answer_diagram_url: formData.answerDiagramUrl,
        is_structured: formData.isStructured,
        section: formData.type === 'THEORY' ? formData.section : null,
        status: 'PENDING'
      };

      // Only include ghanaian_language_tag if it's provided to avoid errors on older schemas
      // However, the user explicitly wants this column, so we should try to include it.
      if (formData.ghanaianLanguageTag) {
        insertData.ghanaian_language_tag = formData.ghanaianLanguageTag;
      }

      const { error: relError } = await supabase.from('uba_questions').insert(insertData);

      if (relError) {
        const msg = relError.message;
        if (msg.includes("ghanaian_language_tag")) {
          throw new Error("DATABASE SCHEMA MISMATCH: The 'ghanaian_language_tag' column is missing. Please add it (Type: TEXT) in Supabase.");
        }
        if (msg.includes("answer_diagram_url")) {
          throw new Error("DATABASE SCHEMA MISMATCH: The 'answer_diagram_url' column is missing. Please add it (Type: TEXT) in Supabase.");
        }
        if (msg.includes("is_structured")) {
          throw new Error("DATABASE SCHEMA MISMATCH: The 'is_structured' column is missing. Please add it (Type: BOOLEAN, Default: TRUE) in Supabase.");
        }
        if (msg.includes("section")) {
          throw new Error("DATABASE SCHEMA MISMATCH: The 'section' column is missing. Please add it (Type: TEXT) in Supabase.");
        }
        throw relError;
      }

      await supabase.from('uba_transaction_ledger').insert({
          identity_email: targetFacilitatorEmail,
          hub_id: settings.schoolNumber,
          event_category: 'DATA_UPLOAD',
          type: 'CREDIT',
          asset_type: 'MERIT_TOKEN',
          amount: 5,
          description: `Instructional Handshake: ${targetSubject} Shard Ingestion.`,
      });

      setQuestions([...questions, newQ]);
      
      setFormData({ 
        ...formData, 
        questionText: '', 
        indicator: '', 
        indicatorCode: '', 
        subStrand: '', 
        subStrandCode: '', 
        strand: '', 
        strandCode: '',
        diagramUrl: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        answerScheme: '',
        ghanaianLanguageTag: ''
      });
      alert(`MATRIX HANDSHAKE COMPLETE: Item mirrored to Global HQ Matrix.`);
    } catch (error: any) {
      alert("Relational Sync Interrupted: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20 font-sans">
      <div className="bg-blue-950 p-10 rounded-[3.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl border border-white/10">
         <div className="space-y-2 text-center md:text-left">
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Question Developer Hub</h2>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Global HQ Matrix Forwarding Terminal</p>
         </div>
         <div className="flex gap-4">
            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex flex-col items-center">
               <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Network Status</span>
               <span className="text-xs font-black text-emerald-400 uppercase">Handshake Active</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-xl space-y-8">
            
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button 
                 type="button"
                 onClick={() => setFormData({...formData, isStructured: true})}
                 className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.isStructured ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  Structured
               </button>
               <button 
                 type="button"
                 onClick={() => setFormData({...formData, isStructured: false})}
                 className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!formData.isStructured ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  None Structured
               </button>
            </div>

            {(isAdmin || !activeFacilitator) && (
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl space-y-3">
                 <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Instructional Attribution</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Source Facilitator</label>
                       <select value={targetFacilitatorEmail} onChange={e=>setTargetFacilitatorEmail(e.target.value)} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/10">
                          <option value="">SELECT SPECIALIST...</option>
                          {(Object.values(facilitators) as StaffAssignment[]).map(f => (
                             <option key={f.email} value={f.email}>{f.name} ({f.taughtSubject})</option>
                          ))}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Target Discipline</label>
                       <select value={targetSubject} onChange={e=>setTargetSubject(e.target.value)} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none">
                          {filteredSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                 </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl">
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Modality</label>
                   <select value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value as any})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase">
                      <option value="OBJECTIVE">OBJECTIVE</option>
                      <option value="THEORY">THEORY</option>
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2">{formData.type === 'THEORY' && !formData.isStructured ? 'Theory Section' : 'Cognitive Scale'}</label>
                   {formData.type === 'THEORY' && !formData.isStructured ? (
                      <select value={formData.section} onChange={e=>setFormData({...formData, section: e.target.value as any})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase">
                         <option value="A">SECTION A</option>
                         <option value="B">SECTION B</option>
                      </select>
                   ) : (
                      <select value={formData.blooms} onChange={e=>setFormData({...formData, blooms: e.target.value as any})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase">
                         {BLOOMS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                   )}
                </div>
            </div>

            {/* Ghanaian Language Specific Partitioning */}
            {targetSubject === "Ghana Language (Twi)" && (
               <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl animate-in slide-in-from-top-2">
                  <label className="text-[8px] font-black text-emerald-600 uppercase ml-2 tracking-widest">Specific Ghanaian Language Tag</label>
                  <select 
                    value={formData.ghanaianLanguageTag} 
                    onChange={e=>setFormData({...formData, ghanaianLanguageTag: e.target.value})} 
                    className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none mt-1"
                    required
                  >
                     <option value="">SELECT DIALECT TAG...</option>
                     {GH_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <p className="text-[7px] text-emerald-400 font-bold uppercase mt-2 italic px-2">* Required for Serialization Gate handshake.</p>
               </div>
            )}

            <div className="space-y-1">
               <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Main Question Statement</label>
               <textarea 
                 value={formData.questionText} 
                 onChange={e=>setFormData({...formData, questionText: e.target.value})} 
                 className="w-full bg-slate-50 border border-gray-100 rounded-2xl p-6 text-sm font-bold text-slate-700 min-h-[300px] focus:ring-8 focus:ring-blue-500/5 outline-none transition-all" 
                 required 
                 placeholder="ENTER FULL QUESTION TEXT (INCLUDING SECTIONS, SUB-QUESTIONS, ETC)..." 
               />
            </div>

            <div className="space-y-1">
               <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Instruction (Optional)</label>
               <input type="text" value={formData.instruction} onChange={e=>setFormData({...formData, instruction: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-6 py-4 text-xs font-bold text-slate-700 uppercase outline-none" placeholder="E.G. ATTEMPT ALL QUESTIONS" />
            </div>

            {formData.type === 'OBJECTIVE' ? (
              <div className="space-y-4 bg-blue-50/30 p-8 rounded-[2.5rem] border border-blue-100">
                <h4 className="text-[9px] font-black text-blue-900 uppercase tracking-widest mb-2">Alternative Statements (Required)</h4>
                {['A', 'B', 'C', 'D'].map((label) => (
                  <div key={label} className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Alternative {label}</label>
                    <textarea 
                      value={(formData as any)[`option${label}`]} 
                      onChange={e => setFormData({...formData, [`option${label}`]: e.target.value.toUpperCase()})}
                      className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500"
                      placeholder={`Enter statement for option ${label}...`}
                      rows={2}
                      required
                    />
                  </div>
                ))}
                <div className="pt-4 space-y-1">
                   <label className="text-[8px] font-black text-blue-600 uppercase ml-2">Correct Answer Key</label>
                   <select value={formData.correctKey} onChange={e=>setFormData({...formData, correctKey: e.target.value})} className="w-full bg-white border border-blue-200 rounded-xl px-6 py-3 text-xs font-black uppercase">
                      {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>Option {l} is correct</option>)}
                   </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Verification Rubric / Marking Scheme</label>
                   <textarea 
                     value={formData.answerScheme} 
                     onChange={e=>setFormData({...formData, answerScheme: e.target.value})} 
                     className="w-full bg-slate-50 border border-gray-100 rounded-2xl p-6 text-xs font-bold text-slate-700 min-h-[250px]" 
                     placeholder="ENTER FULL MARKING RUBRIC AND EXPECTED ANSWERS..." 
                   />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
               {formData.isStructured ? (
                  <div className="space-y-4">
                     <div className="flex gap-2">
                        <input type="text" placeholder="S-CODE" value={formData.strandCode} onChange={e=>setFormData({...formData, strandCode: e.target.value.toUpperCase()})} className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                        <input type="text" placeholder="STRAND" value={formData.strand} onChange={e=>setFormData({...formData, strand: e.target.value.toUpperCase()})} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                     </div>
                     <div className="flex gap-2">
                        <input type="text" placeholder="SS-CODE" value={formData.subStrandCode} onChange={e=>setFormData({...formData, subStrandCode: e.target.value.toUpperCase()})} className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                        <input type="text" placeholder="SUB-STRAND" value={formData.subStrand} onChange={e=>setFormData({...formData, subStrand: e.target.value.toUpperCase()})} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                     </div>
                     <div className="flex gap-2">
                        <input type="text" placeholder="I-CODE" value={formData.indicatorCode} onChange={e=>setFormData({...formData, indicatorCode: e.target.value.toUpperCase()})} className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                        <input type="text" placeholder="INDICATOR" value={formData.indicator} onChange={e=>setFormData({...formData, indicator: e.target.value.toUpperCase()})} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase" />
                     </div>
                  </div>
               ) : (
                  <div className="space-y-4">
                     <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
                        <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest">None Structured Mode</p>
                        <p className="text-[7px] text-amber-600 font-bold uppercase mt-1 leading-relaxed">Curriculum mapping (Strands/Indicators) is bypassed for this item.</p>
                     </div>
                  </div>
               )}
               <div className="space-y-4">
                  <div className="space-y-1">
                     <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Question Illustration URL</label>
                     <input type="text" value={formData.diagramUrl} onChange={e=>setFormData({...formData, diagramUrl: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-5 py-4 text-xs font-mono font-black" placeholder="HTTPS://DATA.CLOUD/IMAGE" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Answer/Rubric Illustration URL</label>
                     <input type="text" value={formData.answerDiagramUrl} onChange={e=>setFormData({...formData, answerDiagramUrl: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-5 py-4 text-xs font-mono font-black" placeholder="HTTPS://DATA.CLOUD/RUBRIC-IMAGE" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Weight Magnitude</label>
                     <input type="number" value={formData.weight} onChange={e=>setFormData({...formData, weight: parseInt(e.target.value) || 1})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-5 py-4 text-xs font-black" placeholder="1" />
                  </div>
               </div>
            </div>

            <button type="submit" disabled={isSyncing} className="w-full bg-blue-950 text-white py-6 rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95 disabled:opacity-50">
               {isSyncing ? 'Mirroring Shard to Registry...' : 'Execute Shard Ingestion'}
            </button>
         </form>

         <div className="lg:col-span-5 bg-slate-900 rounded-[3.5rem] border border-white/5 shadow-inner flex flex-col overflow-hidden">
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
               <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Recent Ingestions</h4>
               <span className="text-[9px] font-black text-slate-500 bg-white/5 px-3 py-1 rounded-full">{questions.length} Captured</span>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 max-h-[800px] no-scrollbar">
                {questions.length > 0 ? [...questions].reverse().map((q, i) => (
                  <div key={q.id} className="bg-slate-950 border border-white/5 p-6 rounded-3xl space-y-4 group transition-all hover:border-blue-500/30">
                     <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                           <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">{q.isStructured ? (q.strandCode || 'STRAND') : 'NONE STRUCTURED'}</span>
                              {q.section && <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">SECTION {q.section}</span>}
                              {q.ghanaianLanguageTag && <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">TAG: {q.ghanaianLanguageTag}</span>}
                           </div>
                           <p className="text-[11px] font-bold text-slate-300 uppercase leading-relaxed line-clamp-3">"{q.questionText}"</p>
                           
                           <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                              <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest"><span className="text-slate-600 mr-1">STRAND:</span>{q.strandCode || q.strand}</span>
                              <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest"><span className="text-slate-600 mr-1">SUB:</span>{q.subStrandCode || q.subStrand}</span>
                              <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest"><span className="text-slate-600 mr-1">IND:</span>{q.indicatorCode}</span>
                              <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest">
                                <span className="text-slate-600 mr-1">ANS:</span>
                                {q.type === 'OBJECTIVE' ? q.correctKey : (
                                  <button onClick={() => setViewTheoryAns(q.answerScheme)} className="underline hover:text-orange-300">VIEW RUBRIC</button>
                                )}
                              </span>
                           </div>

                           <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-2">{q.subject}</p>
                        </div>
                        <div className="bg-blue-600 text-white px-2 py-0.5 rounded text-[7px] font-black uppercase">SYNCED</div>
                     </div>
                  </div>
               )) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-10 py-40">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2v20m10-10H2"/></svg>
                    <p className="font-black uppercase text-xs mt-4">Buffer Vacant</p>
                 </div>
               )}
            </div>
         </div>
      </div>

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

export default LikelyQuestionDesk;
