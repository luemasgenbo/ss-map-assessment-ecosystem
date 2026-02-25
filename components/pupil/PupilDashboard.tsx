import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessedStudent, ClassStatistics, GlobalSettings, SchoolRegistryEntry } from '../../types';
import ReportCard from '../reports/ReportCard';
import PupilPerformanceSummary from './PupilPerformanceSummary';
import PupilGlobalMatrix from './PupilGlobalMatrix';
import PupilMeritView from './PupilMeritView';
import PupilBeceLedger from './PupilBeceLedger';
import PupilAcademicJourney from './PupilAcademicJourney';
import PupilPracticeHub from './PupilPracticeHub';
import PupilCurriculumInsight from './PupilCurriculumInsight';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface PupilDashboardProps {
  student: ProcessedStudent | null;
  stats: ClassStatistics | null;
  settings: GlobalSettings;
  classAverageAggregate: number;
  totalEnrolled: number;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  onRefresh: () => void;
  globalRegistry: SchoolRegistryEntry[];
  onLogout: () => void;
  loggedInUser?: { name: string; nodeId: string } | null;
}

const PupilDashboard: React.FC<PupilDashboardProps> = ({ 
  student, stats, settings, classAverageAggregate, totalEnrolled, onSettingChange, onRefresh, globalRegistry, onLogout 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'report' | 'merit' | 'bece' | 'journey' | 'detailed' | 'global' | 'practice' | 'curriculum'>(
    (sessionStorage.getItem('uba_pupil_active_subtab') as any) || 'report'
  );

  useEffect(() => {
    sessionStorage.setItem('uba_pupil_active_subtab', activeSubTab);
  }, [activeSubTab]);
  
  // Left Sidebar Logic
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  // Vertical Slide Logic
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const isDraggingSlider = useRef(false);
  const sliderRailRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'report', label: 'My Report Card' },
    { id: 'curriculum', label: 'Topic Mastery' },
    { id: 'practice', label: 'Practice Hub' },
    { id: 'merit', label: 'My Merit Status' },
    { id: 'bece', label: 'BECE Ledger' },
    { id: 'journey', label: 'Progress Trend' },
    { id: 'detailed', label: 'Detailed Breakdown' },
    { id: 'global', label: 'Global Matrix' }
  ];

  // Resizing Handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 180 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Slider Handlers
  const handleNavScroll = () => {
    if (!navScrollRef.current || isDraggingSlider.current) return;
    const { scrollTop, scrollHeight, clientHeight } = navScrollRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) { setScrollPercent(0); return; }
    setScrollPercent((scrollTop / maxScroll) * 100);
  };

  const handleSliderInteraction = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingSlider.current || !navScrollRef.current || !sliderRailRef.current) return;
    const railRect = sliderRailRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const relativeY = clientY - railRect.top;
    const percent = Math.min(100, Math.max(0, (relativeY / railRect.height) * 100));
    const { scrollHeight, clientHeight } = navScrollRef.current;
    navScrollRef.current.scrollTop = (percent / 100) * (scrollHeight - clientHeight);
    setScrollPercent(percent);
  }, []);

  useEffect(() => {
    const handleUp = () => { isDraggingSlider.current = false; document.body.style.userSelect = 'auto'; };
    window.addEventListener('mousemove', handleSliderInteraction);
    window.addEventListener('touchmove', handleSliderInteraction, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleSliderInteraction);
      window.removeEventListener('touchmove', handleSliderInteraction);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [handleSliderInteraction]);

  if (!student || !stats) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-center font-sans">
        <div className="w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin mb-10"></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">Establishing Secure Node Link...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex relative overflow-hidden">
      
      {/* HOVER TRIGGER ZONE (FAR LEFT) */}
      <div 
        className="fixed inset-y-0 left-0 w-2 z-[100] cursor-pointer"
        onMouseEnter={() => setIsSidebarVisible(true)}
      />

      {/* MAIN VIEWPORT */}
      <main className={`flex-1 flex flex-col min-h-screen bg-slate-50 overflow-y-auto transition-all duration-500 ${isSidebarVisible ? 'opacity-30 blur-sm scale-95 ml-[150px]' : ''}`}>
        <div className="no-print w-full bg-slate-950 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl border-b border-white/5 sticky top-0 z-50">
           <div className="flex items-center gap-6">
              <div className="relative">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute inset-0"></div>
                 <div className="w-2 h-2 bg-emerald-500 rounded-full relative shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
              </div>
              <div className="space-y-0.5">
                 <p className="text-[7px] font-black text-blue-500 uppercase tracking-raw leading-none">Matrix Authorization Verified</p>
                 <h2 className="text-base font-black uppercase text-white tracking-tighter leading-none">{student.name}</h2>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="bg-blue-600/5 border border-blue-500/10 px-6 py-2 rounded-xl">
                 <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Access Hub: Hover Far Left</span>
              </div>
              <button 
                 onClick={onLogout}
                 className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-600/20"
              >
                 Exit Dashboard
              </button>
           </div>
        </div>

        <div className="flex-1 p-0 space-y-12 bg-slate-50/60">
          <div className="no-print bg-white p-6 md:p-10 shadow-xl border-b border-gray-100 max-w-7xl mx-auto w-full">
             <ReportBrandingHeader 
               settings={settings} 
               onSettingChange={onSettingChange} 
               reportTitle={settings.examTitle}
               subtitle={`IDENTITY ANALYSIS SEQUENCE: ${student.name}`}
               isLandscape={true}
               readOnly={true} 
             />
          </div>

          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full animate-in slide-in-from-bottom-12 duration-1000">
             {activeSubTab === 'report' && <ReportCard student={student} stats={stats} settings={settings} onSettingChange={onSettingChange} classAverageAggregate={classAverageAggregate} totalEnrolled={totalEnrolled} readOnly={true} />}
             {activeSubTab === 'curriculum' && <PupilCurriculumInsight student={student} schoolId={settings.schoolNumber} settings={settings} />}
             {activeSubTab === 'practice' && <PupilPracticeHub schoolId={settings.schoolNumber} studentId={student.id} studentName={student.name} settings={settings} onSettingChange={onSettingChange} />}
             {activeSubTab === 'merit' && <PupilMeritView student={student} settings={settings} />}
             {activeSubTab === 'bece' && <PupilBeceLedger student={student} />}
             {activeSubTab === 'journey' && <PupilAcademicJourney student={student} mockSeriesNames={settings.committedMocks || []} />}
             {activeSubTab === 'detailed' && <PupilPerformanceSummary student={student} mockSeriesNames={settings.committedMocks || []} type="technical" />}
             {activeSubTab === 'global' && <PupilGlobalMatrix registry={globalRegistry} student={student} />}
          </div>

          <footer className="mt-20 pt-12 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] italic no-print gap-4 text-center pb-20 px-10">
             <span>Institutional Shard: {settings.schoolNumber}</span>
             <span className="text-slate-950 bg-white px-8 py-2.5 rounded-full border border-gray-100 shadow-xl tracking-[0.5em]">SS-MAP HUB v5.2</span>
          </footer>
        </div>
      </main>

      {/* LEFT SIDEBAR COMMAND HUB */}
      <aside 
        className={`fixed inset-y-0 left-0 z-[500] bg-slate-950 text-white shadow-2xl transition-transform duration-500 ease-out flex flex-col border-r border-white/5 ${isSidebarVisible ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: `${sidebarWidth}px` }}
        onMouseLeave={() => !isResizing && setIsSidebarVisible(false)}
      >
        {/* RESIZER HANDLE (RIGHT EDGE) */}
        <div 
          onMouseDown={startResizing}
          className="absolute inset-y-0 right-0 w-2 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[400] flex items-center justify-center group"
        >
          <div className="w-0.5 h-16 bg-white/10 group-hover:bg-white rounded-full transition-all"></div>
        </div>

        <div className="p-8 border-b border-white/5 space-y-2 bg-slate-900/40">
           <h3 className="text-lg font-black uppercase tracking-tighter leading-none">Command Hub</h3>
           <p className="text-[7px] font-black text-blue-500 uppercase tracking-[0.4em]">Node: {student.indexNumber || student.id}</p>
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* NAV CONTENT (LEFT) */}
           <div 
             ref={navScrollRef}
             onScroll={handleNavScroll}
             className="flex-1 p-4 bg-slate-950 overflow-y-auto no-scrollbar scroll-smooth"
           >
              <div className="space-y-2 pb-10">
                 {navItems.map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => { setActiveSubTab(item.id as any); setIsSidebarVisible(false); }}
                      className={`w-full flex items-center px-6 py-3 rounded-xl transition-all duration-300 relative h-[42px] shrink-0 border ${activeSubTab === item.id ? 'bg-blue-600/10 text-white border-blue-500/50 shadow-lg shadow-blue-500/10' : 'text-slate-500 border-transparent hover:bg-white/5 hover:text-white'}`}
                    >
                       <span className={`text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-300 ${activeSubTab === item.id ? 'translate-x-1' : ''}`}>
                         {item.label}
                       </span>
                    </button>
                 ))}
              </div>
           </div>

           {/* THE UP AND DOWN SLIDE BAR (RIGHT EDGE - PRIORITY INTERACTION) */}
           <div 
             ref={sliderRailRef}
             className="w-1.5 bg-white/5 relative cursor-pointer group/rail shrink-0 z-[600]"
             onMouseDown={(e) => { isDraggingSlider.current = true; handleSliderInteraction(e.nativeEvent); document.body.style.userSelect = 'none'; e.stopPropagation(); }}
             onTouchStart={(e) => { isDraggingSlider.current = true; handleSliderInteraction(e.nativeEvent); e.stopPropagation(); }}
           >
              <div 
                className="absolute left-0 w-full bg-blue-500/80 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all duration-75"
                style={{ height: '40px', top: `${scrollPercent}%`, transform: 'translateY(-50%)' }}
              />
           </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-900/60 mt-auto">
           <button onClick={onLogout} className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest border border-red-500/20 transition-all active:scale-95">Deactivate Node</button>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default PupilDashboard;
