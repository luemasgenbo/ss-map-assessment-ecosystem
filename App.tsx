
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { calculateClassStatistics, processStudentData } from './utils';
import { GlobalSettings, StudentData, StaffAssignment, ProcessedStudent, ExamSubScore, MasterQuestion, SchoolRegistryEntry } from './types';
import { supabase } from './supabaseClient';

// Sector 1: Auth & Onboarding
import LoginPortal from './components/auth/LoginPortal';
import SchoolRegistrationPortal from './components/auth/SchoolRegistrationPortal';

// Sector 2: Institutional Management
import ManagementDesk from './components/management/ManagementDesk';
import HomeDashboard from './components/management/HomeDashboard';

// Sector 3: Reporting & Documentation
import MasterSheet from './components/reports/MasterSheet';
import ReportCard from './components/reports/ReportCard';
import SeriesBroadSheet from './components/reports/SeriesBroadSheet';

// Sector 4: Network Command (HQ)
import SuperAdminPortal from './components/hq/SuperAdminPortal';

// Sector 5: Pupil Ecosystem
import PupilDashboard from './components/pupil/PupilDashboard';

import { SUBJECT_LIST, DEFAULT_THRESHOLDS, DEFAULT_NORMALIZATION, DEFAULT_CATEGORY_THRESHOLDS } from './constants';

