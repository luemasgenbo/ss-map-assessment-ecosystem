import React, { useState, useMemo, useEffect } from 'react';
import { ProcessedStudent, GlobalSettings, ClassStatistics } from '../../types';
import EditableField from '../shared/EditableField';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface ReportCardProps {
  student: ProcessedStudent;
  stats: ClassStatistics;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  onStudentUpdate?: (id: number, overallRemark: string) => void;
  classAverageAggregate: number;
  totalEnrolled?: number;
  isFacilitator?: boolean;
  loggedInUser?: { name: string; nodeId: string; role: string; email?: string; subject?: string } | null;
  readOnly?: boolean;
}

const PrestigeReport: React.FC<any> = ({ student, stats, settings, onSettingChange, totalEnrolled, readOnly, gradeDistribution, classAverageAggregate }) => {
  const attendanceRate = (student.attendance / settings.attendanceTotal) * 100;
  const isAboveAverage = student.bestSixAggregate < classAverageAggregate;
  
  const conductRemark = attendanceRate > 90 
    ? "Candidate maintains exemplary discipline and consistent presence."
    : attendanceRate > 75 
    ? "Satisfactory attendance; however, improved consistency is encouraged for optimal performance."
    : "Irregular attendance pattern observed. Discipline calibration and parental intervention required.";

  const academicRemark = `Student aggregate of ${student.bestSixAggregate} vs class average of ${classAverageAggregate.toFixed(1)}. ${isAboveAverage ? 'Performing above peer average with measurable growth.' : 'Requires intensive academic focus to meet peer benchmarks.'} Growth matrix indicates ${student.bestSixAggregate < 12 ? 'high-velocity mastery' : 'steady progression'}. Recommendation: ${student.bestSixAggregate < 15 ? 'Enrichment in advanced strands.' : 'Remedial support in core disciplines.'}`;

  const adminRemark = `Intervention Method: ${student.bestSixAggregate > 20 ? 'Mandatory after-school clinic for identified weak strands.' : 'Peer-to-peer collaborative learning clusters.'} Remedial Action: Targeted practice in ${student.subjects[0]?.subject || 'core areas'} to bridge identified gaps.`;

  return (
  <div className="bg-white w-[210mm] h-[297mm] shadow-2xl print:shadow-none print:border-none flex flex-col p-8 box-border font-sans overflow-hidden border border-gray-200 flex-shrink-0">
    {/* HEADER AREA - 18% */}
    <div className="h-[18%] flex flex-col justify-center shrink-0 border-b-2 border-blue-900/10 mb-2">
      <ReportBrandingHeader 
        settings={settings} 
        onSettingChange={onSettingChange} 
        reportTitle={settings.examTitle}
        subtitle="OFFICIAL ACADEMIC ATTAINMENT RECORD"
        isLandscape={false}
        readOnly={readOnly}
      />
    </div>

    {/* GRID BOXES AREA - 40% */}
    <div className="h-[40%] flex flex-col shrink-0 py-2 overflow-hidden">
      {/* CANDIDATE PARTICULARS - Moved to Grid Area */}
      <div className="grid grid-cols-2 gap-4 mb-2">
        <div className="border-[1.5px] border-blue-900 rounded-xl overflow-hidden bg-blue-50">
          <div className="bg-blue-950 text-white text-[8px] leading-none font-black px-3 py-1.5 uppercase tracking-widest flex items-center justify-between">
            <span>Logistics Node</span>
            <span className="font-mono">NODE-0{student.id % 9}</span>
          </div>
          <div className="divide-y divide-blue-200">
            {[
              {l:'Series Cycle',k:'activeMock',v:settings.activeMock},
              {l:'Current Term',k:'termInfo',v:settings.termInfo},
              {l:'Academic Yr',k:'academicYear',v:settings.academicYear},
            ].map((item, i) => (
              <div key={i} className="flex h-4 items-center px-3 gap-2">
                <span className="text-[8px] leading-none font-black text-blue-950 uppercase w-[60px] shrink-0 border-r border-blue-200">{item.l}</span>
                <div className="text-[8px] leading-none font-black text-blue-900 uppercase truncate flex-1">
                  <EditableField 
                    value={item.v} 
                    onChange={(val) => onSettingChange(item.k as keyof GlobalSettings, val.toUpperCase())}
                    className="text-[8px] leading-none"
                    disabled={readOnly}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-[1.5px] border-blue-900 rounded-xl overflow-hidden bg-indigo-50">
          <div className="bg-blue-950 text-white text-[8px] leading-none font-black px-3 py-1.5 uppercase tracking-widest flex items-center justify-between">
            <span>Candidate Particulars</span>
            <span>VERIFIED</span>
          </div>
          <div className="divide-y divide-indigo-200">
            {[
              {l:'Full Name',v:student.name},
              {l:'Attendance',v:`${student.attendance} / ${settings.attendanceTotal}`},
              {l:'Mock Rank',v:`#${student.rank} OF ${totalEnrolled}`},
            ].map((item, i) => (
              <div key={i} className="flex h-4 items-center px-3 gap-2">
                <span className="text-[8px] leading-none font-black text-indigo-950 uppercase w-[60px] shrink-0 border-r border-indigo-200">{item.l}</span>
                <span className="text-[8px] leading-none font-black uppercase truncate text-blue-950">{item.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 border-[2px] border-blue-950 rounded-xl overflow-hidden flex flex-col">
        <table className="w-full border-collapse">
          <thead className="bg-blue-950 text-white uppercase text-[10px] leading-none font-black tracking-widest sticky top-0">
            <tr className="h-8">
              <th className="px-3 text-left">Academic Discipline</th>
              <th className="px-1 text-center w-[40px]">Obj</th>
              <th className="px-1 text-center w-[40px]">Thy</th>
              <th className="px-1 text-center w-[50px] bg-blue-900">Sum</th>
              <th className="px-1 text-center w-[40px]">SBA</th>
              <th className="px-1 text-center w-[50px] bg-red-900">Cmp</th>
              <th className="px-1 text-center w-[40px]">Grd</th>
              <th className="px-3 text-left">Remark Shard</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {student.subjects.map((sub: any) => {
              // Color coding logic for Prestige variant
              let rowColor = "bg-white";
              if (sub.gradeValue <= 3) rowColor = "bg-emerald-50";
              else if (sub.gradeValue <= 6) rowColor = "bg-blue-50";
              else rowColor = "bg-red-50";

              return (
                <tr key={sub.subject} className={`${rowColor} font-bold h-8 border-b border-gray-100`}>
                  <td className="px-3 text-blue-950 uppercase truncate max-w-[150px] text-[10px] leading-none border-r border-gray-100">{sub.subject}</td>
                  <td className="text-center font-mono text-gray-500 text-[10px] leading-none border-r border-gray-100">{sub.sectionA ?? '0'}</td>
                  <td className="text-center font-mono text-gray-500 text-[10px] leading-none border-r border-gray-100">{sub.sectionB ?? '0'}</td>
                  <td className="text-center font-black bg-blue-100/50 text-blue-900 text-[10px] leading-none border-r border-blue-950/10">{(sub.sectionA || 0) + (sub.sectionB || 0)}</td>
                  <td className="text-center font-mono text-gray-500 text-[10px] leading-none border-r border-gray-100">{Math.round(sub.sbaScore)}</td>
                  <td className="text-center font-black bg-red-100/50 text-red-900 text-[10px] leading-none border-r border-red-950/10">{Math.round(sub.finalCompositeScore)}</td>
                  <td className={`text-center font-black text-[10px] leading-none border-r border-gray-100 ${sub.gradeValue >= 7 ? 'text-red-700' : 'text-blue-900'}`}>{sub.grade}</td>
                  <td className="px-3 text-[10px] leading-none uppercase text-slate-500 italic truncate max-w-[200px]">{sub.remark}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* PERFORMANCE ANALYSIS HEATMAP - Integrated into Grid Area */}
        <div className="mt-auto p-4 bg-slate-50 border-t border-blue-950/10 grid grid-cols-4 gap-3 h-[60px] shrink-0">
          <div className="col-span-1 bg-blue-950 text-white rounded-xl flex flex-col items-center justify-center border border-blue-900 shadow-lg h-full">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-none">Overall Efficiency</span>
            <span className="text-[14px] font-black font-mono leading-none mt-1">{((student.subjects.filter((s: any)=>s.gradeValue <= 6).length / student.subjects.length)*100).toFixed(0)}%</span>
          </div>
          <div className="col-span-3 border border-blue-900 rounded-xl flex items-center justify-around bg-white h-full px-4">
            {['A1','B2','B3','C4','C5','C6','D7','E8','F9'].map(g => (
              <div key={g} className="flex flex-col items-center justify-center">
                <span className="text-[8px] font-black text-slate-400 leading-none mb-0.5 uppercase tracking-tighter">{g}</span>
                <span className={`text-[10px] font-black leading-none ${gradeDistribution[g] ? 'text-blue-900' : 'text-slate-300'}`}>
                  {gradeDistribution[g] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* OTHERS & SPACING AREA - 40% */}
    <div className="h-[40%] flex flex-col shrink-0 pt-2 gap-2 overflow-hidden">
      <div className="grid grid-cols-3 gap-2 flex-1">
        {/* CONDUCT & ATTENDANCE */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Conduct & Attendance</span>
          <p className="text-[9px] leading-tight font-bold text-slate-700 uppercase italic">
            {conductRemark}
          </p>
        </div>
        
        {/* ACADEMIC RECOMMENDATION (STRENGTH/WEAKNESS) */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col justify-center">
          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Academic Recommendation</span>
          <p className="text-[9px] leading-tight font-bold text-indigo-900 uppercase">
            {academicRemark}
          </p>
        </div>

        {/* ADMINISTRATIVE FEEDBACK */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col justify-center">
          <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Administrative Feedback</span>
          <p className="text-[9px] leading-tight font-bold text-blue-900 uppercase">
            {adminRemark}
          </p>
        </div>
      </div>

      {/* AUTHORIZATIONS - MUST REMAIN ON SHEET ONE */}
      <div className="flex justify-between items-end border-t border-slate-100 pt-2 shrink-0">
        <div className="w-[30%] text-center border-t border-slate-950 pt-1">
          <p className="text-[8px] leading-none font-black uppercase text-slate-400 tracking-widest mb-0.5">Academy Director</p>
          <div className="font-black text-blue-950 text-[8px] leading-none uppercase truncate">
            <EditableField 
              value={settings.headTeacherName} 
              onChange={(v) => onSettingChange('headTeacherName', v.toUpperCase())}
              className="text-[8px] leading-none font-black"
              disabled={readOnly}
            />
          </div>
        </div>
        <div className="w-[30%] text-center border-t border-slate-950 pt-1">
          <p className="text-[8px] leading-none font-black uppercase text-slate-400 tracking-widest mb-0.5">Next Resumption</p>
          <div className="font-black text-red-700 text-[8px] leading-none uppercase">
            <EditableField 
              value={settings.nextTermBegin} 
              onChange={(v) => onSettingChange('nextTermBegin', v)}
              className="text-[8px] leading-none font-black"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

const StandardReport: React.FC<any> = ({ student, settings, onSettingChange, totalEnrolled, readOnly, gradeDistribution, classAverageAggregate }) => {
  const attendanceRate = (student.attendance / settings.attendanceTotal) * 100;
  const isAboveAverage = student.bestSixAggregate < classAverageAggregate;
  
  const conductRemark = attendanceRate > 90 
    ? "Candidate maintains exemplary discipline and consistent presence."
    : attendanceRate > 75 
    ? "Satisfactory attendance; however, improved consistency is encouraged for optimal performance."
    : "Irregular attendance pattern observed. Discipline calibration and parental intervention required.";

  const academicRemark = `Student aggregate of ${student.bestSixAggregate} vs class average of ${classAverageAggregate.toFixed(1)}. ${isAboveAverage ? 'Performing above peer average with measurable growth.' : 'Requires intensive academic focus to meet peer benchmarks.'} Growth matrix indicates ${student.bestSixAggregate < 12 ? 'high-velocity mastery' : 'steady progression'}. Recommendation: ${student.bestSixAggregate < 15 ? 'Enrichment in advanced strands.' : 'Remedial support in core disciplines.'}`;

  const adminRemark = `Intervention Method: ${student.bestSixAggregate > 20 ? 'Mandatory after-school clinic for identified weak strands.' : 'Peer-to-peer collaborative learning clusters.'} Remedial Action: Targeted practice in ${student.subjects[0]?.subject || 'core areas'} to bridge identified gaps.`;

  return (
  <div className="bg-white w-[210mm] h-[297mm] shadow-2xl print:shadow-none print:border-none flex flex-col p-12 box-border font-sans overflow-hidden border border-gray-300 flex-shrink-0">
    {/* HEADER AREA - 18% */}
    <div className="h-[18%] flex flex-col justify-center shrink-0 border-b-2 border-gray-100 mb-4">
      <ReportBrandingHeader 
        settings={settings} 
        onSettingChange={onSettingChange} 
        reportTitle={settings.examTitle}
        subtitle="ACADEMIC PERFORMANCE REPORT"
        isLandscape={false}
        readOnly={readOnly}
        hideMetadataStrip={true}
      />
    </div>

    {/* GRID BOXES AREA - 40% */}
    <div className="h-[40%] flex flex-col shrink-0 py-2 overflow-hidden">
      {/* CANDIDATE PARTICULARS - Moved to Grid Area */}
      <div className="grid grid-cols-2 gap-8 mb-2 border-y border-gray-100 py-1">
        <div className="space-y-0.5">
          <div className="flex justify-between border-b border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Student Name</span>
            <span className="text-[9px] font-black text-gray-900 uppercase leading-none">{student.name}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Index Number</span>
            <span className="text-[9px] font-black text-gray-900 uppercase leading-none">{student.indexNumber || student.id}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Academic Year</span>
            <span className="text-[9px] font-black text-gray-900 uppercase leading-none">{settings.academicYear}</span>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between border-b border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Class Position</span>
            <span className="text-[9px] font-black text-blue-600 uppercase leading-none">Rank {student.rank} of {totalEnrolled}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Attendance</span>
            <span className="text-[9px] font-black text-gray-900 uppercase leading-none">{student.attendance} / {settings.attendanceTotal}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Best 6 Agg</span>
            <span className="text-[9px] font-black text-red-600 uppercase leading-none">{student.bestSixAggregate}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 border-2 border-gray-100 rounded-2xl overflow-hidden flex flex-col">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 text-[9px] font-black text-gray-500 uppercase border-b-2 border-gray-200 h-8">
              <th className="py-1 px-4 text-left leading-none">Discipline</th>
              <th className="py-1 px-2 text-center leading-none">Obj</th>
              <th className="py-1 px-2 text-center leading-none">Thy</th>
              <th className="py-1 px-2 text-center leading-none">SBA</th>
              <th className="py-1 px-2 text-center leading-none">Cmp</th>
              <th className="py-1 px-2 text-center leading-none">Grd</th>
              <th className="py-1 px-4 text-left leading-none">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {student.subjects.map((sub: any) => (
              <tr key={sub.subject} className="text-[9px] h-8">
                <td className="py-0 px-4 font-bold text-gray-800 uppercase leading-none">{sub.subject}</td>
                <td className="py-0 px-2 text-center font-mono text-gray-400 leading-none">{sub.sectionA ?? '0'}</td>
                <td className="py-0 px-2 text-center font-mono text-gray-400 leading-none">{sub.sectionB ?? '0'}</td>
                <td className="py-0 px-2 text-center font-mono text-gray-400 leading-none">{Math.round(sub.sbaScore)}</td>
                <td className="py-0 px-2 text-center font-black text-gray-900 leading-none">{Math.round(sub.finalCompositeScore)}</td>
                <td className={`py-0 px-2 text-center font-black leading-none ${sub.gradeValue >= 7 ? 'text-red-500' : 'text-blue-700'}`}>{sub.grade}</td>
                <td className="py-0 px-4 text-gray-500 italic uppercase leading-none">{sub.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-auto flex items-center justify-between bg-gray-50 p-4 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Overall Efficiency</span>
            <span className="text-xl font-black text-gray-900 leading-none">{((student.subjects.filter((s: any)=>s.gradeValue <= 6).length / student.subjects.length)*100).toFixed(0)}%</span>
          </div>
          <div className="flex gap-6">
            {['A1','B2','B3','C4','C5','C6','D7','E8','F9'].map(g => (
              <div key={g} className="flex flex-col items-center">
                <span className="text-[7px] font-black text-gray-400 uppercase leading-none mb-1">{g}</span>
                <span className={`text-[10px] font-black leading-none ${gradeDistribution[g] ? 'text-blue-600' : 'text-gray-300'}`}>{gradeDistribution[g] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* OTHERS & SPACING AREA - 40% */}
    <div className="h-[40%] flex flex-col shrink-0 pt-4 gap-4 overflow-hidden">
      <div className="grid grid-cols-3 gap-4 flex-1">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-center">
          <h4 className="text-[8px] font-black text-gray-400 uppercase mb-1 leading-none">Conduct & Attendance</h4>
          <p className="text-[9px] font-bold text-gray-700 uppercase leading-tight italic">
            {conductRemark}
          </p>
        </div>
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col justify-center">
          <h4 className="text-[8px] font-black text-indigo-400 uppercase mb-1 leading-none">Academic Recommendation</h4>
          <p className="text-[9px] font-bold text-indigo-900 uppercase leading-tight">
            {academicRemark}
          </p>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col justify-center">
          <h4 className="text-[8px] font-black text-blue-400 uppercase mb-1 leading-none">Administrative Feedback</h4>
          <p className="text-[9px] font-bold text-blue-900 uppercase leading-tight">
            {adminRemark}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-4 flex justify-between items-end border-t border-gray-100">
        <div className="text-center">
          <p className="text-[9px] font-black text-gray-900 uppercase mb-1 leading-none">{settings.headTeacherName}</p>
          <div className="w-40 border-b border-gray-900 mb-1"></div>
          <span className="text-[7px] font-black text-gray-400 uppercase leading-none">Academy Director</span>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black text-red-600 uppercase mb-1 leading-none">{settings.nextTermBegin}</p>
          <div className="w-40 border-b border-gray-900 mb-1"></div>
          <span className="text-[7px] font-black text-gray-400 uppercase leading-none">Next Resumption</span>
        </div>
      </div>
    </div>
  </div>
);
};

const MinimalReport: React.FC<any> = ({ student, settings, totalEnrolled }) => (
  <div className="bg-white w-[210mm] h-[297mm] shadow-2xl print:shadow-none print:border-none flex flex-col p-16 box-border font-sans overflow-hidden border-4 border-gray-100 flex-shrink-0">
    {/* HEADER AREA - 18% */}
    <div className="h-[18%] flex flex-col justify-center shrink-0 border-b border-gray-100 mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{settings.schoolName}</h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">{settings.examTitle}</p>
          <div className="mt-4 space-y-0.5">
            <p className="text-[8px] font-black text-gray-400 uppercase leading-none">TEL: {settings.schoolContact}</p>
            <p className="text-[8px] font-black text-gray-400 uppercase leading-none">MAIL: {settings.schoolEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-900 uppercase leading-none">{settings.academicYear}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mt-1">{settings.termInfo}</p>
          <p className="text-[8px] font-black text-gray-300 uppercase leading-none mt-1">NODE-0{student.id % 9}</p>
        </div>
      </div>
    </div>

    {/* GRID BOXES AREA - 40% */}
    <div className="h-[40%] flex flex-col shrink-0">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-2 leading-none">{student.name}</h2>
        <div className="flex gap-6 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
          <span>ID: {student.indexNumber || student.id}</span>
          <span>Rank: {student.rank} / {totalEnrolled}</span>
          <span>Aggregate: {student.bestSixAggregate}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 gap-0">
          {student.subjects.map((sub: any) => (
            <div key={sub.subject} className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-xs font-bold text-gray-800 uppercase leading-none">{sub.subject}</span>
              <div className="flex gap-8 items-center">
                <span className="text-xs font-mono text-gray-400 leading-none">{Math.round(sub.finalCompositeScore)}</span>
                <span className={`text-sm font-black w-8 text-right leading-none ${sub.gradeValue >= 7 ? 'text-red-500' : 'text-gray-900'}`}>{sub.grade}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* OTHERS & SPACING AREA - 40% */}
    <div className="h-[40%] flex flex-col shrink-0 pt-8">
      <div className="border-l-4 border-gray-900 pl-6 py-2 mb-4">
        <p className="text-xs font-bold text-gray-600 uppercase leading-none italic">
          "{student.overallRemark || "The candidate demonstrates a stable academic profile."}"
        </p>
      </div>
      
      <div className="mt-auto flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-gray-900 uppercase border-b-2 border-gray-900 pb-1 leading-none">{settings.headTeacherName}</span>
          <span className="text-[8px] font-black text-gray-300 uppercase leading-none mt-1">Academy Director</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-red-600 border-b-2 border-red-600 pb-1 leading-none">{settings.nextTermBegin}</span>
          <span className="text-[8px] font-black text-gray-300 uppercase leading-none mt-1">Next Resumption</span>
        </div>
      </div>
    </div>
  </div>
);

const ReportCard: React.FC<ReportCardProps> = ({ student, stats, settings, onSettingChange, onStudentUpdate, classAverageAggregate, totalEnrolled, isFacilitator, loggedInUser, readOnly = false }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const screenW = window.innerWidth;
      const docW = 794; 
      if (screenW < docW) setScale((screenW - 32) / docW);
      else setScale(1);
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    student.subjects.forEach(s => {
      dist[s.grade] = (dist[s.grade] || 0) + 1;
    });
    return dist;
  }, [student]);

  const handleDownloadTxt = () => {
    let content = `UNITED BAYLOR ACADEMY - ACADEMIC SHARD EXTRACTION\n`;
    content += `OFFICIAL RECORD FOR: ${student.name.toUpperCase()}\n`;
    content += `==========================================================\n\n`;
    content += `CANDIDATE PARTICULARS:\n`;
    content += `Name:           ${student.name}\n`;
    content += `ID/INDEX:       ${student.indexNumber || student.id}\n`;
    content += `Academic Yr:    ${settings.academicYear}\n`;
    content += `Series Focus:   ${settings.activeMock}\n`;
    content += `Language Opt:   ${student.ghanaianLanguage || 'NOT SPECIFIED'}\n`;
    content += `Best 6 Agg:     ${student.bestSixAggregate}\n`;
    content += `Class Rank:     ${student.rank} OF ${totalEnrolled}\n`;
    content += `Status:         ${student.category.toUpperCase()}\n\n`;
    
    content += `SUBJECT PERFORMANCE MATRIX:\n`;
    content += `----------------------------------------------------------\n`;
    content += `SUBJECT                | OBJ | THY | TOTAL | GRADE | REMARK\n`;
    content += `-----------------------|-----|-----|-------|-------|----------\n`;
    student.subjects.forEach(s => {
      content += `${s.subject.padEnd(22)} | ${String(s.sectionA || 0).padEnd(3)} | ${String(s.sectionB || 0).padEnd(3)} | ${Math.round(s.finalCompositeScore).toString().padEnd(5)} | ${s.grade.padEnd(5)} | ${s.remark}\n`;
    });
    content += `\n\nINSTRUCTIONAL FEEDBACK:\n${student.overallRemark || 'Candidate demonstrates stable proficiency.'}\n\n`;
    content += `==========================================================\n`;
    content += `AUDIT END | HQ MASTER SIGNATURE: ${new Date().toISOString()}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${student.name.replace(/\s+/g, '_')}.txt`;
    link.click();
  };

  const handlePrint = (e: React.MouseEvent) => {
    const container = (e.currentTarget as HTMLElement).closest('.report-card-container');
    if (container) {
      const oldTitle = document.title;
      document.title = ""; // Hide browser header title
      container.classList.add('is-printing');
      window.print();
      container.classList.remove('is-printing');
      document.title = oldTitle;
    }
  };

  const renderTemplate = () => {
    const commonProps = { student, stats, settings, onSettingChange, totalEnrolled, readOnly, gradeDistribution, classAverageAggregate };
    // If it's for PDF, we might want to ensure certain styles are fixed
    switch (settings.reportTemplate) {
      case 'minimal':
        return <MinimalReport {...commonProps} />;
      case 'prestige':
        return <PrestigeReport {...commonProps} />;
      case 'standard':
      default:
        return <StandardReport {...commonProps} />;
    }
  };

  return (
    <div className="flex flex-col items-center mb-16 relative w-full px-2 font-sans report-card-container">
       
       <div className="fixed bottom-24 right-6 flex flex-col gap-3 no-print z-[100]">
          <button title="Download NotePad (.txt)" onClick={handleDownloadTxt} className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-slate-800 text-white active:scale-90 transition-all border-2 border-white/20">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button title="Print Report" onClick={handlePrint} className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-blue-900 text-white active:scale-90 transition-all border-2 border-white/20">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
       </div>

       <div className="overflow-x-auto w-full flex justify-center py-2 bg-gray-200 rounded-[2rem] shadow-inner no-scrollbar print-section" style={{ minHeight: `calc(297mm * ${scale})` }}>
         <div id={`capture-area-${student.id}`} className="print-content" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            {renderTemplate()}
         </div>
       </div>
    </div>
  );
};

export default ReportCard;