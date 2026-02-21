import React, { useState, useMemo } from 'react';
import { ProcessedStudent, ClassStatistics, GlobalSettings, StaffAssignment } from '../../types';
import { SUBJECT_LIST } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import EditableField from '../shared/EditableField';

interface CompositeSheetProps {
  students: ProcessedStudent[];
  stats: ClassStatistics;
  settings: GlobalSettings;
  facilitators: Record<string, StaffAssignment>;
  isFacilitator?: boolean;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
}

const CompositeSheet: React.FC<CompositeSheetProps> = ({ students, stats, settings, facilitators, isFacilitator, onSettingChange }) => {
  const [analyzingSubject, setAnalyzingSubject] = useState<{name: string, mean: number, svi: number} | null>(null);
  const [aiOutput, setAiOutput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const getGradeColor = (grade: string) => {
    if (grade === 'A1') return 'bg-green-100 text-green-800';
    if (grade === 'B2' || grade === 'B3') return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-50 text-yellow-800';
    if (grade === 'F9') return 'bg-red-100 text-red-800 font-bold';
    return 'text-gray-600';
  };

  const facilitatorAnalytics = useMemo(() => {
    return SUBJECT_LIST.map(subject => {
      const facilitatorName = facilitators[subject]?.name || "TBA";
      const totalStudents = students.length;
      
      const qualityPasses = students.filter(s => {
        const subData = s.subjects.find(sub => sub.subject === subject);
        return subData && subData.gradeValue <= 6;
      }).length;
      
      const qpr = totalStudents > 0 ? (qualityPasses / totalStudents) * 100 : 0;
      const mean = stats.subjectMeans[subject] || 0;
      const sd = stats.subjectStdDevs[subject] || 0;
      const consistencyScore = Math.max(0, 100 - (sd * 3.33)); 
      const svi = (mean * 0.4) + (qpr * 0.4) + (consistencyScore * 0.2);
      
      return { subject, facilitatorName, mean, qpr, sd, svi };
    }).sort((a, b) => b.svi - a.svi);
  }, [students, stats, facilitators]);

  const runAiDiagnostic = async (subject: string, mean: number, svi: number) => {
    setAnalyzingSubject({ name: subject, mean, svi });
    setIsAiLoading(true);
    setAiOutput("");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Perform instructional audit for UNITED BAYLOR ACADEMY. 
      Subject: ${subject}. 
      Current Cohort Mean: ${mean.toFixed(1)}%. 
      Subject Vitality Index (SVI): ${svi.toFixed(2)}. 
      
      Identify 3 technical root causes for performance trends in this subject. 
      Provide 4 high-impact "Instructional Intervention Shards" to calibrate and improve the Mean Score in future cycles. 
      Tone: Technical, Academic, Institutional Master Shard. Use uppercase for key findings.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAiOutput(response.text || "Diagnostic Shard unreachable.");
    } catch (e) {
      setAiOutput("IDENTITY HANDSHAKE FAILURE: UNABLE TO REACH ANALYTICAL CORE.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 font-sans">
      
      {/* AI DIAGNOSTIC MODAL */}
      {analyzingSubject && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden">
           <div className="bg-white w-full max-w-3xl max-h-[80vh] rounded-[3rem] shadow-[0_0_100px_rgba(30,58,138,0.5)] border border-blue-900/20 flex flex-col animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-blue-950 text-white flex justify-between items-center shrink-0">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tight">Academy AI Diagnostic</h3>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Instructional Heuristics & Root Cause Audit</p>
                 </div>
                 <button onClick={() => setAnalyzingSubject(null)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
                 <div className="grid grid-cols-2 gap-6 border-b border-gray-100 pb-8">
                    <div className="space-y-1">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Subject Discipline</span>
                       <p className="text-xl font-black text-blue-950 uppercase">{analyzingSubject.name}</p>
                    </div>
                    <div className="flex gap-4 justify-end">
                       <div className="text-center bg-slate-50 px-6 py-2 rounded-2xl border border-gray-100">
                          <span className="text-[8px] font-black text-slate-400 uppercase block">Mean μ</span>
                          <p className="text-lg font-black text-blue-600 font-mono">{analyzingSubject.mean.toFixed(1)}%</p>
                       </div>
                       <div className="text-center bg-blue-50 px-6 py-2 rounded-2xl border border-blue-100">
                          <span className="text-[8px] font-black text-blue-400 uppercase block">Index V</span>
                          <p className="text-lg font-black text-blue-900 font-mono">{analyzingSubject.svi.toFixed(2)}</p>
                       </div>
                    </div>
                 </div>

                 {isAiLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-6">
                       <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                       <p className="text-[10px] font-black text-blue-900 uppercase tracking-[0.6em] animate-pulse">Scanning Cloud Knowledge Shards...</p>
                    </div>
                 ) : (
                    <div className="prose prose-sm max-w-none">
                       <div className="bg-slate-900 text-blue-50 p-8 rounded-[2rem] shadow-inner font-mono text-[12px] leading-relaxed whitespace-pre-wrap uppercase">
                          {aiOutput}
                       </div>
                    </div>
                 )}
              </div>

              <div className="p-8 border-t border-gray-100 flex justify-center shrink-0">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em]">United Baylor Academy — Central Command Core</p>
              </div>
           </div>
        </div>
      )}

      {/* NRT Composite Table */}
      <div className="overflow-x-auto shadow-2xl rounded-[3rem] border-4 border-blue-900/10 bg-white">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-blue-950 text-white uppercase text-[8px] font-black tracking-[0.2em]">
              <th className="p-4 border-r border-blue-900 w-10">Rank</th>
              <th className="p-4 border-r border-blue-900 text-left min-w-[200px]">Pupil Full Identity</th>
              {SUBJECT_LIST.map(sub => (
                <th key={sub} className="p-2 border-r border-blue-900" colSpan={2}>{sub.substring(0, 12)}</th>
              ))}
              <th className="p-2 bg-slate-800 font-black">Sum (A+B)</th>
              <th className="p-2 bg-red-700 font-black">Composite</th>
              <th className="p-2 bg-red-800 font-black">Agg</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-blue-100 transition-colors border-b border-gray-100 font-bold">
                <td className="p-2 text-center border-r border-gray-100">{student.rank}</td>
                <td className="p-2 uppercase text-blue-950 border-r border-gray-100 truncate">{student.name}</td>
                {SUBJECT_LIST.map(subName => {
                  const subData = student.subjects.find(s => s.subject === subName);
                  return (
                    <React.Fragment key={subName}>
                      <td className="p-1.5 text-center font-mono text-gray-500 border-r border-gray-50">{Math.round(subData?.finalCompositeScore || 0)}</td>
                      <td className={`p-1.5 text-center font-black border-r border-gray-100 ${getGradeColor(subData?.grade || '')}`}>{subData?.grade || '-'}</td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-center bg-slate-50 text-slate-500 border-r border-gray-100">
                  {Math.round(student.subjects.reduce((sum, s) => sum + (s.score || 0), 0) / (student.subjects.length || 1))}
                </td>
                <td className="p-2 text-center bg-blue-50 text-blue-900 border-r border-gray-100">
                  {Math.round(student.subjects.reduce((sum, s) => sum + (s.finalCompositeScore || 0), 0) / (student.subjects.length || 1))}
                </td>
                <td className="p-2 text-center text-red-700 bg-red-50">{student.bestSixAggregate}</td>
              </tr>
            ))}
          </tbody>
          {/* COHORT STATS FOOTER */}
          <tfoot className="bg-slate-900 text-white uppercase font-black text-[6px] tracking-widest border-t-4 border-blue-950">
             <tr className="h-12">
                <td colSpan={2} className="px-6 text-right bg-blue-950 border-r border-blue-900">Cohort Mean (μ)</td>
                {SUBJECT_LIST.map(sub => (
                   <td key={sub + '-mean'} colSpan={2} className="text-center font-mono text-[10px] text-blue-300 border-r border-slate-800">
                      {Math.round(stats.subjectMeans[sub] || 0)}
                   </td>
                ))}
                <td colSpan={3} className="bg-blue-950/50"></td>
             </tr>
             <tr className="h-12">
                <td colSpan={2} className="px-6 text-right bg-slate-950 border-r border-slate-800">Std Deviation (σ)</td>
                {SUBJECT_LIST.map(sub => (
                   <td key={sub + '-sd'} colSpan={2} className="text-center font-mono text-[9px] text-slate-500 border-r border-slate-800">
                      {(stats.subjectStdDevs[sub] || 0).toFixed(2)}
                   </td>
                ))}
                <td colSpan={3} className="bg-slate-950"></td>
             </tr>
          </tfoot>
        </table>
      </div>

      {/* SVI Ranking Section */}
      <section className="space-y-10 page-break-inside-avoid">
        <div className="flex items-center gap-6 border-b-4 border-blue-950 pb-4">
           <div className="w-16 h-16 bg-blue-950 text-white rounded-[2rem] flex items-center justify-center shadow-2xl">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
           </div>
           <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter text-blue-950 leading-none">Subject Vitality Index (SVI)</h3>
              <p className="text-[12px] font-black text-blue-600 uppercase tracking-widest mt-1">Efficiency Ranking & Facilitator Impact (Click Card to Diagnose Performance)</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
          {facilitatorAnalytics.map((fa, i) => (
            <div 
              key={fa.subject} 
              onClick={() => runAiDiagnostic(fa.subject, fa.mean, fa.svi)}
              className="bg-white border-2 border-blue-900/10 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden group hover:scale-[1.05] hover:border-blue-500 cursor-pointer transition-all duration-300 border-b-8 border-b-blue-900 print:shadow-none print:border-gray-300"
            >
              <div className="absolute top-0 right-0 bg-blue-950 text-white px-6 py-2 rounded-bl-[2.5rem] font-black text-xs tracking-widest group-hover:bg-blue-600 transition-colors">
                #{i+1}
              </div>
              <div className="mb-6">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">{fa.subject}</span>
                <p className="text-lg font-black text-slate-900 uppercase truncate leading-none group-hover:text-blue-900 transition-colors">{fa.facilitatorName}</p>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-center">
                     <span className="text-[8px] font-black text-blue-400 uppercase block">Mean</span>
                     <p className="text-lg font-black text-blue-950 font-mono">{Math.round(fa.mean)}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                     <span className="text-[8px] font-black text-slate-400 uppercase block">SD (σ)</span>
                     <p className="text-lg font-black text-indigo-600 font-mono">{fa.sd.toFixed(1)}</p>
                   </div>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vitality</span>
                  <span className="text-3xl font-black text-blue-900 font-mono tracking-tighter">{fa.svi.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-[7px] font-black text-blue-600 uppercase tracking-[0.3em]">Launch AI Diagnostic</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPOSITE SHEET Σ: Mathematical Model & Performance Formulas */}
      <section className="mt-16 bg-slate-100 border-4 border-double border-slate-300 p-12 rounded-[4rem] space-y-10 page-break-inside-avoid shadow-inner">
         <div className="text-center space-y-2">
            <h4 className="text-2xl font-black text-slate-950 uppercase tracking-[0.4em]">ACADEMY ANALYTICAL STANDARDS</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[1em]">Mathematical Model & Performance Formulas</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-4">
               <div className="flex items-center gap-4">
                  <span className="w-12 h-12 bg-blue-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">Σ</span>
                  <h5 className="font-black text-blue-900 uppercase text-xs tracking-widest leading-none">Composite Sum</h5>
               </div>
               <p className="text-[12px] font-mono font-black text-slate-600">Sum = Section A + Section B</p>
               <p className="text-[11px] leading-relaxed text-slate-700 font-bold uppercase">As per instruction, the composite score is the absolute sum of Objective and Theory papers. Grading is derived from this total.</p>
            </div>
            <div className="space-y-4">
               <div className="flex items-center gap-4">
                  <span className="w-12 h-12 bg-indigo-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">Z</span>
                  <h5 className="font-black text-indigo-900 uppercase text-xs tracking-widest leading-none">NRT Positioning</h5>
               </div>
               <p className="text-[12px] font-mono font-black text-slate-600">Z = (x - μ) / σ</p>
               <p className="text-[11px] leading-relaxed text-slate-700 font-bold uppercase">Determines the student's distance from the class mean (μ) in standard deviation (σ) units. This establishes the percentile-based grade.</p>
            </div>
            <div className="space-y-4">
               <div className="flex items-center gap-4">
                  <span className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">%</span>
                  <h5 className="font-black text-emerald-900 uppercase text-xs tracking-widest leading-none">Quality Pass Rate</h5>
               </div>
               <p className="text-[12px] font-mono font-black text-slate-600">QPR = (P₁₋₆ / N) * 100</p>
               <p className="text-[11px] leading-relaxed text-slate-700 font-bold uppercase">Percentage of pupils achieving Merit or better (Aggregates 1-6) in the examined subject area.</p>
            </div>
            <div className="space-y-4">
               <div className="flex items-center gap-4">
                  <span className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">V</span>
                  <h5 className="font-black text-slate-900 uppercase text-xs tracking-widest leading-none">Vitality Index (SVI)</h5>
               </div>
               <p className="text-[12px] font-mono font-black text-slate-600">SVI = 0.4μ + 0.4Q + 0.2C</p>
               <p className="text-[11px] leading-relaxed text-slate-700 font-bold uppercase">Composite index weighting Mean (μ), Quality (Q), and Consistency (C) to rank institutional efficiency.</p>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8 border-t-2 border-slate-300">
            <div className="space-y-4">
               <h6 className="text-[13px] font-black text-slate-950 uppercase tracking-widest">Interpreting Deviation (σ)</h6>
               <ul className="space-y-2">
                  <li className="text-[11px] font-bold text-slate-700 uppercase flex items-start gap-3"><span className="text-blue-600">•</span> Low σ (&lt; 10): Indicates uniform learning outcomes across the cohort; concept mastery is consistent.</li>
                  <li className="text-[11px] font-bold text-slate-700 uppercase flex items-start gap-3"><span className="text-red-600">•</span> High σ (&gt; 15): Indicates extreme learning gaps; remedial action is required for lower-tier students.</li>
               </ul>
            </div>
            <div className="space-y-4">
               <h6 className="text-[13px] font-black text-slate-950 uppercase tracking-widest">NRT Ranking Logic</h6>
               <p className="text-[11px] leading-relaxed text-slate-700 font-bold uppercase">The NRT System ensures that grades reflect the pupil's position within the local group context. Grades are derived from Z-score thresholds applied to the Normal Distribution Curve. This means pupils are measured against the actual difficulty experienced by their peers.</p>
            </div>
         </div>

         <div className="pt-12 flex justify-between items-end border-t-2 border-slate-950/20">
            <div className="w-[35%] text-center border-t-2 border-slate-900 pt-4">
               <p className="text-[12px] font-black uppercase text-slate-500 tracking-[0.3em] leading-none">
                <EditableField 
                  value={settings.registryRoleTitle || 'Examination Registry'} 
                  onChange={(v) => onSettingChange('registryRoleTitle', v.toUpperCase())}
                  className="text-[12px] font-black tracking-[0.3em]"
                />
               </p>
               <p className="text-[10px] font-bold text-slate-400 italic uppercase">Authorized Signature Node</p>
            </div>
            <div className="w-[35%] text-center border-t-2 border-slate-900 pt-4">
               <p className="font-black text-[16px] uppercase text-blue-950 leading-none">
                 <EditableField 
                  value={settings.headTeacherName} 
                  onChange={(v) => onSettingChange('headTeacherName', v.toUpperCase())}
                  className="text-[16px] font-black"
                />
               </p>
               <p className="text-[12px] font-black uppercase text-slate-500 tracking-widest leading-none mt-1">
                 <EditableField 
                  value={settings.adminRoleTitle || 'Academy Director'} 
                  onChange={(v) => onSettingChange('adminRoleTitle', v.toUpperCase())}
                  className="text-[12px] font-black tracking-widest"
                />
               </p>
               <p className="text-[10px] font-bold text-slate-400 italic uppercase mt-1">Institutional Director's Seal</p>
            </div>
         </div>
      </section>

      <footer className="py-10 text-center opacity-30">
         <p className="text-[10px] font-black uppercase tracking-[2em]">MOCK ANALYSIS SS-MAP — DATA INTEGRITY SHARD</p>
      </footer>
    </div>
  );
};

export default CompositeSheet;