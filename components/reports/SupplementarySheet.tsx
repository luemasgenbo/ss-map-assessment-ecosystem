import React, { useMemo } from 'react';
import { ProcessedStudent, ClassStatistics, GlobalSettings } from '../../types';
import { SUBJECT_LIST } from '../../constants';

interface SupplementarySheetProps {
  students: ProcessedStudent[];
  stats: ClassStatistics;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  section: 'sectionA' | 'sectionB';
}

const SupplementarySheet: React.FC<SupplementarySheetProps> = ({ students, stats, settings, onSettingChange, section }) => {
  const sectionLabel = section === 'sectionA' ? 'Objectives (Sec A)' : 'Theory (Sec B)';
  const colorClass = section === 'sectionA' ? 'text-blue-600' : 'text-purple-600';
  const headerBg = section === 'sectionA' ? 'bg-blue-950' : 'bg-purple-950';

  const subjectRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number; range: number }> = {};
    SUBJECT_LIST.forEach(sub => {
      const scores = students.map(s => {
        const mockSet = s.mockData?.[settings.activeMock];
        const subSc = mockSet?.examSubScores?.[sub] || { sectionA: 0, sectionB: 0 };
        return section === 'sectionA' ? subSc.sectionA : subSc.sectionB;
      }).filter(s => s !== undefined);

      if (scores.length > 0) {
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        ranges[sub] = { min, max, range: max - min };
      } else {
        ranges[sub] = { min: 0, max: 0, range: 0 };
      }
    });
    return ranges;
  }, [students, section, settings.activeMock]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="overflow-x-auto shadow-2xl rounded-[3rem] border-4 border-blue-900/10 bg-white">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className={`${headerBg} text-white uppercase text-[8px] font-black tracking-[0.2em]`}>
              <th className="p-4 border-r border-white/10 w-10">Rank</th>
              <th className="p-4 border-r border-white/10 text-left min-w-[200px]">Pupil Full Identity</th>
              {SUBJECT_LIST.map(sub => (
                <th key={sub} className="p-3 border-r border-white/10 min-w-[80px] text-[8px]">{sub.substring(0, 15)}</th>
              ))}
            </tr>
            <tr className="bg-gray-100 text-[8px] font-black uppercase text-gray-500 border-b border-gray-200">
              <th colSpan={2} className="p-2 text-right italic pr-4">Analysis: {sectionLabel}</th>
              {SUBJECT_LIST.map(sub => (
                <th key={sub + '-max'} className="p-2 border-x border-gray-200">
                  MAX: {section === 'sectionA' ? settings.maxSectionA : settings.maxSectionB}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                <td className="p-2 text-center font-black border-r border-gray-100 text-[9px]">{student.rank}</td>
                <td className="p-2 uppercase font-black text-blue-950 border-r border-gray-200 truncate text-[9px]">{student.name}</td>
                {SUBJECT_LIST.map(subName => {
                  const mockSet = student.mockData?.[settings.activeMock];
                  const activeSubScores = mockSet?.examSubScores?.[subName] || { sectionA: 0, sectionB: 0 };
                  const score = section === 'sectionA' ? activeSubScores.sectionA : activeSubScores.sectionB;
                  return (
                    <td key={subName} className={`p-2 text-center font-mono text-[11px] border-r border-gray-100 font-bold ${colorClass}`}>
                       {score}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 text-white font-black border-t-2 border-gray-900 uppercase text-[8px]">
            <tr className="bg-slate-800">
              <td colSpan={2} className="p-3 text-right text-blue-300 tracking-widest border-r border-slate-700">Section Mean (μ)</td>
              {SUBJECT_LIST.map(sub => (
                <td key={sub + '-mean'} className="p-2 text-center text-blue-100 font-mono text-[11px] border-r border-slate-700">
                   {Math.round(section === 'sectionA' ? (stats.subjectSectionAMeans[sub] || 0) : (stats.subjectSectionBMeans[sub] || 0))}
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={2} className="p-3 text-right text-slate-500 tracking-widest border-r border-slate-800">Std Deviation (σ)</td>
              {SUBJECT_LIST.map(sub => (
                <td key={sub + '-std'} className="p-2 text-center text-slate-500 font-mono text-[9px] border-r border-slate-800">
                   {(section === 'sectionA' ? (stats.subjectSectionAStdDevs[sub] || 0) : (stats.subjectSectionBStdDevs[sub] || 0)).toFixed(2)}
                </td>
              ))}
            </tr>
            <tr className="bg-slate-950">
              <td colSpan={2} className="p-3 text-right text-indigo-400 tracking-widest border-r border-slate-800">Score Range (Max-Min)</td>
              {SUBJECT_LIST.map(sub => (
                <td key={sub + '-range'} className="p-2 text-center text-indigo-300 font-mono text-[10px] border-r border-slate-800">
                   {subjectRanges[sub].range} <span className="text-[7px] text-slate-600">({subjectRanges[sub].max}-{subjectRanges[sub].min})</span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default SupplementarySheet;