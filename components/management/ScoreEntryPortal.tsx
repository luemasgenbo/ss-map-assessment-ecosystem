import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StudentData, GlobalSettings, ProcessedStudent } from '../../types';
import { SUBJECT_REMARKS, SUBJECT_LIST } from '../../constants';
import { supabase } from '../../supabaseClient';

interface ScoreEntryPortalProps {
  students: StudentData[];
  setStudents: React.Dispatch<React.SetStateAction<StudentData[]>>;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  subjects: string[];
  processedSnapshot: ProcessedStudent[];
  onSave: (overrides?: any) => void;
  activeFacilitator?: { name: string; subject?: string; email?: string } | null;
}

const ScoreEntryPortal: React.FC<ScoreEntryPortalProps> = ({ 
  students, setStudents, settings, onSettingChange, subjects, onSave, activeFacilitator 
}) => {
  const [selectedSubject, setSelectedSubject] = useState(activeFacilitator?.subject || subjects[0] || "English Language");
  const [searchTerm, setSearchTerm] = useState('');
  const [isMirroring, setIsMirroring] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [entryMode, setEntryMode] = useState<'CAPI' | 'TABLE'>('CAPI');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeFacilitator?.subject) {
      setSelectedSubject(activeFacilitator.subject);
    }
  }, [activeFacilitator]);

  const handleUpdateScore = (studentId: number, section: 'sectionA' | 'sectionB', value: string) => {
    const maxLimit = section === 'sectionA' ? settings.maxSectionA : settings.maxSectionB;
    let numericVal = parseInt(value) || 0;
    
    if (numericVal > maxLimit) numericVal = maxLimit;
    numericVal = Math.max(0, numericVal);

    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const mockSet = s.mockData?.[settings.activeMock] || { scores: {}, sbaScores: {}, examSubScores: {}, facilitatorRemarks: {}, observations: { facilitator: "", invigilator: "", examiner: "" }, attendance: 0, conductRemark: "" };
      const currentSubScores = mockSet.examSubScores?.[selectedSubject] || { sectionA: 0, sectionB: 0 };
      const newSubScores = { ...currentSubScores, [section]: numericVal };
      
      return { 
        ...s, 
        mockData: { 
          ...(s.mockData || {}), 
          [settings.activeMock]: { 
            ...mockSet, 
            examSubScores: { ...mockSet.examSubScores, [selectedSubject]: newSubScores },
            scores: { ...mockSet.scores, [selectedSubject]: newSubScores.sectionA + newSubScores.sectionB } 
          } 
        } 
      };
    }));
  };

  const handleUpdateRemark = (studentId: number, remark: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const mockSet = s.mockData?.[settings.activeMock] || { scores: {}, sbaScores: {}, examSubScores: {}, facilitatorRemarks: {}, observations: { facilitator: "", invigilator: "", examiner: "" }, attendance: 0, conductRemark: "" };
      return { 
        ...s, 
        mockData: { 
          ...(s.mockData || {}), 
          [settings.activeMock]: { 
            ...mockSet, 
            facilitatorRemarks: { ...(mockSet.facilitatorRemarks || {}), [selectedSubject]: remark } 
          } 
        } 
      };
    }));
  };

  const handleDownloadTemplate = () => {
    const headers = "Index_Number,Candidate_Name,Section_A_Score,Section_B_Score,Remark\n";
    const rows = students.map(s => `"${s.indexNumber || s.id}","${s.name}","","",""`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Template_${selectedSubject.replace(/\s+/g, '_')}_${settings.activeMock}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
      const dataLines = lines.slice(1);
      
      setStudents(prev => prev.map(s => {
        const row = dataLines.find(line => {
          const parts = line.split(",").map(p => p.replace(/"/g, '').trim());
          return parts[0] === (s.indexNumber || s.id.toString());
        });

        if (row) {
          const parts = row.split(",").map(p => p.replace(/"/g, '').trim());
          const secA = Math.min(settings.maxSectionA, Math.max(0, parseInt(parts[2]) || 0));
          const secB = Math.min(settings.maxSectionB, Math.max(0, parseInt(parts[3]) || 0));
          const remark = (parts[4] || "").toUpperCase();

          const mockSet = s.mockData?.[settings.activeMock] || { scores: {}, sbaScores: {}, examSubScores: {}, facilitatorRemarks: {}, observations: { facilitator: "", invigilator: "", examiner: "" }, attendance: 0, conductRemark: "" };
          const newSubScores = { sectionA: secA, sectionB: secB };
          
          return {
            ...s,
            mockData: {
              ...(s.mockData || {}),
              [settings.activeMock]: {
                ...mockSet,
                examSubScores: { ...(mockSet.examSubScores || {}), [selectedSubject]: newSubScores },
                scores: { ...(mockSet.scores || {}), [selectedSubject]: secA + secB },
                facilitatorRemarks: { ...(mockSet.facilitatorRemarks || {}), [selectedSubject]: remark }
              }
            }
          };
        }
        return s;
      }));
      alert("CSV DATA INGESTED: All matching indices have been updated in the local buffer.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handlePullSpecialMockScores = async () => {
    setIsPulling(true);
    try {
      const { data, error } = await supabase
        .from('uba_practice_results')
        .select('student_id, score')
        .eq('hub_id', settings.schoolNumber)
        .eq('subject', selectedSubject)
        .like('assignment_id', 'special_mock_shard_%') 
        .order('completed_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert(`No Special Mock shards found for ${selectedSubject}.`);
        return;
      }

      const scoresMap: Record<string, number> = {};
      data.forEach(res => {
        if (scoresMap[res.student_id] === undefined || res.score > scoresMap[res.student_id]) {
          scoresMap[res.student_id] = res.score;
        }
      });

      let updatedCount = 0;
      setStudents(prev => prev.map(s => {
        const studentIdKey = s.indexNumber || s.id.toString();
        const pulledScore = scoresMap[studentIdKey];

        if (pulledScore !== undefined) {
          updatedCount++;
          // Fix: provided complete default MockScoreSet object for the fallback state, ensuring compatibility with StudentData type.
          const mockSet = s.mockData?.[settings.activeMock] || { 
            scores: {}, 
            sbaScores: {}, 
            examSubScores: {}, 
            facilitatorRemarks: {}, 
            observations: { facilitator: "", invigilator: "", examiner: "" }, 
            attendance: 0, 
            conductRemark: "" 
          };
          const currentSubScores = mockSet.examSubScores?.[selectedSubject] || { sectionA: 0, sectionB: 0 };
          const newSubScores = { ...currentSubScores, sectionA: pulledScore };
          
          return { 
            ...s, 
            mockData: { 
              ...(s.mockData || {}), 
              [settings.activeMock]: { 
                ...mockSet, 
                examSubScores: { ...mockSet.examSubScores, [selectedSubject]: newSubScores },
                scores: { ...mockSet.scores, [selectedSubject]: newSubScores.sectionA + newSubScores.sectionB } 
              } 
            } 
          };
        }
        return s;
      }));

      alert(`PULL SUCCESS: Synchronized ${updatedCount} shards into Section A.`);
    } catch (err: any) {
      alert("Sync Error: " + err.message);
    } finally {
      setIsPulling(false);
    }
  };

  const handleCommitCalibration = async () => {
    setIsMirroring(true);
    try {
      // 1. Save to persistence blob (legacy support/backup)
      await onSave({ students: students });

      // 2. Push granular shards to uba_mock_scores
      const scoreShards = students.map(s => {
        const mockSet = s.mockData?.[settings.activeMock];
        if (!mockSet) return null;
        const subSc = mockSet.examSubScores?.[selectedSubject] || { sectionA: 0, sectionB: 0 };
        const remark = mockSet.facilitatorRemarks?.[selectedSubject] || "";
        
        return {
          hub_id: settings.schoolNumber,
          student_id: s.indexNumber || s.id.toString(),
          mock_series: settings.activeMock,
          subject: selectedSubject,
          total_score: subSc.sectionA + subSc.sectionB,
          section_a: subSc.sectionA,
          section_b: subSc.sectionB,
          remark: remark,
          academic_year: settings.academicYear,
          created_at: new Date().toISOString()
        };
      }).filter(Boolean);

      if (scoreShards.length > 0) {
        await supabase.from('uba_mock_scores').upsert(scoreShards, { onConflict: 'hub_id,student_id,mock_series,subject' });
      }

      alert("COMMIT SUCCESS: Scores mirrored to institutional cloud ledger and granular shards synchronized.");
    } catch (err: any) {
      alert("Mirroring Fault: " + err.message);
    } finally {
      setIsMirroring(false);
    }
  };

  const filtered = students.filter(s => 
    (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.indexNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const currentPredefinedRemarks = SUBJECT_REMARKS[selectedSubject] || SUBJECT_REMARKS["General"];

  return (
    <div className="space-y-6 pb-32 animate-in fade-in duration-500 font-sans">
      {(isMirroring || isPulling) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center space-y-6">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
           <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Calibrating Matrix Data...</p>
        </div>
      )}

      <div className="bg-slate-950 p-8 rounded-[3rem] shadow-2xl border border-white/5 space-y-6">
        <div className="flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">Score Modulation Gate</h3>
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em]">Series: {settings.activeMock} | Subject: {selectedSubject}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 justify-center">
             <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
                <button onClick={handleDownloadTemplate} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center gap-2">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                   Download CSV
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center gap-2">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
                   Upload CSV
                </button>
                <input type="file" ref={fileInputRef} onChange={handleUploadCSV} accept=".csv" className="hidden" />
             </div>

             <button onClick={handlePullSpecialMockScores} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all flex items-center gap-2 border border-indigo-400/30">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Pull Special Mock Shards
             </button>

             <div className="bg-slate-900 p-1.5 rounded-2xl border border-white/10 flex items-center">
                <button onClick={() => setEntryMode('CAPI')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${entryMode === 'CAPI' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>CAPI Card</button>
                <button onClick={() => setEntryMode('TABLE')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${entryMode === 'TABLE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Table Matrix</button>
             </div>

             <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!!activeFacilitator?.subject} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-blue-400 outline-none">
               {subjects.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>
        </div>

        <div className="relative">
          <input type="text" placeholder="FILTER COHORT BY IDENTITY OR INDEX..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-slate-900 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20 uppercase transition-all" />
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" cy="11" x2="16.65" y2="16.65"/></svg>
        </div>
      </div>

      {entryMode === 'CAPI' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(student => {
            const mockSet = student.mockData?.[settings.activeMock] || { scores: {}, examSubScores: {}, facilitatorRemarks: {} };
            const subSc = mockSet.examSubScores?.[selectedSubject] || { sectionA: 0, sectionB: 0 };
            const remark = mockSet.facilitatorRemarks?.[selectedSubject] || "";
            return (
              <div key={student.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col group hover:border-blue-400 transition-all">
                 <div className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                       <div className="space-y-1">
                          <h4 className="text-base font-black text-slate-950 uppercase leading-none truncate max-w-[180px]">{student.name}</h4>
                          <p className="text-[9px] font-mono text-gray-400 uppercase tracking-tighter">IDX: {student.indexNumber || student.id}</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                       <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase text-center block tracking-widest font-mono">OBJ ({settings.maxSectionA})</label>
                          <input type="number" value={subSc.sectionA} onChange={e => handleUpdateScore(student.id, 'sectionA', e.target.value)} className="w-full bg-slate-50 border-2 border-gray-100 rounded-2xl py-4 text-center font-black text-blue-900 text-xl outline-none focus:border-blue-500" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase text-center block tracking-widest font-mono">THY ({settings.maxSectionB})</label>
                          <input type="number" value={subSc.sectionB} onChange={e => handleUpdateScore(student.id, 'sectionB', e.target.value)} className="w-full bg-slate-50 border-2 border-gray-100 rounded-2xl py-4 text-center font-black text-blue-900 text-xl outline-none focus:border-blue-500" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[8px] font-black text-blue-600 uppercase text-center block tracking-widest font-mono">TOTAL</label>
                          <div className="w-full bg-blue-950 text-white rounded-2xl py-4 text-center font-black text-2xl h-[60px] flex items-center justify-center shadow-lg">{subSc.sectionA + subSc.sectionB}</div>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Instructional Shard Remark</label>
                       <div className="space-y-2">
                          <select value={currentPredefinedRemarks.includes(remark) ? remark : ""} onChange={(e) => handleUpdateRemark(student.id, e.target.value)} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2.5 text-[9px] font-black text-blue-900 uppercase">
                             <option value="">— SELECT FEEDBACK SHARD —</option>
                             {currentPredefinedRemarks.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
                          </select>
                          <textarea value={remark} onChange={(e) => handleUpdateRemark(student.id, e.target.value.toUpperCase())} placeholder="CUSTOM ANALYSIS..." rows={2} className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3 text-[10px] font-bold italic text-slate-600 outline-none focus:ring-4 focus:ring-blue-500/5 resize-none uppercase" />
                       </div>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-950 text-slate-500 text-[8px] font-black uppercase tracking-widest sticky top-0 z-20">
                    <tr>
                       <th className="px-8 py-6 border-r border-slate-800">Identity Particulars</th>
                       <th className="px-4 py-6 text-center w-28 border-r border-slate-800 bg-blue-900 text-white">OBJ ({settings.maxSectionA})</th>
                       <th className="px-4 py-6 text-center w-28 border-r border-slate-800 bg-indigo-900 text-white">THY ({settings.maxSectionB})</th>
                       <th className="px-4 py-6 text-center w-24 border-r border-slate-800 bg-slate-800 text-white">SUM</th>
                       <th className="px-6 py-6 min-w-[400px]">Analytical Remark Shard</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {filtered.map(student => {
                       const mockSet = student.mockData?.[settings.activeMock] || { scores: {}, examSubScores: {}, facilitatorRemarks: {} };
                       const subSc = mockSet.examSubScores?.[selectedSubject] || { sectionA: 0, sectionB: 0 };
                       const remark = mockSet.facilitatorRemarks?.[selectedSubject] || "";
                       return (
                          <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                             <td className="px-8 py-6 border-r border-gray-100">
                                <p className="text-sm font-black text-slate-900 uppercase truncate max-w-[220px] leading-none mb-1">{student.name}</p>
                                <p className="text-[9px] font-mono text-gray-400 uppercase tracking-tighter">NODE: {student.indexNumber || student.id}</p>
                             </td>
                             <td className="px-2 py-6 border-r border-gray-100 bg-blue-50/20">
                                <input type="number" value={subSc.sectionA} onChange={e => handleUpdateScore(student.id, 'sectionA', e.target.value)} className="w-full bg-transparent text-center font-black text-blue-900 text-xl outline-none" />
                             </td>
                             <td className="px-2 py-6 border-r border-gray-100 bg-indigo-50/20">
                                <input type="number" value={subSc.sectionB} onChange={e => handleUpdateScore(student.id, 'sectionB', e.target.value)} className="w-full bg-transparent text-center font-black text-indigo-900 text-xl outline-none" />
                             </td>
                             <td className="px-2 py-6 text-center border-r border-gray-100 font-black text-2xl text-slate-900 bg-slate-50">
                                {subSc.sectionA + subSc.sectionB}
                             </td>
                             <td className="px-6 py-4">
                                <div className="space-y-2">
                                   <select value={currentPredefinedRemarks.includes(remark) ? remark : ""} onChange={(e) => handleUpdateRemark(student.id, e.target.value)} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-[9px] font-black text-blue-900 uppercase outline-none">
                                      <option value="">— QUICK SHARD —</option>
                                      {currentPredefinedRemarks.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
                                   </select>
                                   <textarea value={remark} onChange={(e) => handleUpdateRemark(student.id, e.target.value.toUpperCase())} placeholder="CUSTOM..." rows={1} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-[10px] font-bold text-slate-600 outline-none uppercase" />
                                </div>
                             </td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* Commit Shard Dock */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-2xl border-t border-gray-100 z-[110] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] flex justify-between items-center md:px-12 animate-in slide-in-from-bottom-10">
         <div className="flex gap-10 items-center">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-blue-900 hover:text-white transition-all shadow-sm">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
            <div className="hidden sm:flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Matrix Calibration Status</span>
               <span className="text-sm font-black text-blue-950 uppercase">{filtered.length} Shards In Focus</span>
            </div>
         </div>
         <button onClick={handleCommitCalibration} className="bg-blue-950 text-white px-16 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all hover:bg-black hover:tracking-[0.4em]">Commit Matrix State</button>
      </div>
    </div>
  );
};

export default ScoreEntryPortal;