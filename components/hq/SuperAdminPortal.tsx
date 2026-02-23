import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SchoolRegistryEntry, GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';

// HQ Domain Modular Handshakes
import RegistryView from './RegistryView';
import AuditLogView from './AuditLogView';
import NetworkAnnualAuditReport from './NetworkAnnualAuditReport';
import QuestionSerializationPortal from './QuestionSerializationPortal';
import QuestionRegistryView from './QuestionRegistryView';
import StaffFinancialsView from './StaffFinancialsView';
import UnifiedAuditMasterView from './UnifiedAuditMasterView';
import DisbursementHubView from './DisbursementHubView';
import RecruitmentHubView from './RecruitmentHubView';
import PupilNetworkRankingView from './PupilNetworkRankingView';
import NetworkRewardsView from './NetworkRewardsView';
import NetworkSigDiffView from './NetworkSigDiffView';
import SerializationHubView from './SerializationHubView';
import NetworkDashboard from './NetworkDashboard';

export interface SystemAuditEntry {
  id?: string;
  timestamp: string;
  action: string;
  target: string;
  actor: string;
  details: string;
  year: string;
}

type HQViewID = 
  | 'dashboard' | 'registry' | 'recruitment' | 'disbursement' | 'serialization' | 'questions-hub' | 'q-registry' | 'staff-fin' 
  | 'pupils' | 'rewards' | 'sig-diff' | 'network-audit' | 'audit' | 'unified-audit';