const DEFAULT_SETTINGS: GlobalSettings = {
  schoolName: "UNITED BAYLOR ACADEMY",
  schoolMotto: "EXCELLENCE IN KNOWLEDGE AND CHARACTER",
  schoolWebsite: "WWW.UNITEDBAYLOR.EDU",
  schoolAddress: "ACCRA DIGITAL CENTRE, GHANA",
  schoolNumber: "UBA-NODE-2025", 
  schoolLogo: "", 
  examTitle: "OFFICIAL MOCK ASSESSMENT SERIES",
  termInfo: "TERM 2",
  academicYear: "2024/2025",
  nextTermBegin: "2025-05-12",
  attendanceTotal: "60",
  startDate: "10-02-2025",
  endDate: "15-02-2025",
  headTeacherName: "DIRECTOR NAME",
  reportDate: new Date().toLocaleDateString(),
  schoolContact: "+233 24 350 4091",
  schoolEmail: "INFO@UNITEDBAYLOR.EDU.GH",
  gradingThresholds: DEFAULT_THRESHOLDS,
  categoryThresholds: DEFAULT_CATEGORY_THRESHOLDS,
  normalizationConfig: DEFAULT_NORMALIZATION,
  sbaConfig: { enabled: true, isLocked: false, sbaWeight: 30, examWeight: 70 },
  isConductLocked: false,
  securityPin: "0000",
  scoreEntryMetadata: { mockSeries: "MOCK 1", entryDate: new Date().toISOString().split('T')[0] },
  committedMocks: ["MOCK 1"],
  activeMock: "MOCK 1",
  resourcePortal: {},
  maxSectionA: 40,
  maxSectionB: 60,
  sortOrder: 'aggregate-asc',
  useTDistribution: true,
  reportTemplate: 'standard',
  adminRoleTitle: "Academy Director",
  registryRoleTitle: "Examination Registry",
  accessCode: "UBA-MASTER-KEY",
  staffAccessCode: "STAFF-UBA-2025",
  pupilAccessCode: "PUPIL-UBA-2025",
  enrollmentDate: new Date().toLocaleDateString(),
  demoInitialized: false,
  demoWindowClosed: false
};

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [viewMode, setViewMode] = useState<'home' | 'master' | 'reports' | 'management' | 'series' | 'pupil_hub'>(
    (sessionStorage.getItem('uba_active_view') as any) || 'home'
  );
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  
  const [currentHubId, setCurrentHubId] = useState<string | null>(sessionStorage.getItem('uba_active_hub_id'));
  const [activeRole, setActiveRole] = useState<string | null>(sessionStorage.getItem('uba_active_role'));
  const [isSuperAdmin, setIsSuperAdmin] = useState(sessionStorage.getItem('uba_is_super_admin') === 'true');
  
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; nodeId: string; role: string; email?: string; subject?: string } | null>(null);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [students, setStudents] = useState<StudentData[]>([]); 
  const [facilitators, setFacilitators] = useState<Record<string, StaffAssignment>>({});

  const stateRef = useRef({ settings, students, facilitators });
  useEffect(() => {
    stateRef.current = { settings, students, facilitators };
  }, [settings, students, facilitators]);

  useEffect(() => {
    if (viewMode) sessionStorage.setItem('uba_active_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    sessionStorage.setItem('uba_is_super_admin', isSuperAdmin.toString());
  }, [isSuperAdmin]);

  const syncCloudShards = useCallback(async (hubId: string) => {
    if (!hubId) return null;
    setIsSyncing(true);
    try {
      const { data: persistenceData } = await supabase
        .from('uba_persistence')
        .select('id, payload')
        .eq('hub_id', hubId);
      
      let finalSettings = { ...DEFAULT_SETTINGS };
      let finalStudents: StudentData[] = [];
      let finalFacilitators: Record<string, StaffAssignment> = {};

      if (persistenceData && persistenceData.length > 0) {
        persistenceData.forEach(row => {
          if (row.id === `${hubId}_settings`) finalSettings = row.payload || DEFAULT_SETTINGS;
          if (row.id === `${hubId}_students`) finalStudents = row.payload || [];
          if (row.id === `${hubId}_facilitators`) finalFacilitators = row.payload || {};
        });
      }

      setSettings(finalSettings);
      setStudents(finalStudents);
      setFacilitators(finalFacilitators);
      setIsSyncing(false);
      return { settings: finalSettings, students: finalStudents, facilitators: finalFacilitators };
    } catch (e) { 
      setIsSyncing(false);
      console.error("[SHARD RECALL ERROR]", e); 
    }
    return null;
  }, []);

  useEffect(() => {
    const initializeSystem = async () => {
      const storedUserContext = sessionStorage.getItem('uba_user_context');
      const storedHubId = sessionStorage.getItem('uba_active_hub_id');
      
      if (storedUserContext && storedHubId) {
        try {
          const user = JSON.parse(storedUserContext);
          setLoggedInUser(user);
          if (user.role === 'super_admin') {
            setIsSuperAdmin(true);
          } else {
            await syncCloudShards(storedHubId);
            // If it's a pupil, force pupil_hub regardless of stored view
            if (user.role === 'pupil') {
              setViewMode('pupil_hub');
            } else {
              // For other roles, if the stored view is pupil_hub, reset to home
              const storedView = sessionStorage.getItem('uba_active_view');
              if (storedView === 'pupil_hub') setViewMode('home');
            }
          }
        } catch (e) {
          sessionStorage.clear();
        }
      }
      setIsInitializing(false);
    };
    initializeSystem();
  }, [syncCloudShards]);

  const handleSaveAll = async (overrides?: { settings?: GlobalSettings, students?: StudentData[], facilitators?: Record<string, StaffAssignment> }) => {
    const activeSettings = overrides?.settings || stateRef.current.settings;
    const activeStudents = overrides?.students || stateRef.current.students;
    const activeFacs = overrides?.facilitators || stateRef.current.facilitators;
    const hubId = activeSettings.schoolNumber || currentHubId;
    
    if (!hubId) return;

    try {
      const ts = new Date().toISOString();
      const updates = [
        { id: `${hubId}_settings`, hub_id: hubId, payload: activeSettings, last_updated: ts },
        { id: `${hubId}_students`, hub_id: hubId, payload: activeStudents, last_updated: ts },
        { id: `${hubId}_facilitators`, hub_id: hubId, payload: activeFacs, last_updated: ts }
      ];
      await supabase.from('uba_persistence').upsert(updates);

      // MIRROR TO HQ REGISTRY RECORD
      const registryEntry: SchoolRegistryEntry = {
        id: hubId,
        name: activeSettings.schoolName,
        registrant: activeSettings.registrantName || "ADMIN",
        registrantEmail: activeSettings.registrantEmail || activeSettings.schoolEmail,
        accessCode: activeSettings.accessCode,
        staffAccessCode: activeSettings.staffAccessCode,
        pupilAccessCode: activeSettings.pupilAccessCode,
        enrollmentDate: activeSettings.enrollmentDate,
        studentCount: activeStudents.length,
        avgAggregate: 36, // Calculated elsewhere or lazy-loaded
        performanceHistory: [],
        status: 'active',
        lastActivity: ts,
        fullData: {
          settings: activeSettings,
          students: activeStudents,
          facilitators: activeFacs,
          staff: Object.keys(activeFacs).length
        }
      };

      await supabase.from('uba_persistence').upsert({
        id: `registry_${hubId}`,
        hub_id: hubId,
        payload: registryEntry,
        last_updated: ts
      });

      // Identityboard Mirroring
      const allIdentities: any[] = [];
      (Object.values(activeFacs) as StaffAssignment[]).forEach(f => {
        if (f.email) {
          allIdentities.push({
            email: f.email.toLowerCase(),
            full_name: (f.name || 'UNKNOWN').toUpperCase(),
            node_id: f.enrolledId,
            hub_id: hubId,
            role: 'facilitator',
            unique_code: f.uniqueCode
          });
        }
      });
      activeStudents.forEach(s => {
        if (s.indexNumber && s.uniqueCode) {
           allIdentities.push({
              email: `${s.indexNumber.toLowerCase()}@uba.internal`,
              full_name: (s.name || 'UNKNOWN').toUpperCase(),
              node_id: s.indexNumber,
              hub_id: hubId,
              role: 'pupil',
              unique_code: s.uniqueCode
           });
        }
      });
      if (allIdentities.length > 0) {
         await supabase.from('uba_identities').upsert(allIdentities, { onConflict: 'node_id' });
      }

      // Pupil Registry Mirroring
      const pupilRecords = activeStudents.map(s => ({
        student_id: s.indexNumber || s.id.toString(),
        name: (s.name || 'UNKNOWN').toUpperCase(),
        gender: s.gender,
        hub_id: hubId,
        is_jhs_level: true,
        unique_code: s.uniqueCode,
        enrollment_status: 'ACTIVE'
      }));
      if (pupilRecords.length > 0) {
        await supabase.from('uba_pupils').upsert(pupilRecords, { onConflict: 'student_id' });
      }

    } catch (e) {
      console.error("[CRITICAL SHARD MIRROR FAILURE]", e);
    }
  };

  const handleLogout = async () => { 
    if (!settings.demoInitialized && !settings.demoWindowClosed && currentHubId) {
      const nextSettings = { ...settings, demoWindowClosed: true };
      await handleSaveAll({ settings: nextSettings });
    }
    sessionStorage.clear();
    window.location.reload(); 
  };

  const handleLoginTransition = async (hubId: string, user: any) => {
    sessionStorage.setItem('uba_active_hub_id', hubId);
    sessionStorage.setItem('uba_active_role', user.role);
    sessionStorage.setItem('uba_user_context', JSON.stringify(user));
    sessionStorage.setItem('uba_is_super_admin', (user.role === 'super_admin').toString());
    
    await syncCloudShards(hubId);
    setCurrentHubId(hubId);
    setActiveRole(user.role);
    setLoggedInUser(user);
    
    if (user.role === 'pupil') {
      setViewMode('pupil_hub');
      sessionStorage.setItem('uba_active_view', 'pupil_hub');
    } else {
      setViewMode('home');
      sessionStorage.setItem('uba_active_view', 'home');
    }
  };

  const memoizedMatrix = useMemo(() => {
    try {
      const s = calculateClassStatistics(students || [], settings);
      const staffNames: Record<string, string> = {};
      Object.keys(facilitators || {}).forEach(k => { 
          if (facilitators[k].name && facilitators[k].taughtSubject) 
              staffNames[facilitators[k].taughtSubject!] = facilitators[k].name; 
      });
      const processed = processStudentData(s, students || [], staffNames, settings);
      const avgAgg = (processed || []).reduce((sum, st) => sum + (st.bestSixAggregate || 0), 0) / (processed.length || 1);
      return { stats: s, processedStudents: processed, classAvgAggregate: avgAgg };
    } catch (e) {
      return { stats: null, processedStudents: [], classAvgAggregate: 36 };
    }
  }, [students, facilitators, settings]);

  const { stats, processedStudents, classAvgAggregate } = memoizedMatrix;

  const currentPupil = useMemo(() => {
    if (!loggedInUser || loggedInUser.role !== 'pupil') return null;
    return processedStudents.find(s => s.indexNumber === loggedInUser.nodeId) || null;
  }, [loggedInUser, processedStudents]);

  if (isInitializing || isSyncing) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-12">
      <div className="w-24 h-24 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-white uppercase tracking-[0.6em] animate-pulse">Establishing Academy Handshake</p>
    </div>
  );

  if (!currentHubId && !isSuperAdmin) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {isRegistering ? (
        <SchoolRegistrationPortal 
          settings={settings} 
          onBulkUpdate={(u) => setSettings(prev => ({...prev, ...u}))}
          onSave={() => { void handleSaveAll(); }}
          onComplete={(id) => handleLoginTransition(id, {role: 'school_admin', nodeId: id, name: settings.registrantName})}
          onResetStudents={() => setStudents([])}
          onSwitchToLogin={() => setIsRegistering(false)}
        />
      ) : (
        <LoginPortal 
          onLoginSuccess={handleLoginTransition} 
          onSuperAdminLogin={() => setIsSuperAdmin(true)} 
          onSwitchToRegister={() => setIsRegistering(true)} 
        />
      )}
    </div>
  );

  if (isSuperAdmin) return <SuperAdminPortal onExit={handleLogout} onRemoteView={(id)=>{ void syncCloudShards(id).then(() => { setCurrentHubId(id); setIsSuperAdmin(false); setActiveRole('school_admin'); setViewMode('home'); }); }} />;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {activeRole !== 'pupil' && (
        <div className="no-print bg-blue-900 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
          <div className="flex bg-blue-800 rounded p-1 gap-1 text-[10px] font-black uppercase overflow-x-auto no-scrollbar">
            <button onClick={()=>setViewMode('home')} className={`px-4 py-2 rounded transition-all ${viewMode==='home' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'}`}>Home</button>
            <button onClick={()=>setViewMode('master')} className={`px-4 py-2 rounded transition-all ${viewMode==='master' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'}`}>Sheets</button>
            <button onClick={()=>setViewMode('reports')} className={`px-4 py-2 rounded transition-all ${viewMode==='reports' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'}`}>Reports</button>
            <button onClick={()=>setViewMode('series')} className={`px-4 py-2 rounded transition-all ${viewMode==='series' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'}`}>Tracker</button>
            <button onClick={()=>setViewMode('management')} className={`px-4 py-2 rounded transition-all ${viewMode==='management' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'}`}>Mgmt Hub</button>
          </div>
          <button onClick={handleLogout} className="bg-red-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">Logout</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-8">
        {viewMode==='home' && <HomeDashboard students={processedStudents} settings={settings} setViewMode={setViewMode as any} />}
        {viewMode==='master' && stats && <MasterSheet students={processedStudents} stats={stats} settings={settings} onSettingChange={(k,v)=>{ const next={...settings,[k]:v}; setSettings(next); void handleSaveAll({settings:next}); }} facilitators={facilitators} isFacilitator={activeRole === 'facilitator'} />}
        {viewMode==='series' && <SeriesBroadSheet students={students} settings={settings} onSettingChange={(k,v)=>{ const next={...settings,[k]:v}; setSettings(next); void handleSaveAll({settings:next}); }} currentProcessed={processedStudents.map(ps=>({id:ps.id, bestSixAggregate:ps.bestSixAggregate, rank:ps.rank, totalScore:ps.totalScore, category:ps.category}))} />}
        {viewMode==='reports' && stats && (
          <div className="space-y-8">
            <div className="no-print flex flex-col md:flex-row gap-4">
              <input 
                type="text" 
                placeholder="Search Student..." 
                value={reportSearchTerm} 
                onChange={(e)=>setReportSearchTerm(e.target.value)} 
                className="flex-1 p-6 rounded-3xl border-2 border-gray-100 shadow-sm font-bold outline-none uppercase" 
              />
              <select 
                className="p-6 rounded-3xl border-2 border-gray-100 shadow-sm font-bold outline-none uppercase bg-white cursor-pointer"
                onChange={(e) => {
                  const student = processedStudents.find(s => s.id.toString() === e.target.value);
                  if (student) setReportSearchTerm(student.name);
                }}
              >
                <option value="">Quick Select Student</option>
                {processedStudents.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            
            {processedStudents
              .filter(s=>(s.name||"").toLowerCase().includes(reportSearchTerm.toLowerCase()))
              .map(s=>(
                <ReportCard 
                  key={s.id} 
                  student={s} 
                  stats={stats} 
                  settings={settings} 
                  onSettingChange={(k,v)=>{ const next={...settings,[k]:v}; setSettings(next); void handleSaveAll({settings:next}); }} 
                  classAverageAggregate={classAvgAggregate} 
                  totalEnrolled={processedStudents.length} 
                  isFacilitator={activeRole === 'facilitator'} 
                  loggedInUser={loggedInUser} 
                />
              ))
            }
            
            {processedStudents.filter(s=>(s.name||"").toLowerCase().includes(reportSearchTerm.toLowerCase())).length === 0 && (
              <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No matching student records found</p>
              </div>
            )}
          </div>
        )}
        {viewMode==='management' && (
          <ManagementDesk 
            students={students} 
            setStudents={setStudents} 
            facilitators={facilitators} 
            setFacilitators={setFacilitators} 
            subjects={SUBJECT_LIST} 
            settings={settings} 
            onSettingChange={(k,v)=>{ const next={...settings,[k]:v}; setSettings(next); void handleSaveAll({settings:next}); }} 
            onBulkUpdate={(u)=>{ const next={...settings,...u}; setSettings(next); void handleSaveAll({settings:next}); }} 
            onSave={(ov)=>{ void handleSaveAll(ov); }} 
            processedSnapshot={processedStudents} 
            onLoadDummyData={() => {}} 
            onClearData={()=>{}} 
            isFacilitator={activeRole === 'facilitator'} 
            loggedInUser={loggedInUser} 
            activeFacilitator={loggedInUser}
          />
        )}
        {/* FIXED: Allow dashboard to render even if data is null, it will handle the fallback UI */}
        {viewMode==='pupil_hub' && (
          <PupilDashboard 
            student={currentPupil as any}
            stats={stats as any}
            settings={settings}
            classAverageAggregate={classAvgAggregate}
            totalEnrolled={processedStudents.length}
            onSettingChange={(k,v)=>{ const next={...settings,[k]:v}; setSettings(next); void handleSaveAll({settings:next}); }}
            onRefresh={() => syncCloudShards(currentHubId!)}
            globalRegistry={[]} 
            onLogout={handleLogout}
            loggedInUser={loggedInUser}
          />
        )}
      </div>
    </div>
  );
};

export default App;
