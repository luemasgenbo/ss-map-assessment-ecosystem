import React, { useMemo } from 'react';
import { ProcessedStudent, ClassStatistics, GlobalSettings, StaffAssignment } from '../../types';
import { SUBJECT_LIST } from '../../constants';

interface InstitutionalAnalyticsProps {
  students: ProcessedStudent[];
  stats: ClassStatistics;
  settings: GlobalSettings;
  facilitators: Record<string, StaffAssignment>;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
}

const InstitutionalAnalytics: React.FC<InstitutionalAnalyticsProps> = ({ students, stats, settings, facilitators, onSettingChange }) => {
  const analytics = useMemo(() => {
    // 1. Calculate Average QPR and SVI for current mock
    const subjectMetrics = SUBJECT_LIST.map((subject) => {
      const total = students.length;
      const quality = students.filter(s => {
        const sub = s.subjects.find(sub => sub.subject === subject);
        return sub && sub.gradeValue <= 6;
      }).length;
      
      const qpr = total > 0 ? (quality / total) * 100 : 0;
      const mean = stats.subjectMeans[subject] || 0;
      const sd = stats.subjectStdDevs[subject] || 0;
      const consistency = Math.max(0, 100 - (sd * 3.33));
      const svi = (mean * 0.4) + (qpr * 0.4) + (consistency * 0.2);
      
      return { qpr, svi, mean };
    });

    const avgQPR = subjectMetrics.reduce((a, b) => a + b.qpr, 0) / (SUBJECT_LIST.length || 1);
    const avgSVI = subjectMetrics.reduce((a, b) => a + b.svi, 0) / (SUBJECT_LIST.length || 1);
    const currentGlobalMean = subjectMetrics.reduce((a, b) => a + b.mean, 0) / (SUBJECT_LIST.length || 1);

    // 2. GROWTH ANALYSIS (MOMENTUM)
    // Compare current mean to the previous mock in the series if it exists in historical student records
    const mockNames = settings.committedMocks || [];
    const currentMockIdx = mockNames.indexOf(settings.activeMock);
    const prevMockName = currentMockIdx > 0 ? mockNames[currentMockIdx - 1] : null;

    let momentum = 0;
    let prevGlobalMean = 0;

    if (prevMockName) {
      const historicalMeans = SUBJECT_LIST.map(sub => {
         const pupilsWithPrevData = students.filter(s => s.seriesHistory?.[prevMockName]);
         if (pupilsWithPrevData.length === 0) return 0;
         const subHistory = pupilsWithPrevData.map(s => {
            const hist = s.seriesHistory?.[prevMockName]?.subScores?.[sub];
            return hist ? (hist.sectionA + hist.sectionB) : 0;
         });
         return subHistory.reduce((a,b)=>a+b, 0) / subHistory.length;
      });
      prevGlobalMean = historicalMeans.reduce((a,b)=>a+b, 0) / (SUBJECT_LIST.length || 1);
      if (prevGlobalMean > 0) {
        momentum = ((currentGlobalMean - prevGlobalMean) / prevGlobalMean) * 100;
      }
    }

    const males = students.filter(s => s.gender === 'M');
    const females = students.filter(s => s.gender === 'F');
    const maleAvg = males.length > 0 ? males.reduce((sum, s) => sum + s.totalScore, 0) / males.length : 0;
    const femaleAvg = females.length > 0 ? females.reduce((sum, s) => sum + s.totalScore, 0) / females.length : 0;

    const meanAgg = students.length > 0 ? students.reduce((sum, s) => sum + s.bestSixAggregate, 0) / students.length : 1;
    const strengthIndex = (currentGlobalMean / meanAgg) / 5;

    return { 
      avgQPR, 
      avgSVI, 
      momentum,
      prevGlobalMean,
      currentGlobalMean,
      males: males.length, 
      females: females.length, 
      maleAvg, 
      femaleAvg, 
      strengthIndex 
    };
  }, [students, stats, settings.activeMock, settings.committedMocks]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      
      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-blue-950 text-white p-8 rounded-[3rem] shadow-xl border border-blue-900 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full -mr-8 -mt-8"></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Academy NRT Strength</span>
          <p className="text-4xl font-black mt-2 font-mono">{analytics.strengthIndex.toFixed(2)}</p>
          <p className="text-[8px] mt-2 opacity-50 uppercase font-bold text-blue-200">Efficiency Ratio (μ/Agg)</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 relative">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Growth Momentum</span>
          <div className="flex items-end gap-3">
             <p className={`text-4xl font-black font-mono leading-none ${analytics.momentum >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {analytics.momentum >= 0 ? '+' : ''}{analytics.momentum.toFixed(1)}%
             </p>
             <svg className={`mb-1 ${analytics.momentum >= 0 ? 'text-emerald-500' : 'text-red-500'}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                {analytics.momentum >= 0 ? <path d="M7 17l9.2-9.2M17 17V7H7"/> : <path d="M7 7l9.2 9.2M7 17h10V7"/>}
             </svg>
          </div>
          <p className="text-[8px] mt-3 text-slate-500 uppercase font-black tracking-widest">Rate of Instructional Velocity</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 relative">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Mean Vitality (SVI)</span>
          <p className="text-4xl font-black mt-2 text-indigo-900 font-mono">{analytics.avgSVI.toFixed(2)}</p>
          <p className="text-[8px] mt-2 text-indigo-400 uppercase font-black tracking-widest">Institutional Energy Index</p>
        </div>
        <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl border border-slate-800 relative">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Census</span>
          <p className="text-4xl font-black mt-2 font-mono text-white">{students.length}</p>
          <p className="text-[8px] mt-2 text-slate-400 uppercase font-bold tracking-widest">Verified Enrolled Pupils</p>
        </div>
      </div>

      {/* Analytics Main Ledger */}
      <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-10 py-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-black uppercase text-gray-900 tracking-tighter">Performance Transition Shard</h3>
          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1 rounded-full uppercase tracking-widest border border-blue-100">Cycle: {settings.activeMock} Analysis</span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-blue-950 text-white uppercase text-[8px] font-black tracking-[0.3em]">
            <tr>
              <th className="px-10 py-5">Succession Metric Identity</th>
              <th className="px-10 py-5 text-center">Section Range (μ)</th>
              <th className="px-10 py-5 text-center">Gender Population Matrix</th>
              <th className="px-10 py-5 text-right">Composite Score / Gender</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-blue-50/30 transition-colors">
              <td className="px-10 py-8">
                 <span className="text-[11px] font-black text-blue-900 uppercase block mb-1">Successive Growth Velocity</span>
                 <p className="text-[9px] text-gray-400 italic font-medium uppercase leading-relaxed max-w-[250px]">
                    Current μ: {analytics.currentGlobalMean.toFixed(1)} vs Previous μ: {analytics.prevGlobalMean.toFixed(1)}
                 </p>
              </td>
              <td className="px-10 py-8 text-center">
                 <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-indigo-900 font-mono">{analytics.currentGlobalMean.toFixed(1)}%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Global Shard Mean</span>
                 </div>
              </td>
              <td className="px-10 py-8">
                 <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-6">
                       <span className="text-[10px] font-black text-blue-600 uppercase">Male: {analytics.males}</span>
                       <span className="text-[10px] font-black text-pink-600 uppercase">Female: {analytics.females}</span>
                    </div>
                    <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                       <div className="bg-blue-600" style={{ width: `${(analytics.males/(students.length||1))*100}%` }}></div>
                       <div className="bg-pink-600" style={{ width: `${(analytics.females/(students.length||1))*100}%` }}></div>
                    </div>
                 </div>
              </td>
              <td className="px-10 py-8 text-right space-y-2">
                 <div className="flex justify-end items-center gap-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Male_μ:</span>
                    <span className="text-lg font-black text-blue-900 font-mono">{analytics.maleAvg.toFixed(1)}</span>
                 </div>
                 <div className="flex justify-end items-center gap-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Female_μ:</span>
                    <span className="text-lg font-black text-pink-700 font-mono">{analytics.femaleAvg.toFixed(1)}</span>
                 </div>
              </td>
            </tr>
          </tbody>
          <tfoot className="bg-slate-900 text-white">
            <tr>
              <td colSpan={2} className="px-10 py-8">
                <div className="flex items-center gap-5">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xl ${analytics.momentum >= 0 ? 'bg-emerald-600' : 'bg-red-600'}`}>
                      {analytics.momentum >= 0 ? '↑' : '↓'}
                   </div>
                   <div>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] block mb-1">Momentum Conclusion</span>
                      <p className="text-sm font-black uppercase tracking-tight">
                         {analytics.momentum > 5 ? 'Exponential Growth Shard Detected' : 
                          analytics.momentum > 0 ? 'Stable Positive Momentum' : 
                          analytics.momentum === 0 ? 'Baseline Performance Standard' : 'Performance Decline Mitigation Required'}
                      </p>
                   </div>
                </div>
              </td>
              <td colSpan={2} className="px-10 py-8 text-right">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Generated by SS-MAP Master Core Node</p>
                 <p className="text-[10px] font-mono text-white/30 tracking-tighter">{new Date().toISOString()}</p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Momentum Logic Explanation Shard */}
      <div className="bg-slate-100 p-10 rounded-[3rem] border-2 border-dashed border-slate-300 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-900/5 rounded-bl-full"></div>
         <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-4">IV. Growth Rate (Momentum) Logic Shard</h4>
         <p className="text-[10px] leading-relaxed text-slate-600 font-bold uppercase tracking-widest">
            Momentum is calculated as the mathematical change between the previous mock cycle's global mean (μ₁) and the current mock cycle's global mean (μ₂). A positive momentum shard indicates instructional strategies are effectively yielding higher cognitive acquisition across the cohort. A negative momentum shard triggers a mandatory root-cause audit in the recruitment hub.
         </p>
      </div>

    </div>
  );
};

export default InstitutionalAnalytics;