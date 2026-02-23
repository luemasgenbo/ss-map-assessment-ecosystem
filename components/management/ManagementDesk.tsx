import React, { useState } from 'react';
import { StudentData, GlobalSettings, ProcessedStudent, StaffAssignment } from '../../types';

// Sub-portals (Directory Absolute)
import ScoreEntryPortal from './ScoreEntryPortal';
import AcademyIdentityPortal from './AcademyIdentityPortal';
import PupilSBAPortal from './PupilSBAPortal';
import FacilitatorPortal from './FacilitatorPortal';
import GradingConfigPortal from './GradingConfigPortal';
import SeriesHistoryPortal from './SeriesHistoryPortal';
import MockResourcesPortal from './MockResourcesPortal';
import FacilitatorDesk from './FacilitatorDesk';
import LikelyQuestionDesk from './LikelyQuestionDesk';
import SubjectQuestionsBank from './SubjectQuestionsBank';
import EnrolmentForwardingPortal from './EnrolmentForwardingPortal';
import LocalSyncPortal from './LocalSyncPortal';
import RewardPortal from './RewardPortal';
import SchoolCredentialView from './SchoolCredentialView';
import DataCleanupPortal from './DataCleanupPortal';
import CurriculumCoveragePortal from './CurriculumCoveragePortal';
import FacilitatorAccountHub from './FacilitatorAccountHub';
import SpecialMockExams from './SpecialMockExams';

// Shared UI Logic
import ManagementHeader from './ManagementHeader';
import ManagementTabs, { ManagementTabType } from './ManagementTabs';

interface ManagementDeskProps {
  students: StudentData[];
  setStudents: React.Dispatch<React.SetStateAction<StudentData[]>>;
  facilitators: Record<string, StaffAssignment>;
  setFacilitators: React.Dispatch<React.SetStateAction<Record<string, StaffAssignment>>>;
  subjects: string[];
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  onBulkUpdate: (updates: Partial<GlobalSettings>) => void;
  onSave: (overrides?: any) => void;
  processedSnapshot: ProcessedStudent[];
  onLoadDummyData: () => void;
  onClearData: () => void;
  isFacilitator?: boolean;
  activeFacilitator?: { name: string; subject?: string; email?: string } | null;
  loggedInUser?: { name: string; nodeId: string } | null;
}

const ManagementDesk: React.FC<ManagementDeskProps> = ({ 
  students, setStudents, facilitators, setFacilitators, subjects, settings, onSettingChange, onBulkUpdate, onSave, processedSnapshot, onLoadDummyData, onClearData,
  isFacilitator, activeFacilitator, loggedInUser
}) => {
  const [activeTab, setActiveTab] = React.useState<ManagementTabType>(() => {
    const stored = localStorage.getItem('uba_mgmt_active_tab');
    if (stored) return stored as ManagementTabType;
    return isFacilitator ? 'facilitatorDesk' : 'scoreEntry';
  });

  React.useEffect(() => {
    localStorage.setItem('uba_mgmt_active_tab', activeTab);
  }, [activeTab]);

  return (
    <div className="p-0 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
        <ManagementHeader 
            schoolName={settings.schoolName} 
            isHubActive={!!settings.schoolNumber} 
            onLoadDummyData={onLoadDummyData} 
            onClearData={onClearData}
            hasData={students.length > 0}
            isFacilitator={isFacilitator}
            loggedInUser={loggedInUser}
            settings={settings}
        />
        <ManagementTabs activeTab={activeTab} setActiveTab={setActiveTab} isFacilitator={isFacilitator} />
        
        <div className="p-6 md:p-10 min-h-[600px]">
          {activeTab === 'scoreEntry' && (
            <ScoreEntryPortal 
              students={students} setStudents={setStudents} settings={settings} 
              onSettingChange={onSettingChange} subjects={subjects} 
              processedSnapshot={processedSnapshot} onSave={onSave}
              activeFacilitator={activeFacilitator}
            />
          )}
          {activeTab === 'facilitatorDesk' && <FacilitatorDesk students={students} setStudents={setStudents} settings={settings} onSettingChange={onSettingChange} onSave={() => onSave()} />}
          {activeTab === 'curriculumScope' && <CurriculumCoveragePortal settings={settings} students={students} subjects={subjects} isFacilitator={isFacilitator} activeFacilitator={activeFacilitator} onSave={() => onSave()} />}
          {activeTab === 'facilitatorAccount' && activeFacilitator?.email && facilitators[activeFacilitator.email] && (
            <FacilitatorAccountHub activeFacilitator={facilitators[activeFacilitator.email]} settings={settings} onSettingChange={onSettingChange} />
          )}
          {activeTab === 'specialMocks' && <SpecialMockExams settings={settings} />}
          {activeTab === 'questionsBank' && <SubjectQuestionsBank activeFacilitator={activeFacilitator?.email ? facilitators[activeFacilitator.email] : null} subjects={subjects} settings={settings} />}
          {activeTab === 'likelyQuestions' && <LikelyQuestionDesk activeFacilitator={activeFacilitator?.email ? facilitators[activeFacilitator.email] : null} subjects={subjects} facilitators={facilitators} settings={settings} isAdmin={!isFacilitator} />}
          {activeTab === 'school' && <AcademyIdentityPortal settings={settings} onSettingChange={onSettingChange} onSave={() => onSave()} />}
          {activeTab === 'pupils' && <PupilSBAPortal students={students} setStudents={setStudents} settings={settings} subjects={subjects} onSave={onSave} />}
          {activeTab === 'facilitators' && <FacilitatorPortal subjects={subjects} facilitators={facilitators} setFacilitators={setFacilitators} settings={settings} onSave={onSave} />}
          {activeTab === 'grading' && <GradingConfigPortal settings={settings} onSettingChange={onSettingChange} />}
          {activeTab === 'history' && <SeriesHistoryPortal students={students} settings={settings} />}
          {activeTab === 'resources' && <MockResourcesPortal settings={settings} onSettingChange={onSettingChange} subjects={subjects} isFacilitator={isFacilitator} activeFacilitator={activeFacilitator} onSave={onSave} />}
          {activeTab === 'enrolmentForward' && (
            <EnrolmentForwardingPortal 
              settings={settings} 
              onSettingChange={onSettingChange}
              students={students} 
              setStudents={setStudents} 
              facilitators={facilitators} 
              isFacilitator={isFacilitator} 
              activeFacilitator={activeFacilitator as any} 
            />
          )}
          {activeTab === 'cleanup' && <DataCleanupPortal students={students} setStudents={setStudents} settings={settings} onSave={() => onSave()} subjects={subjects} isFacilitator={isFacilitator} activeFacilitator={activeFacilitator as any} />}
          {activeTab === 'localSync' && <LocalSyncPortal students={students} settings={settings} />}
          {activeTab === 'rewards' && <RewardPortal students={students} setStudents={setStudents} settings={settings} subjects={subjects} facilitators={facilitators} onSave={() => onSave()} onSettingChange={onSettingChange} isFacilitator={isFacilitator} />}
          {activeTab === 'credentials' && <SchoolCredentialView settings={settings} studentCount={students.length} />}
        </div>
      </div>
    </div>
  );
};

export default ManagementDesk;