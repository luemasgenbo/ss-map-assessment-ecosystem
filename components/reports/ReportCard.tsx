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

const PrestigeReport: React.FC<any> = ({ student, stats, settings, onSettingChange, totalEnrolled, readOnly, gradeDistribution }) => (
  <div className="bg-white w-[210mm] h-[297mm] shadow-2xl flex flex-col p-8 box-border font-sans overflow-hidden border border-gray-200 flex-shrink-0">
    <div className="shrink-0 mb-4">
      <ReportBrandingHeader 
        settings={settings} 
        onSettingChange={onSettingChange} 
        reportTitle={settings.examTitle}
        subtitle="OFFICIAL ACADEMIC ATTAINMENT RECORD"
        isLandscape={false}
        readOnly={readOnly}
      />
    </div>

    {/* PUPIL & LOGISTICS MATRIX - High Contrast & 6px Shards */}
    <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
      <div className="border-[1.5px] border-blue-900 rounded-2xl overflow-hidden bg-blue-300">
        <div className="bg-blue-950 text-white text-[6px] leading-[5px] font-black px-4 py-1.5 uppercase tracking-widest flex items-center justify-between">
          <span>Logistics Node</span>
          <span className="font-mono">NODE-0{student.id % 9}</span>
        </div>
        <div className="divide-y divide-blue-400">
          {[
            {l:'Series Cycle',k:'activeMock',v:settings.activeMock},
            {l:'Current Term',k:'termInfo',v:settings.termInfo},
            {l:'Academic Yr',k:'academicYear',v:settings.academicYear},
            {l:'Authority',k:'headTeacherName',v:settings.headTeacherName},
          ].map((item, i) => (
            <div key={i} className="flex h-3 items-center px-4 gap-2">
              <span className="text-[6px] leading-[5px] font-black text-blue-950 uppercase w-[50px] shrink-0 border-r border-blue-400">{item.l}</span>
              <div className="text-[6px] leading-[5px] font-black text-blue-900 uppercase truncate flex-1">
                <EditableField 
                  value={item.v} 
                  onChange={(val) => onSettingChange(item.k as keyof GlobalSettings, val.toUpperCase())}
                  className="text-[6px] leading-[5px]"
                  disabled={readOnly}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-[1.5px] border-blue-900 rounded-2xl overflow-hidden bg-indigo-300">
        <div className="bg-blue-950 text-white text-[6px] leading-[5px] font-black px-4 py-1.5 uppercase tracking-widest flex items-center justify-between">
          <span>Candidate Particulars</span>
          <span>VERIFIED</span>
        </div>
        <div className="divide-y divide-indigo-400">
          {[
            {l:'Full Name',v:student.name},
            {l:'Attendance',v:`${student.attendance} / ${settings.attendanceTotal}`},
            {l:'Mock Rank',v:`#${student.rank} OF ${totalEnrolled}`},
            {l:'Best 6 Agg',v:student.bestSixAggregate}
          ].map((item, i) => (
            <div key={i} className="flex h-3 items-center px-4 gap-2">
              <span className="text-[6px] leading-[5px] font-black text-indigo-950 uppercase w-[50px] shrink-0 border-r border-indigo-400">{item.l}</span>
              <span className="text-[6px] leading-[5px] font-black uppercase truncate text-blue-950">{item.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* RESULTS MATRIX - Header & Shards in 6px */}
    <div className="mb-4 shrink-0">
      <table className="w-full border-collapse border-[2px] border-blue-950 rounded-xl overflow-hidden">
        <thead className="bg-blue-950 text-white uppercase text-[6px] leading-[5px] font-black tracking-widest">
          <tr className="h-6">
            <th className="px-3 text-left">Academic Discipline</th>
            <th className="px-1 text-center w-[30px]">Obj</th>
            <th className="px-1 text-center w-[30px]">Thy</th>
            <th className="px-1 text-center w-[40px] bg-blue-900">Sum</th>
            <th className="px-1 text-center w-[30px]">SBA</th>
            <th className="px-1 text-center w-[40px] bg-red-900">Cmp</th>
            <th className="px-1 text-center w-[30px]">Grd</th>
            <th className="px-3 text-left">Remark Shard</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {student.subjects.map((sub: any) => (
            <tr key={sub.subject} className="even:bg-blue-100 font-bold h-3">
              <td className="px-3 text-blue-950 uppercase truncate max-w-[150px] text-[6px] leading-[5px] border-r border-gray-100">{sub.subject}</td>
              <td className="text-center font-mono text-gray-500 text-[6px] leading-[5px] border-r border-gray-100">{sub.sectionA ?? '0'}</td>
              <td className="text-center font-mono text-gray-500 text-[6px] leading-[5px] border-r border-gray-100">{sub.sectionB ?? '0'}</td>
              <td className="text-center font-black bg-blue-200 text-blue-900 text-[6px] leading-[5px] border-r border-blue-900/10">{(sub.sectionA || 0) + (sub.sectionB || 0)}</td>
              <td className="text-center font-mono text-gray-500 text-[6px] leading-[5px] border-r border-gray-100">{Math.round(sub.sbaScore)}</td>
              <td className="text-center font-black bg-red-200 text-red-900 text-[6px] leading-[5px] border-r border-red-900/10">{Math.round(sub.finalCompositeScore)}</td>
              <td className={`text-center font-black text-[6px] leading-[5px] border-r border-gray-100 ${sub.gradeValue >= 7 ? 'text-red-700' : 'text-blue-900'}`}>{sub.grade}</td>
              <td className="px-3 text-[6px] leading-[5px] uppercase text-slate-500 italic truncate max-w-[200px]">{sub.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* PERFORMANCE ANALYSIS HEATMAP - 6px Components */}
    <div className="mb-4 grid grid-cols-4 gap-3 shrink-0 h-[40px]">
      <div className="col-span-1 bg-blue-950 text-white rounded-2xl flex flex-col items-center justify-center border-2 border-blue-900 shadow-xl h-full">
        <span className="text-[6px] font-black uppercase tracking-widest opacity-60 leading-[5px]">Overall Efficiency</span>
        <span className="text-[14px] font-black font-mono leading-[5px] mt-1">{((student.subjects.filter((s: any)=>s.gradeValue <= 6).length / student.subjects.length)*100).toFixed(0)}%</span>
      </div>
      <div className="col-span-3 border-2 border-blue-900 rounded-2xl flex items-center justify-around bg-blue-200 h-full px-6">
        {['A1','B2','B3','C4','C5','C6','D7','E8','F9'].map(g => (
          <div key={g} className="flex flex-col items-center justify-center">
            <span className="text-[6px] font-black text-slate-500 leading-[5px] mb-1 uppercase tracking-tighter">{g}</span>
            <span className={`text-[10px] font-black leading-[5px] ${gradeDistribution[g] ? 'text-blue-900' : 'text-slate-400'}`}>
              {gradeDistribution[g] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* NRT ANALYTICAL APPENDICES - 6px Text */}
    <div className="grid grid-cols-1 gap-3 mb-3 shrink-0">
      <div className="bg-slate-900 text-white px-8 py-3 rounded-[2.5rem] relative h-[60px] overflow-hidden flex flex-col justify-center border-2 border-slate-800 shadow-inner">
        <div className="absolute top-0 right-0 px-4 py-1 bg-blue-600 text-white text-[6px] leading-[5px] font-black uppercase tracking-widest rounded-bl-2xl">Instructional Feedback Shard</div>
        <p className="text-[6px] leading-[5px] font-black text-blue-100 uppercase italic">
          {student.overallRemark || 'The candidate demonstrates a stable academic profile with consistent mastery in core disciplines.'}
        </p>
      </div>
      <div className="bg-indigo-200 border-2 border-indigo-300 px-8 py-3 rounded-[2.5rem] relative h-[60px] overflow-hidden flex flex-col justify-center shadow-inner border-b-4 border-b-blue-900/20">
        <div className="absolute top-0 right-0 px-4 py-1 bg-indigo-900 text-white text-[6px] leading-[5px] font-black uppercase tracking-widest rounded-bl-2xl">Administrative Recommendation</div>
        <p className="text-[6px] leading-[5px] font-bold text-indigo-950 uppercase">
          PROMOTION OF INTENSIVE REMEDIAL CLUSTERS IN IDENTIFIED WEAK STRANDS. COGNITIVE CALIBRATION REQUIRED.
        </p>
      </div>
    </div>

    {/* SIGNATURE NODES - 6px Text */}
    <div className="flex justify-between items-end mt-auto pb-4 border-t border-slate-100 pt-4 shrink-0">
      <div className="w-[30%] text-center border-t border-slate-950 pt-2">
        <p className="text-[6px] leading-[5px] font-black uppercase text-slate-400 tracking-widest mb-1">Academy Director</p>
        <div className="font-black text-blue-950 text-[6px] leading-[5px] uppercase truncate">
          <EditableField 
            value={settings.headTeacherName} 
            onChange={(v) => onSettingChange('headTeacherName', v.toUpperCase())}
            className="text-[6px] leading-[5px] font-black"
            disabled={readOnly}
          />
        </div>
      </div>
      <div className="w-[30%] text-center border-t border-slate-950 pt-2">
        <p className="text-[6px] leading-[5px] font-black uppercase text-slate-400 tracking-widest mb-1">Next Resumption</p>
        <div className="font-black text-red-700 text-[6px] leading-[5px] uppercase">
          <EditableField 
            value={settings.nextTermBegin} 
            onChange={(v) => onSettingChange('nextTermBegin', v)}
            className="text-[6px] leading-[5px] font-black"
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  </div>
);

const StandardReport: React.FC<any> = ({ student, settings, onSettingChange, totalEnrolled, readOnly, gradeDistribution }) => (
  <div className="bg-white w-[210mm] h-[297mm] shadow-2xl flex flex-col p-12 box-border font-sans overflow-hidden border border-gray-300 flex-shrink-0">
    <div className="shrink-0 mb-8">
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

    <div className="grid grid-cols-2 gap-8 mb-2 border-y-2 border-gray-100 py-2">
      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Student Name</span>
          <span className="text-[9px] font-black text-gray-900 uppercase leading-[5px]">{student.name}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Index Number</span>
          <span className="text-[9px] font-black text-gray-900 uppercase leading-[5px]">{student.indexNumber || student.id}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Logistics Node</span>
          <span className="text-[9px] font-black text-gray-900 uppercase leading-[5px]">NODE-0{student.id % 9}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Academic Year</span>
          <span className="text-[9px] font-black text-gray-900 uppercase leading-[5px]">{settings.academicYear}</span>
        </div>
      </div>
      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Series Cycle</span>
          <span className="text-[9px] font-black text-gray-900 uppercase leading-[5px]">{settings.activeMock}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Class Position</span>
          <span className="text-[9px] font-black text-blue-600 uppercase leading-[5px]">Rank {student.rank} of {totalEnrolled}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Attendance</span>
          <span className="text-[9px] font-black text-gray-900 uppercase leading-[5px]">{student.attendance} / {settings.attendanceTotal}</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-0.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase leading-[5px]">Best 6 Agg</span>
          <span className="text-[9px] font-black text-red-600 uppercase leading-[5px]">{student.bestSixAggregate}</span>
        </div>
      </div>
    </div>

    <div className="flex-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 text-[9px] font-black text-gray-500 uppercase border-b-2 border-gray-200">
            <th className="py-1 px-4 text-left leading-[5px]">Discipline</th>
            <th className="py-1 px-2 text-center leading-[5px]">Obj</th>
            <th className="py-1 px-2 text-center leading-[5px]">Thy</th>
            <th className="py-1 px-2 text-center leading-[5px]">SBA</th>
            <th className="py-1 px-2 text-center leading-[5px]">Cmp</th>
            <th className="py-1 px-2 text-center leading-[5px]">Grd</th>
            <th className="py-1 px-4 text-left leading-[5px]">Remark</th>
          </tr>
        </thead>
        <tbody>
          {student.subjects.map((sub: any) => (
            <tr key={sub.subject} className="text-[9px]">
              <td className="py-0 px-4 font-bold text-gray-800 uppercase leading-[5px]">{sub.subject}</td>
              <td className="py-0 px-2 text-center font-mono text-gray-400 leading-[5px]">{sub.sectionA ?? '0'}</td>
              <td className="py-0 px-2 text-center font-mono text-gray-400 leading-[5px]">{sub.sectionB ?? '0'}</td>
              <td className="py-0 px-2 text-center font-mono text-gray-400 leading-[5px]">{Math.round(sub.sbaScore)}</td>
              <td className="py-0 px-2 text-center font-black text-gray-900 leading-[5px]">{Math.round(sub.finalCompositeScore)}</td>
              <td className={`py-0 px-2 text-center font-black leading-[5px] ${sub.gradeValue >= 7 ? 'text-red-500' : 'text-blue-700'}`}>{sub.grade}</td>
              <td className="py-0 px-4 text-gray-500 italic uppercase leading-[5px]">{sub.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-gray-400 uppercase leading-[5px] mb-1">Overall Efficiency</span>
          <span className="text-lg font-black text-gray-900 leading-[5px]">{((student.subjects.filter((s: any)=>s.gradeValue <= 6).length / student.subjects.length)*100).toFixed(0)}%</span>
        </div>
        <div className="flex gap-4">
          {['A1','B2','B3','C4','C5','C6','D7','E8','F9'].map(g => (
            <div key={g} className="flex flex-col items-center">
              <span className="text-[7px] font-black text-gray-400 uppercase leading-[5px] mb-1">{g}</span>
              <span className={`text-[9px] font-black leading-[5px] ${gradeDistribution[g] ? 'text-blue-600' : 'text-gray-300'}`}>{gradeDistribution[g] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-6 grid grid-cols-1 gap-4">
      <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
        <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2 leading-[5px]">Instructional Feedback Shard</h4>
        <p className="text-[10px] font-bold text-gray-700 uppercase leading-[5px] italic">
          {student.overallRemark || "Candidate demonstrates stable proficiency with consistent mastery in core disciplines."}
        </p>
      </div>
      <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
        <h4 className="text-[9px] font-black text-indigo-400 uppercase mb-2 leading-[5px]">Administrative Recommendation</h4>
        <p className="text-[10px] font-bold text-indigo-900 uppercase leading-[5px]">
          PROMOTION OF INTENSIVE REMEDIAL CLUSTERS IN IDENTIFIED WEAK STRANDS. COGNITIVE CALIBRATION REQUIRED.
        </p>
      </div>
    </div>

    <div className="mt-auto pt-8 flex justify-between items-end border-t border-gray-100">
      <div className="text-center">
        <p className="text-[10px] font-black text-gray-900 uppercase mb-1 leading-[5px]">{settings.headTeacherName}</p>
        <div className="w-48 border-b-2 border-gray-900 mb-2"></div>
        <span className="text-[8px] font-black text-gray-400 uppercase leading-[5px]">Academy Director</span>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-black text-red-600 uppercase mb-1 leading-[5px]">{settings.nextTermBegin}</p>
        <div className="w-48 border-b-2 border-gray-900 mb-2"></div>
        <span className="text-[8px] font-black text-gray-400 uppercase leading-[5px]">Next Resumption</span>
      </div>
    </div>
  </div>
);

const MinimalReport: React.FC<any> = ({ student, settings, totalEnrolled }) => (
  <div className="bg-white w-[210mm] h-[297mm] shadow-2xl flex flex-col p-16 box-border font-sans overflow-hidden border-4 border-gray-100 flex-shrink-0">
    <div className="flex justify-between items-start mb-12">
      <div>
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-[5px]">{settings.schoolName}</h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-[5px] mt-1">{settings.examTitle}</p>
        <div className="mt-4 space-y-0">
          <p className="text-[8px] font-black text-gray-400 uppercase leading-[5px]">TEL: {settings.schoolContact}</p>
          <p className="text-[8px] font-black text-gray-400 uppercase leading-[5px]">MAIL: {settings.schoolEmail}</p>
          <p className="text-[8px] font-black text-gray-400 uppercase leading-[5px]">WEB: {settings.schoolWebsite}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-gray-900 uppercase leading-[5px]">{settings.academicYear}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase leading-[5px] mt-1">{settings.termInfo}</p>
        <p className="text-[8px] font-black text-gray-300 uppercase leading-[5px] mt-1">NODE-0{student.id % 9}</p>
      </div>
    </div>

    <div className="mb-12">
      <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-2 leading-[5px]">{student.name}</h2>
      <div className="flex gap-6 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-[5px]">
        <span>ID: {student.indexNumber || student.id}</span>
        <span>Rank: {student.rank} / {totalEnrolled}</span>
        <span>Aggregate: {student.bestSixAggregate}</span>
        <span>Cycle: {settings.activeMock}</span>
      </div>
    </div>

    <div className="flex-1">
      <div className="grid grid-cols-1 gap-0">
        {student.subjects.map((sub: any) => (
          <div key={sub.subject} className="flex justify-between items-center py-0 border-b border-gray-50">
            <span className="text-xs font-bold text-gray-800 uppercase leading-[5px]">{sub.subject}</span>
            <div className="flex gap-8 items-center">
              <span className="text-xs font-mono text-gray-400 leading-[5px]">{Math.round(sub.finalCompositeScore)}</span>
              <span className={`text-sm font-black w-8 text-right leading-[5px] ${sub.gradeValue >= 7 ? 'text-red-500' : 'text-gray-900'}`}>{sub.grade}</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-12 space-y-4">
      <div className="border-l-4 border-gray-900 pl-6 py-2">
        <p className="text-xs font-bold text-gray-600 uppercase leading-[5px] italic">
          "{student.overallRemark || "The candidate demonstrates a stable academic profile with consistent mastery in core disciplines."}"
        </p>
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase leading-[5px] pl-7">
        REC: PROMOTION OF INTENSIVE REMEDIAL CLUSTERS IN IDENTIFIED WEAK STRANDS.
      </p>
    </div>

    <div className="mt-auto pt-12 flex justify-between items-center">
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-gray-900 uppercase border-b-2 border-gray-900 pb-1 leading-[5px]">{settings.headTeacherName}</span>
        <span className="text-[8px] font-black text-gray-300 uppercase leading-[5px] mt-1">Academy Director</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[10px] font-black text-red-600 border-b-2 border-red-600 pb-1 leading-[5px]">{settings.nextTermBegin}</span>
        <span className="text-[8px] font-black text-gray-300 uppercase leading-[5px] mt-1">Next Resumption</span>
      </div>
    </div>
  </div>
);

const ReportCard: React.FC<ReportCardProps> = ({ student, stats, settings, onSettingChange, onStudentUpdate, classAverageAggregate, totalEnrolled, isFacilitator, loggedInUser, readOnly = false }) => {
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    const element = document.getElementById(`capture-area-${student.id}`);
    if (!element) return setIsGenerating(false);
    const opt = { 
      margin: 0, filename: `${student.name.replace(/\s+/g, '_')}_REPORT.pdf`, 
      image: { type: 'jpeg', quality: 1.0 }, 
      html2canvas: { scale: 3, useCORS: true, letterRendering: true, windowWidth: 794 }, 
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    try {
        // @ts-ignore
        await window.html2pdf().set(opt).from(element).save();
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const renderTemplate = () => {
    const commonProps = { student, stats, settings, onSettingChange, totalEnrolled, readOnly, gradeDistribution };
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
    <div className="flex flex-col items-center mb-16 relative w-full px-2 font-sans">
       
       <div className="fixed bottom-24 right-6 flex flex-col gap-3 no-print z-[100]">
          <button title="Download NotePad (.txt)" onClick={handleDownloadTxt} className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-slate-800 text-white active:scale-90 transition-all border-2 border-white/20">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button title="Download PDF" onClick={handleDownloadPDF} disabled={isGenerating} className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all ${isGenerating ? 'bg-gray-400' : 'bg-red-600 text-white'}`}>
             {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          </button>
       </div>

       <div className="overflow-x-auto w-full flex justify-center py-2 bg-gray-200 rounded-[2rem] shadow-inner no-scrollbar" style={{ minHeight: `calc(297mm * ${scale})` }}>
         <div id={`capture-area-${student.id}`} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            {renderTemplate()}
         </div>
       </div>
    </div>
  );
};

export default ReportCard;