const SuperAdminPortal: React.FC<{ onExit: () => void; onRemoteView: (schoolId: string) => void; }> = ({ onExit, onRemoteView }) => {
  const [registry, setRegistry] = useState<SchoolRegistryEntry[]>([]);
  const [auditTrail, setAuditTrail] = useState<SystemAuditEntry[]>([]);
  const [view, setView] = useState<HQViewID>(
    (sessionStorage.getItem('uba_hq_active_view') as HQViewID) || 'dashboard'
  );
  const [isSyncing, setIsSyncing] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const sliderRailRef = useRef<HTMLDivElement>(null);

  const [hqSettings, setHqSettings] = useState<GlobalSettings>({
    schoolName: "UNITED BAYLOR ACADEMY",
    schoolMotto: "EXCELLENCE IN KNOWLEDGE AND CHARACTER",
    schoolAddress: "ACCRA DIGITAL CENTRE, GHANA",
    schoolContact: "+233 24 350 4091",
    schoolEmail: "hq@unitedbaylor.edu.gh",
    schoolWebsite: "WWW.UNITEDBAYLOR.EDU",
    schoolNumber: "HQ-MASTER-NODE",
    examTitle: "NETWORK COMMAND AUDIT",
    academicYear: "2024/2025",
  } as any);

  const fetchHQData = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch Registry Entries
      const { data: persistenceData } = await supabase.from('uba_persistence').select('id, payload').like('id', 'registry_%');
      if (persistenceData) {
        const compiled: SchoolRegistryEntry[] = [];
        persistenceData.forEach(row => {
          const entry = row.payload as SchoolRegistryEntry;
          if (entry && entry.id) compiled.push(entry);
        });
        setRegistry(compiled);
      }

      // 2. Fetch Activity Logs from dedicated table
      const { data: logData } = await supabase
        .from('uba_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logData) {
        const compiledAudit: SystemAuditEntry[] = logData.map(l => ({
          id: l.id,
          timestamp: l.created_at,
          action: l.action,
          target: l.hub_id,
          actor: l.actor_email || 'SYSTEM',
          details: l.details || '',
          year: new Date(l.created_at).getFullYear().toString()
        }));
        setAuditTrail(compiledAudit);
      }
    } catch (e) {
      console.error("Master Hub Handshake Failure:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    sessionStorage.setItem('uba_hq_active_view', view);
  }, [view]);

  const handleLogAction = async (action: string, target: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const actorEmail = user?.email || 'hq@unitedbaylor.edu.gh';
      
      const logEntry = {
        hub_id: target,
        actor_email: actorEmail,
        action: action,
        details: details,
        created_at: new Date().toISOString()
      };

      await supabase.from('uba_activity_logs').insert(logEntry);
      
      // Optimistic update for UI
      const uiEntry: SystemAuditEntry = {
        timestamp: logEntry.created_at,
        action: logEntry.action,
        target: logEntry.hub_id,
        actor: logEntry.actor_email,
        details: logEntry.details,
        year: new Date().getFullYear().toString()
      };
      setAuditTrail(prev => [uiEntry, ...prev].slice(0, 200));
    } catch (e) {
      console.error("Audit Log Insertion Failure:", e);
    }
  };

  useEffect(() => { fetchHQData(); }, []);

  useEffect(() => {
    handleNavScroll();
  }, [view, sidebarWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(260, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    }
    if (isDraggingSlider && sliderRailRef.current && navScrollRef.current) {
      const rail = sliderRailRef.current.getBoundingClientRect();
      const scrollableHeight = navScrollRef.current.scrollHeight - navScrollRef.current.clientHeight;
      
      if (scrollableHeight > 0) {
        // Calculate percentage based on mouse position relative to rail height
        // We subtract half the thumb height (50px) to center the drag if possible, 
        // but for a "jump" rail, mapping direct is often better.
        // Let's stick to direct mapping but ensure it covers the full 0-1 range.
        const mouseY = e.clientY - rail.top;
        const percent = Math.max(0, Math.min(1, mouseY / rail.height));
        
        navScrollRef.current.scrollTop = percent * scrollableHeight;
      }
    }
  }, [isResizing, isDraggingSlider]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setIsDraggingSlider(false);
  }, []);

  useEffect(() => {
    if (isResizing || isDraggingSlider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isDraggingSlider, handleMouseMove, handleMouseUp]);

  const handleNavScroll = () => {
    if (navScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = navScrollRef.current;
      const range = scrollHeight - clientHeight;
      setScrollPercent(range > 0 ? scrollTop / range : 0);
    }
  };

  const sidebarConfig = [
    {
      category: 'Overview',
      items: [
        { id: 'dashboard', label: 'Network Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { id: 'registry', label: 'Network Ledger', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
      ]
    },
    {
      category: 'Treasury & Assets',
      items: [
        { id: 'disbursement', label: 'Disburse Shards', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
        { id: 'staff-fin', label: 'Verified Balances', icon: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 8v4l3 3' },
        { id: 'q-registry', label: 'Instructional Assets', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }
      ]
    },
    {
      category: 'Infrastructure',
      items: [
        { id: 'recruitment', label: 'Enlist Specialists', icon: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
        { id: 'serialization', label: 'Serialization Hub', icon: 'M9 11l3 3L22 4' },
        { id: 'questions-hub', label: 'Master Bank Hub', icon: 'M12 2v20m10-10H2' }
      ]
    },
    {
      category: 'Matrix Analytics',
      items: [
        { id: 'pupils', label: 'Talent Matrix', icon: 'M12 2l3.09 6.26L22 9.27' },
        { id: 'rewards', label: 'Global Rewards', icon: 'M12 15l-2 5L9 9l11 4-5 2zm0 0l1 1' },
        { id: 'sig-diff', label: 'Network Sig-Diff', icon: 'M23 6l-9.5 9.5-5-5L1 18' }
      ]
    },
    {
      category: 'Network Reports',
      items: [
        { id: 'network-audit', label: 'Consolidated Audit', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
        { id: 'audit', label: 'System Action Trail', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }
      ]
    }
  ];

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 font-sans flex overflow-hidden relative ${isDraggingSlider ? 'cursor-grabbing select-none' : ''}`}>
      
      {/* HOVER TRIGGER ZONE */}
      <div 
        onMouseEnter={() => setIsSidebarVisible(true)}
        className={`fixed left-0 top-0 bottom-0 w-4 z-[60] cursor-e-resize ${(isSidebarVisible || isPinned) ? 'pointer-events-none' : ''}`}
      />

      {/* SIDEBAR */}
      <aside 
        onMouseLeave={() => !isResizing && !isDraggingSlider && !isPinned && setIsSidebarVisible(false)}
        style={{ width: (isSidebarVisible || isPinned) ? sidebarWidth : 0 }}
        className={`bg-slate-950 text-white flex flex-col shadow-[20px_0_60px_rgba(0,0,0,0.5)] z-50 relative overflow-hidden ${(isSidebarVisible || isPinned) ? 'opacity-100' : 'opacity-0'} ${isResizing ? '' : 'transition-all duration-500 ease-in-out'}`}
      >
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-slate-900 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl shadow-blue-500/20">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <div className="animate-in fade-in slide-in-from-left-4 duration-700">
                 <h2 className="text-lg font-black uppercase tracking-tighter leading-none">Network HQ</h2>
                 <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mt-1">Master Command</p>
              </div>
           </div>
           <button 
             onClick={() => setIsPinned(!isPinned)}
             className={`p-2 rounded-xl transition-all ${isPinned ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}
             title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
           >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v8m0 0l-4-4m4 4l4-4M5 12h14M12 22v-8m0 0l-4 4m4-4l4 4"/></svg>
           </button>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
           <nav 
             ref={navScrollRef}
             onScroll={handleNavScroll}
             className={`flex-1 overflow-y-auto p-8 pr-16 space-y-10 no-scrollbar ${isDraggingSlider ? 'scroll-auto' : 'scroll-smooth'} relative z-10`}
           >
              {sidebarConfig.map(cat => (
                <div key={cat.category} className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4 mb-2">{cat.category}</h4>
                   <div className="space-y-2">
                      {cat.items.map(item => (
                        <button 
                          key={item.id} 
                          onClick={() => setView(item.id as HQViewID)}
                          className={`w-full flex items-center gap-5 px-6 py-4 rounded-[1.5rem] transition-all group relative overflow-hidden ${view === item.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/20 scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                           {view === item.id && (
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-white animate-pulse" />
                           )}
                           <svg className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${view === item.id ? 'text-white' : 'text-slate-600 group-hover:text-blue-400'}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={item.icon}/></svg>
                           <span className="text-[11px] font-black uppercase tracking-[0.15em] truncate">{item.label}</span>
                        </button>
                      ))}
                   </div>
                </div>
              ))}
           </nav>

           {/* SIMPLIFIED VERTICAL SLIDER RAIL (Width 2) */}
           <div 
             ref={sliderRailRef}
             onMouseDown={(e) => {
               e.preventDefault();
               e.stopPropagation();
               setIsDraggingSlider(true);
               if (sliderRailRef.current && navScrollRef.current) {
                 const rail = sliderRailRef.current.getBoundingClientRect();
                 const mouseY = e.clientY - rail.top;
                 const percent = Math.max(0, Math.min(1, mouseY / rail.height));
                 const scrollableHeight = navScrollRef.current.scrollHeight - navScrollRef.current.clientHeight;
                 if (scrollableHeight > 0) {
                   navScrollRef.current.scrollTop = percent * scrollableHeight;
                 }
               }
             }}
             className="absolute right-4 top-8 bottom-8 w-[2px] bg-white/10 cursor-pointer z-[100] group"
           >
              <div 
                style={{ 
                  top: `${scrollPercent * 100}%`,
                  height: '60px',
                  transform: `translateY(-${scrollPercent * 100}%)`
                }}
                className="absolute left-[-1px] right-[-1px] bg-blue-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,1)] transition-colors group-hover:bg-blue-400"
              />
           </div>
        </div>

        <div className="p-8 border-t border-white/5 space-y-8 shrink-0 bg-slate-950">
           <div className="space-y-4 bg-white/5 p-5 rounded-3xl border border-white/5">
              <div className="flex justify-between items-center px-1">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Panel Width Adjuster</span>
                 <span className="text-[8px] font-black text-blue-400 font-mono">{sidebarWidth}PX</span>
              </div>
              <input 
                type="range" 
                min="260" 
                max="600" 
                value={sidebarWidth} 
                onChange={(e) => setSidebarWidth(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
           </div>
           <button onClick={onExit} className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all border border-red-900/20 shadow-lg active:scale-95">
              EXIT MASTER COMMAND
           </button>
        </div>

        {/* RESIZE HANDLE */}
        <div 
          onMouseDown={() => setIsResizing(true)}
          className={`absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-blue-500/50 transition-all z-50 flex items-center justify-center group ${isResizing ? 'bg-blue-600' : ''}`}
        >
           <div className="w-0.5 h-12 bg-white/20 rounded-full group-hover:bg-white/60 transition-colors" />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
         <header className="bg-white border-b border-slate-200 p-6 shadow-sm z-40">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-4">
                  <div className="space-y-1">
                     <h1 className="text-xl font-black uppercase text-slate-900 tracking-tighter">
                        {sidebarConfig.flatMap(c => c.items).find(i => i.id === view)?.label || 'Command Hub'}
                     </h1>
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">HQ Persistence Shard: Active</span>
                     </div>
                  </div>
               </div>
               
               <div className="flex items-center gap-4">
                  <div className="bg-slate-50 border border-slate-200 px-6 py-2 rounded-2xl flex flex-col items-center">
                     <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Network Nodes</span>
                     <span className="text-lg font-black font-mono text-blue-600">{registry.length}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-6 py-2 rounded-2xl flex flex-col items-center">
                     <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Total Census</span>
                     <span className="text-lg font-black font-mono text-emerald-600">
                        {registry.reduce((sum, r) => sum + (r.studentCount || 0), 0)}
                     </span>
                  </div>
               </div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 no-scrollbar">
            <div className="max-w-7xl mx-auto">
               {view === 'dashboard' && <NetworkDashboard registry={registry} onExit={onExit} />}
               {view === 'registry' && <RegistryView registry={registry} searchTerm="" setSearchTerm={()=>{}} onRemoteView={onRemoteView} onUpdateRegistry={setRegistry} onLogAction={handleLogAction} />}
               {view === 'recruitment' && <RecruitmentHubView registry={registry} onLogAction={handleLogAction} />}
               {view === 'serialization' && <SerializationHubView registry={registry} onLogAction={handleLogAction} />}
               {view === 'disbursement' && <DisbursementHubView registry={registry} settings={hqSettings} onSettingChange={()=>{}} />}
               {view === 'questions-hub' && <QuestionSerializationPortal registry={registry} />}
               {view === 'q-registry' && <QuestionRegistryView />}
               {view === 'staff-fin' && <StaffFinancialsView registry={registry} settings={hqSettings} onSettingChange={()=>{}} />}
               {view === 'pupils' && <PupilNetworkRankingView registry={registry} onRemoteView={onRemoteView} />}
               {view === 'rewards' && <NetworkRewardsView registry={registry} />}
               {view === 'sig-diff' && <NetworkSigDiffView registry={registry} />}
               {view === 'network-audit' && <NetworkAnnualAuditReport registry={registry} />}
               {view === 'audit' && <AuditLogView auditTrail={auditTrail} />}
               {view === 'unified-audit' && <UnifiedAuditMasterView registry={registry} />}
            </div>
         </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-horizontal-scrollbar::-webkit-scrollbar {
          height: 10px;
        }
        .custom-horizontal-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 20px;
          margin: 0 40px;
        }
        .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
          background: #2563eb;
          border-radius: 20px;
          border: 2px solid rgba(15, 23, 42, 1);
        }
        .custom-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3b82f6;
        }

        .custom-vertical-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-vertical-scrollbar::-webkit-scrollbar-track {
          background: rgba(241, 245, 249, 1);
          border-radius: 20px;
        }
        .custom-vertical-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
          border: 2px solid rgba(241, 245, 249, 1);
        }
        .custom-vertical-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
};

export default SuperAdminPortal;
