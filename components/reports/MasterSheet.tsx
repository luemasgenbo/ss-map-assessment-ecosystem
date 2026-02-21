import React, { useState } from 'react';
import { ProcessedStudent, ClassStatistics, GlobalSettings, StaffAssignment } from '../../types';
import { SUBJECT_LIST } from '../../constants';
import CompositeSheet from './CompositeSheet';
import SupplementarySheet from './SupplementarySheet';
import InstitutionalAnalytics from './InstitutionalAnalytics';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface MasterSheetProps {
  students: ProcessedStudent[];
  stats: ClassStatistics;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  facilitators: Record<string, StaffAssignment>;
  isFacilitator?: boolean;
}

const MOCK_SERIES = Array.from({ length: 10 }, (_, i) => `MOCK ${i + 1}`);

const MasterSheet: React.FC<MasterSheetProps> = ({ students, stats, settings, onSettingChange, facilitators, isFacilitator }) => {
  const [sheetView, setSheetView] = useState<'composite' | 'sectionA' | 'sectionB' | 'analytics'>('composite');

  const getSubtitle = () => {
    if (sheetView === 'composite') return 'OFFICIAL MASTER BROAD SHEET';
    if (sheetView === 'sectionA') return 'Objectives (Sec A) PERFORMANCE MATRIX';
    if (sheetView === 'sectionB') return 'Theory (Sec B) PERFORMANCE MATRIX';
    return 'INSTITUTIONAL PERFORMANCE AUDIT & MOMENTUM';
  };

  const handleDownloadBroadsheetTxt = () => {
    let content = `UNITED BAYLOR ACADEMY - OFFICIAL MASTER BROAD SHEET RECORD\n`;
    content += `SERIES: ${settings.activeMock} | ACADEMIC YEAR: ${settings.academicYear}\n`;
    content += `INSTITUTION ID: ${settings.schoolNumber || "SMA-2025-4759"}\n`;
    content += `========================================================================================================================\n\n`;

    // Calculate column widths
    const nameWidth = 30;
    const subWidth = 8;
    const rankWidth = 5;
    const totalWidth = 8;
    const aggWidth = 5;

    // Header Row
    let header = `RANK | ${"CANDIDATE IDENTITY".padEnd(nameWidth)} | `;
    SUBJECT_LIST.forEach(sub => {
      header += `${sub.substring(0, 3).toUpperCase().padEnd(subWidth)} | `;
    });
    header += `SUM     | AGG \n`;
    
    let separator = `${"-".repeat(rankWidth)}-|-${"-".repeat(nameWidth)}-|-`;
    SUBJECT_LIST.forEach(() => {
      separator += `${"-".repeat(subWidth)}-|-`;
    });
    separator += `${"-".repeat(totalWidth)}-|--- \n`;

    content += header;
    content += separator;

    // Student Rows
    students.forEach(s => {
      let row = `${String(s.rank).padStart(rankWidth)} | ${s.name.toUpperCase().padEnd(nameWidth)} | `;
      SUBJECT_LIST.forEach(subName => {
        const subData = s.subjects.find(sub => sub.subject === subName);
        const score = Math.round(subData?.finalCompositeScore || 0);
        const grade = subData?.grade || "-";
        row += `${String(score).padStart(3)}/${grade.padEnd(subWidth - 4)} | `;
      });
      row += `${Math.round(s.totalScore).toString().padStart(totalWidth-1)} | ${String(s.bestSixAggregate).padStart(3)}\n`;
      content += row;
    });

    content += `\n` + separator;
    
    // Statistics Footer
    content += `\nCOHORT ANALYTICS:\n`;
    content += `------------------------------------------------------------------------------------------------------------------------\n`;
    let meanRow = `MEAN | ${"COHORT PERFORMANCE (μ)".padEnd(nameWidth)} | `;
    let sdRow = `S.D  | ${"STANDARD DEVIATION (σ)".padEnd(nameWidth)} | `;

    SUBJECT_LIST.forEach(sub => {
      const mean = Math.round(stats.subjectMeans[sub] || 0);
      const sd = (stats.subjectStdDevs[sub] || 0).toFixed(1);
      meanRow += `${String(mean).padEnd(subWidth)} | `;
      sdRow += `${String(sd).padEnd(subWidth)} | `;
    });
    
    content += meanRow + `\n`;
    content += sdRow + `\n`;

    content += `\n========================================================================================================================\n`;
    content += `AUDIT END | HQ MASTER SIGNATURE: ${new Date().toISOString()}\n`;
    content += `SYSTEM NODE ID: ${settings.schoolNumber}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BroadSheet_${settings.activeMock.replace(/\s+/g, '_')}_${settings.schoolName.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleShareTxt = async () => {
    const text = `Broad Sheet for ${settings.schoolName} (${settings.activeMock}) is ready. Identity Shard: ${settings.schoolNumber}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'UBA Broad Sheet Shard',
          text: text,
          url: window.location.href
        });
      } catch (e) {
        handleDownloadBroadsheetTxt();
      }
    } else {
      handleDownloadBroadsheetTxt();
    }
  };

  return (
    <div className="bg-white p-4 print:p-0 min-h-screen max-w-[420mm] mx-auto overflow-hidden print:overflow-visible print:max-w-none font-sans">
      
      <div className="no-print mb-8 space-y-4">
        <div className="flex flex-col xl:flex-row items-center justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl gap-6">
          <div className="flex items-center gap-6">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-r pr-6 border-gray-200">Sheet Controller</h3>
            <div className="flex flex-wrap gap-2">
               {[
                 { id: 'composite', label: 'Composite' },
                 { id: 'sectionA', label: 'Section A' },
                 { id: 'sectionB', label: 'Section B' },
                 { id: 'analytics', label: 'Analytics' }
               ].map((v) => (
                 <button 
                  key={v.id} 
                  onClick={() => setSheetView(v.id as any)} 
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${sheetView === v.id ? 'bg-blue-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                 >
                   {v.label}
                 </button>
               ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button onClick={handleDownloadBroadsheetTxt} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2 transition-all active:scale-95 border border-white/10">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
               Download Notepad (.txt)
            </button>
            <button onClick={() => window.print()} className="bg-blue-950 hover:bg-black text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2 transition-all active:scale-95">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
               Print Master Record
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-10 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 shadow-inner">
           {MOCK_SERIES.map(mock => (
             <button key={mock} onClick={() => onSettingChange('activeMock', mock)} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${settings.activeMock === mock ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-blue-900 hover:bg-blue-50'}`}>
               {mock.split(' ')[1]}
             </button>
           ))}
        </div>
      </div>

      <div id="broadsheet-export-container">
        {/* SINGLE BRANDING HEADER: Authorities all branding for the entire broadsheet */}
        <ReportBrandingHeader 
          settings={settings} 
          onSettingChange={onSettingChange} 
          reportTitle={settings.examTitle}
          subtitle={getSubtitle()}
          isLandscape={true}
          readOnly={false}
        />

        <div className="min-h-[400px] mt-6">
          {sheetView === 'composite' && <CompositeSheet students={students} stats={stats} settings={settings} facilitators={facilitators} isFacilitator={isFacilitator} onSettingChange={onSettingChange} />}
          {sheetView === 'sectionA' && <SupplementarySheet students={students} stats={stats} settings={settings} onSettingChange={onSettingChange} section="sectionA" />}
          {sheetView === 'sectionB' && <SupplementarySheet students={students} stats={stats} settings={settings} onSettingChange={onSettingChange} section="sectionB" />}
          {sheetView === 'analytics' && <InstitutionalAnalytics students={students} stats={stats} settings={settings} facilitators={facilitators} onSettingChange={onSettingChange} />}
        </div>
      </div>
    </div>
  );
};

export default MasterSheet;