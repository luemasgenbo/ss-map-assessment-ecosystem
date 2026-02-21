import React from 'react';
import { StudentData, GlobalSettings, MockSeriesRecord } from '../../types';
import EditableField from '../shared/EditableField';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface SeriesBroadSheetProps {
  students: StudentData[];
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  currentProcessed: { id: number; bestSixAggregate: number; rank: number; totalScore: number; category: string }[];
}

const SeriesBroadSheet: React.FC<SeriesBroadSheetProps> = ({ students, settings, onSettingChange, currentProcessed }) => {
  const mockSeriesNames = settings.committedMocks || [];
  const subjectCount = 10;

  const getAggGrade = (agg: number) => {
    if (agg <= 10) return { label: 'EXC', color: 'text-emerald-600' };
    if (agg <= 20) return { label: 'HIGH', color: 'text-blue-600' };
    if (agg <= 36) return { label: 'PASS', color: 'text-orange-600' };
    return { label: 'REM', color: 'text-red-600' };
  };

  const calculateRate = (record: MockSeriesRecord | undefined) => {
    if (!record || !record.subScores) return '-';
    const total = Object.values(record.subScores).reduce((acc, sub: any) => acc + ((sub.sectionA || 0) + (sub.sectionB || 0)), 0);
    return ((total / (subjectCount * 100)) * 100).toFixed(1);
  };

  return (
    <div className="bg-white p-6 print:p-0 min-h-screen max-w-full font-sans">
      <ReportBrandingHeader 
        settings={settings} 
        onSettingChange={onSettingChange} 
        reportTitle={settings.examTitle}
        subtitle="LONGITUDINAL ACADEMIC JOURNEY (MOCKS 1-10)"
        isLandscape={true}
        readOnly={false}
      />
      
      <div className="shadow-2xl border border-gray-200 rounded-[2.5rem] bg-white overflow-hidden relative mt-8">
        <div className="overflow-x-auto custom-scrollbar-horizontal scroll-smooth">
          <table className="w-full text-[10px] border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-blue-950 text-white uppercase text-[8px] font-black tracking-widest">
                <th className="p-5 text-left min-w-[240px] border-r border-blue-900 sticky left-0 bg-blue-950 z-40">
                  Candidate Identity Node
                </th>
                {mockSeriesNames.map((m) => (
                  <th key={m} className="p-3 border-r border-blue-900 text-center min-w-[140px]" colSpan={3}>{m}</th>
                ))}
                <th className="p-3 bg-red-700 text-center font-black min-w-[180px]" colSpan={3}>Live Real-time Data</th>
              </tr>
              <tr className="bg-blue-50 text-blue-900 uppercase text-[7px] font-black border-b-2 border-blue-900">
                <th className="p-3 border-r border-blue-100 sticky left-0 bg-blue-50 z-40">Identity Node</th>
                {mockSeriesNames.map((m) => (
                  <React.Fragment key={m + '-sub'}>
                    <th className="p-1.5 border-r border-blue-100 w-10 text-center">Agg</th>
                    <th className="p-1.5 border-r border-blue-100 w-12 text-center">Rate%</th>
                    <th className="p-1.5 border-r border-blue-100 w-12 text-center">Grade</th>
                  </React.Fragment>
                ))}
                <th className="p-1.5 border-r border-red-100 w-12 bg-red-50 text-red-700 text-center">Agg</th>
                <th className="p-1.5 border-r border-red-100 w-14 bg-red-50 text-red-700 text-center">Rate%</th>
                <th className="p-1.5 bg-red-50 text-red-700 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const live = currentProcessed.find(p => p.id === student.id);
                return (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors group leading-none">
                    <td className="p-4 font-black uppercase text-blue-900 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-blue-50/50 z-30 shadow-md">
                      {student.name}
                    </td>
                    {mockSeriesNames.map((m) => {
                      const record = student.seriesHistory?.[m];
                      const rate = calculateRate(record);
                      const gradeInfo = record ? getAggGrade(record.aggregate) : null;
                      return (
                        <React.Fragment key={m + student.id}>
                          <td className="p-2 border-r border-gray-50 text-center font-mono font-bold text-gray-500">{record?.aggregate || '-'}</td>
                          <td className="p-2 border-r border-gray-50 text-center font-mono text-[9px] text-indigo-400">{rate !== '-' ? rate + '%' : '-'}</td>
                          <td className={`p-2 border-r border-gray-50 text-center font-black text-[9px] ${gradeInfo?.color || ''}`}>{gradeInfo?.label || '-'}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="p-3 bg-red-50 text-center font-black text-red-700 text-sm border-r border-red-100">{live?.bestSixAggregate || '-'}</td>
                    <td className="p-3 bg-red-50 text-center font-mono text-xs text-red-600 border-r border-red-100">{live ? ((live.totalScore / (subjectCount * 100)) * 100).toFixed(1) + '%' : '-'}</td>
                    <td className="p-3 bg-red-50 text-center font-black text-[8px] uppercase text-red-800">{live?.category || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-end mt-16 pt-8 border-t-2 border-slate-900">
          <div className="w-[35%] text-center border-t border-slate-400 pt-2">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">
              <EditableField 
                value={settings.registryRoleTitle || 'Examination Registry'} 
                onChange={(v) => onSettingChange('registryRoleTitle', v.toUpperCase())}
                className="text-[10px] font-black tracking-widest"
              />
            </p>
          </div>
          <div className="w-[35%] text-center border-t border-slate-400 pt-2">
            <p className="font-black text-[12px] uppercase text-blue-950 leading-none">
              <EditableField 
                value={settings.headTeacherName} 
                onChange={(v) => onSettingChange('headTeacherName', v.toUpperCase())}
                className="text-[12px] font-black"
              />
            </p>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mt-1">
              <EditableField 
                value={settings.adminRoleTitle || 'Academy Director'} 
                onChange={(v) => onSettingChange('adminRoleTitle', v.toUpperCase())}
                className="text-[10px] font-black tracking-widest"
              />
            </p>
          </div>
      </div>

      <div className="mt-12 text-center py-6 border-t border-gray-100 opacity-40">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500">SS-Map Hub — Longitudinal Persistence Shard</p>
      </div>
    </div>
  );
};

export default SeriesBroadSheet;
