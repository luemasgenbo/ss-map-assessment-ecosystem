import React, { useState, useMemo, useEffect } from 'react';
import { GlobalSettings, MockResource, QuestionIndicatorMapping, SchemeOfWeek } from '../../types';
import { SUBJECT_LIST } from '../../constants';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

interface MockResourcesPortalProps {
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  subjects?: string[];
  isFacilitator?: boolean;
  activeFacilitator?: { name: string; subject?: string; email?: string } | null;
  onSave?: (overrides?: any) => void;
}

const MockResourcesPortal: React.FC<MockResourcesPortalProps> = ({ 
  settings, 
  onSettingChange, 
  subjects = SUBJECT_LIST,
  isFacilitator,
  activeFacilitator,
  onSave
}) => {
  const filteredSubjects = useMemo(() => {
    if (isFacilitator && activeFacilitator?.subject) {
      return subjects.filter(s => s === activeFacilitator.subject);
    }
    return subjects;
  }, [subjects, isFacilitator, activeFacilitator]);

  const [selectedSubject, setSelectedSubject] = useState(activeFacilitator?.subject || filteredSubjects[0]);
  
  useEffect(() => {
    if (isFacilitator && activeFacilitator?.subject) {
      setSelectedSubject(activeFacilitator.subject);
    }
  }, [isFacilitator, activeFacilitator]);
  
  // Modal State for Curriculum Connector
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<QuestionIndicatorMapping> | null>(null);
  const [activePlanYear, setActivePlanYear] = useState<7 | 8 | 9>(7);
  const [activePlanTerm, setActivePlanTerm] = useState<1 | 2 | 3>(1);

  const activeResource: MockResource = useMemo(() => {
    return settings.resourcePortal?.[settings.activeMock]?.[selectedSubject] || { indicators: [], questionUrl: '', schemeUrl: '' };
  }, [settings.resourcePortal, settings.activeMock, selectedSubject]);

  const [indicatorPage, setIndicatorPage] = useState(1);
  const indicatorsPerPage = 40;

  const paginatedIndicators = useMemo(() => {
    const list = activeResource.indicators || [];
    const startIndex = (indicatorPage - 1) * indicatorsPerPage;
    return list.slice(startIndex, startIndex + indicatorsPerPage);
  }, [activeResource.indicators, indicatorPage]);

  const totalIndicatorPages = Math.ceil((activeResource.indicators?.length || 0) / indicatorsPerPage);

  useEffect(() => {
    setIndicatorPage(1);
  }, [selectedSubject]);

  const activeScheme = useMemo(() => {
    return activeResource.revisionPlan?.schemes.find(s => s.basicYear === activePlanYear && s.term === activePlanTerm) || { term: activePlanTerm, basicYear: activePlanYear, weeks: [] };
  }, [activeResource.revisionPlan, activePlanYear, activePlanTerm]);

  const updateSchemeWeek = (entryId: string, field: keyof SchemeOfWeek, value: any) => {
    const currentPlan = activeResource.revisionPlan || { schemes: [] };
    const nextSchemes = [...currentPlan.schemes];
    const schemeIdx = nextSchemes.findIndex(s => s.basicYear === activePlanYear && s.term === activePlanTerm);
    
    let targetScheme = schemeIdx >= 0 ? nextSchemes[schemeIdx] : { term: activePlanTerm, basicYear: activePlanYear, weeks: [] };
    const nextWeeks = [...targetScheme.weeks];
    const entryIdx = nextWeeks.findIndex(w => w.id === entryId);

    if (entryIdx >= 0) {
      nextWeeks[entryIdx] = { ...nextWeeks[entryIdx], [field]: value };
      targetScheme = { ...targetScheme, weeks: nextWeeks };
      if (schemeIdx >= 0) {
        nextSchemes[schemeIdx] = targetScheme;
      } else {
        nextSchemes.push(targetScheme);
      }
      updateResourceField('revisionPlan', { schemes: nextSchemes });
    }
  };

  const addSchemeEntry = (weekNum: number) => {
    const currentPlan = activeResource.revisionPlan || { schemes: [] };
    const nextSchemes = [...currentPlan.schemes];
    const schemeIdx = nextSchemes.findIndex(s => s.basicYear === activePlanYear && s.term === activePlanTerm);
    
    let targetScheme = schemeIdx >= 0 ? nextSchemes[schemeIdx] : { term: activePlanTerm, basicYear: activePlanYear, weeks: [] };
    const nextWeeks = [...targetScheme.weeks];
    
    nextWeeks.push({ 
      id: `W${weekNum}-${Date.now()}`,
      week: weekNum, 
      strand: '', 
      subStrand: '', 
      indicator: '', 
      indicatorCode: '', 
      additions: '' 
    });

    targetScheme = { ...targetScheme, weeks: nextWeeks };
    if (schemeIdx >= 0) {
      nextSchemes[schemeIdx] = targetScheme;
    } else {
      nextSchemes.push(targetScheme);
    }

    updateResourceField('revisionPlan', { schemes: nextSchemes });
  };

  const removeSchemeEntry = (entryId: string) => {
    const currentPlan = activeResource.revisionPlan || { schemes: [] };
    const nextSchemes = [...currentPlan.schemes];
    const schemeIdx = nextSchemes.findIndex(s => s.basicYear === activePlanYear && s.term === activePlanTerm);
    
    if (schemeIdx < 0) return;

    let targetScheme = nextSchemes[schemeIdx];
    const nextWeeks = targetScheme.weeks.filter(w => w.id !== entryId);

    targetScheme = { ...targetScheme, weeks: nextWeeks };
    nextSchemes[schemeIdx] = targetScheme;

    updateResourceField('revisionPlan', { schemes: nextSchemes });
  };

  const handleDownloadSchemeCSV = () => {
    const headers = ['Week', 'Strand', 'Sub-Strand', 'Indicator Code', 'Instructional Indicator', 'Additions'];
    const rows: string[] = [];
    
    // Sort weeks to ensure order in CSV
    const sortedWeeks = [...activeScheme.weeks].sort((a, b) => a.week - b.week);
    
    sortedWeeks.forEach(weekData => {
      rows.push([
        weekData.week,
        `"${(weekData.strand || '').replace(/"/g, '""')}"`,
        `"${(weekData.subStrand || '').replace(/"/g, '""')}"`,
        `"${(weekData.indicatorCode || '').replace(/"/g, '""')}"`,
        `"${(weekData.indicator || '').replace(/"/g, '""')}"`,
        `"${(weekData.additions || '').replace(/"/g, '""')}"`
      ].join(','));
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `scheme_${selectedSubject}_B${activePlanYear}_T${activePlanTerm}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadSchemeCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length <= 1) return;

      // Skip header
      const dataLines = lines.slice(1);
      
      const newWeeks: SchemeOfWeek[] = dataLines.map(line => {
        // Simple CSV parser (doesn't handle all edge cases but should work for this)
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const week = parseInt(parts[0]) || 0;
        const strand = parts[1]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        const subStrand = parts[2]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        const indicatorCode = parts[3]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        const indicator = parts[4]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        const additions = parts[5]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        
        return { id: `W${week}-${Date.now()}-${Math.random()}`, week, strand, subStrand, indicatorCode, indicator, additions };
      }).filter(w => w.week > 0 && w.week <= 16);

      if (newWeeks.length > 0) {
        const currentPlan = activeResource.revisionPlan || { schemes: [] };
        const nextSchemes = [...currentPlan.schemes];
        const schemeIdx = nextSchemes.findIndex(s => s.basicYear === activePlanYear && s.term === activePlanTerm);
        
        const targetScheme = { term: activePlanTerm, basicYear: activePlanYear, weeks: newWeeks };
        if (schemeIdx >= 0) {
          nextSchemes[schemeIdx] = targetScheme;
        } else {
          nextSchemes.push(targetScheme);
        }

        updateResourceField('revisionPlan', { schemes: nextSchemes });
        alert(`Successfully imported ${newWeeks.length} weeks for Basic ${activePlanYear} Term ${activePlanTerm}.`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getTargetTerms = (mockName: string) => {
    const match = mockName.match(/\d+/);
    if (!match) return [];
    const num = parseInt(match[0]);
    if (num === 10) return [1, 2, 3];
    if ([1, 4, 7].includes(num)) return [1];
    if ([2, 5, 8].includes(num)) return [2];
    if ([3, 6, 9].includes(num)) return [3];
    return [];
  };

  const targetTerms = getTargetTerms(settings.activeMock);

  const updateResourceField = (field: keyof MockResource, value: any) => {
    const currentPortal = settings.resourcePortal || {};
    const mockData = currentPortal[settings.activeMock] || {};
    const subjectData = mockData[selectedSubject] || { indicators: [], questionUrl: '', schemeUrl: '' };
    
    onSettingChange('resourcePortal', {
      ...currentPortal,
      [settings.activeMock]: {
        ...mockData,
        [selectedSubject]: { ...subjectData, [field]: value }
      }
    });
  };

  const handleSyncFromScheme = () => {
    if (!activeResource.revisionPlan) {
      alert("No revision plan detected. Please build the scheme of learning first.");
      return;
    }

    const mockNumMatch = settings.activeMock.match(/\d+/);
    const mockNum = mockNumMatch ? parseInt(mockNumMatch[0]) : 0;
    
    let newIndicators: QuestionIndicatorMapping[] = [];

    if (mockNum === 10) {
      // Mock 10: All Terms (34% T1, 36% T2, 30% T3)
      const t1Schemes = activeResource.revisionPlan.schemes.filter(s => s.term === 1);
      const t2Schemes = activeResource.revisionPlan.schemes.filter(s => s.term === 2);
      const t3Schemes = activeResource.revisionPlan.schemes.filter(s => s.term === 3);

      const t1Weeks = t1Schemes.flatMap(s => s.weeks.map(w => ({ ...w, basicYear: s.basicYear, term: s.term })));
      const t2Weeks = t2Schemes.flatMap(s => s.weeks.map(w => ({ ...w, basicYear: s.basicYear, term: s.term })));
      const t3Weeks = t3Schemes.flatMap(s => s.weeks.map(w => ({ ...w, basicYear: s.basicYear, term: s.term })));

      // For Mock 10, we sample based on percentages
      // Total target is roughly 45 items (40 obj + 5 theory)
      const targetTotal = 45;
      const t1Count = Math.round(targetTotal * 0.34);
      const t2Count = Math.round(targetTotal * 0.36);
      const t3Count = Math.max(0, targetTotal - t1Count - t2Count);

      const sample = (weeks: any[], count: number) => {
        const shuffled = [...weeks].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      };

      const selectedWeeks = [
        ...sample(t1Weeks, t1Count),
        ...sample(t2Weeks, t2Count),
        ...sample(t3Weeks, t3Count)
      ];

      selectedWeeks.forEach((week, idx) => {
        newIndicators.push({
          id: `SCH-M10-${week.basicYear}-${week.term}-${week.week}-${idx}-${Date.now()}`,
          section: idx < 40 ? 'A' : 'B',
          questionRef: (idx < 40 ? idx + 1 : idx - 39).toString(),
          strand: week.strand,
          subStrand: week.subStrand,
          indicatorCode: week.indicatorCode,
          indicator: week.indicator,
          weight: idx < 40 ? 1 : 10,
          sourceTerm: week.term as 1 | 2 | 3,
          sourceYear: week.basicYear as 7 | 8 | 9
        });
      });
    } else {
      const relevantSchemes = activeResource.revisionPlan.schemes.filter(s => targetTerms.includes(s.term));
      relevantSchemes.forEach(scheme => {
        scheme.weeks.forEach(week => {
          newIndicators.push({
            id: `SCH-${scheme.basicYear}-${scheme.term}-${week.id || week.week}-${Date.now()}`,
            section: 'A', 
            questionRef: week.week.toString(),
            strand: week.strand,
            subStrand: week.subStrand,
            indicatorCode: week.indicatorCode,
            indicator: week.indicator,
            weight: 1,
            sourceTerm: scheme.term,
            sourceYear: scheme.basicYear
          });
        });
      });
    }

    if (newIndicators.length > 0) {
      updateResourceField('indicators', [...activeResource.indicators, ...newIndicators]);
      alert(`Successfully synced ${newIndicators.length} indicators based on ${settings.activeMock} mapping rules.`);
    } else {
      alert("No matching weeks found in the scheme for the target terms.");
    }
  };

  const coverageStats = useMemo(() => {
    const indicators = activeResource.indicators || [];
    const totalIndicators = indicators.length;
    
    if (totalIndicators > 0) {
      const covered = indicators.filter(i => i.isCovered).length;
      const percentage = (covered / totalIndicators) * 100;
      return { total: totalIndicators, covered, percentage, mode: 'CONNECTOR' };
    }

    // Fallback: Count indicators in the Revision Plan schemes
    const planIndicators = activeResource.revisionPlan?.schemes.reduce((acc, s) => acc + s.weeks.length, 0) || 0;
    return { total: planIndicators, covered: 0, percentage: 0, mode: 'PLAN_ONLY' };
  }, [activeResource.indicators, activeResource.revisionPlan]);

  const handleOpenEditor = (item?: QuestionIndicatorMapping, section?: 'A' | 'B') => {
    if (item) {
      setEditingItem(item);
    } else {
      const existingInSec = activeResource.indicators.filter(i => i.section === section);
      const nextRef = existingInSec.length + 1;
      setEditingItem({
        id: `IND-${Date.now()}`,
        section: section || 'A',
        questionRef: nextRef.toString(),
        strand: 'GENERAL',
        subStrand: 'CORE',
        indicatorCode: '',
        indicator: '',
        weight: section === 'A' ? 1 : 10
      });
    }
    setIsEditorOpen(true);
  };

  const handleSaveIndicator = () => {
    if (!editingItem) return;
    const nextIndicators = [...activeResource.indicators];
    const index = nextIndicators.findIndex(i => i.id === editingItem.id);
    
    if (index >= 0) {
      nextIndicators[index] = editingItem as QuestionIndicatorMapping;
    } else {
      nextIndicators.push(editingItem as QuestionIndicatorMapping);
    }

    updateResourceField('indicators', nextIndicators);
    setIsEditorOpen(false);
    setEditingItem(null);
  };

  const handleAutoBuildObjectives = () => {
    const newIndicators: QuestionIndicatorMapping[] = Array.from({ length: 40 }, (_, i) => ({
      id: `IND-${Date.now()}-${i}`,
      section: 'A',
      questionRef: (i + 1).toString(),
      strand: 'GENERAL',
      subStrand: 'CORE',
      indicatorCode: `B9.1.1.1.${i + 1}`,
      indicator: `Assessment of instructional node ${i + 1}`,
      weight: 1
    }));
    updateResourceField('indicators', [...activeResource.indicators, ...newIndicators]);
  };

  const handleAutoBuildTheory = () => {
    const newIndicators: QuestionIndicatorMapping[] = Array.from({ length: 5 }, (_, i) => ({
      id: `IND-B-${Date.now()}-${i}`,
      section: 'B',
      questionRef: (i + 1).toString(),
      strand: 'TECHNICAL',
      subStrand: 'APPLICATION',
      indicatorCode: `B9.2.1.1.${i + 1}`,
      indicator: `Theoretical analysis of shard ${i + 1}`,
      weight: 10
    }));
    updateResourceField('indicators', [...activeResource.indicators, ...newIndicators]);
  };

  const handlePurge = () => {
    if (window.confirm("CRITICAL: Purge entire syllabus mapping framework for this subject?")) {
      updateResourceField('indicators', []);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24 font-sans">
      
      {/* CURRICULUM CONNECTOR POP-OUT EDITOR */}
      {isEditorOpen && editingItem && (
        <div className="fixed inset-0 z-[600] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-slate-950 p-10 text-white flex justify-between items-center">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tighter">Indicator Shard Editor</h3>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Curriculum Connector Node</p>
                 </div>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-xl ${editingItem.section === 'A' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                    {editingItem.section}
                 </div>
              </div>

              <div className="p-10 space-y-8">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Q# Reference Pointer</label>
                       <input 
                         type="text" 
                         value={editingItem.questionRef} 
                         onChange={e => setEditingItem({...editingItem, questionRef: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-500/10"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Indicator Weight</label>
                       <input 
                         type="number" 
                         value={editingItem.weight} 
                         onChange={e => setEditingItem({...editingItem, weight: parseInt(e.target.value) || 0})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-500/10"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Strand Name</label>
                       <input 
                         type="text" 
                         value={editingItem.strand} 
                         onChange={e => setEditingItem({...editingItem, strand: e.target.value.toUpperCase()})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-black text-blue-900 outline-none uppercase"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-Strand / Topic</label>
                       <input 
                         type="text" 
                         value={editingItem.subStrand} 
                         onChange={e => setEditingItem({...editingItem, subStrand: e.target.value.toUpperCase()})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-black text-blue-900 outline-none uppercase"
                       />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Indicator Code</label>
                    <input 
                      type="text" 
                      value={editingItem.indicatorCode} 
                      onChange={e => setEditingItem({...editingItem, indicatorCode: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-mono font-black text-blue-600 outline-none"
                      placeholder="B9.1.1.1.1"
                    />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructional Indicator Description</label>
                    <textarea 
                      value={editingItem.indicator} 
                      onChange={e => setEditingItem({...editingItem, indicator: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-xs font-bold text-slate-700 outline-none resize-none min-h-[100px]"
                      placeholder="DESCRIBE THE MEASURABLE OUTCOME..."
                    />
                 </div>

                 <div className="pt-4 flex gap-4">
                    <button onClick={() => setIsEditorOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                    <button onClick={handleSaveIndicator} className="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Save Mapping Node</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="relative">
        {/* Submission Queue - Hover Slide-out Sidebar */}
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[100] group flex items-center">
           {/* Hover Trigger Handle */}
           <div className="w-1.5 h-32 bg-blue-600/30 rounded-r-full cursor-pointer group-hover:opacity-0 transition-opacity"></div>
           
           {/* The actual queue */}
           <div className="absolute left-0 w-80 bg-slate-900 border border-slate-800 rounded-r-[3rem] p-8 shadow-2xl space-y-6 -translate-x-[98%] group-hover:translate-x-0 transition-transform duration-500 ease-in-out">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                 <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Submission Queue</h3>
                 <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" title="Verified"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full" title="Submitted"></div>
                    <div className="w-2 h-2 bg-slate-700 rounded-full" title="Draft"></div>
                 </div>
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar-v">
                 {filteredSubjects.map(sub => {
                   const isSelected = selectedSubject === sub;
                   const isDisabled = isFacilitator && activeFacilitator?.subject !== sub;
                   return (
                     <button 
                       key={sub} 
                       onClick={() => setSelectedSubject(sub)}
                       disabled={isDisabled}
                       className={`w-full text-left p-5 rounded-[2rem] border transition-all flex flex-col gap-2 ${isSelected ? 'bg-blue-600 border-blue-400 shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 hover:border-slate-700'} ${isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                     >
                       <span className="text-[11px] font-black text-white uppercase leading-none">{sub}</span>
                       <div className="flex justify-between items-center">
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">VACANT</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[6px] font-black text-slate-400 uppercase tracking-[0.2em]">DRAFT</span>
                       </div>
                     </button>
                   );
                 })}
              </div>
           </div>
        </div>

        {/* Subject Resource Terminal */}
        <div className="w-full space-y-8">
           <div className="bg-white border border-gray-100 rounded-[3.5rem] shadow-2xl p-10 space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start border-b border-gray-50 pb-8 gap-6">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                       Subject Resource Terminal
                       <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{activeResource.indicators.length > 0 ? 'ACTIVE' : 'DRAFT'}</span>
                    </h3>
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.4em]">{selectedSubject} / {settings.activeMock}</p>
                 </div>
                 <div className="bg-slate-950 px-8 py-4 rounded-3xl border border-slate-900 flex items-center gap-6">
                    <div className="text-center">
                       <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Subject Faculty Lead</span>
                       <p className="text-xs font-black text-white uppercase">{activeFacilitator?.name || 'UNASSIGNED NODE'}</p>
                    </div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                       <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">Facultate Shard Active</span>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Examination Paper (URL)</label>
                    <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-gray-200">
                       <input 
                         type="text" 
                         value={activeResource.questionUrl || ''}
                         onChange={(e) => updateResourceField('questionUrl', e.target.value)}
                         placeholder="Attach Cloud Link..." 
                         className="flex-1 bg-transparent px-4 py-3 text-xs font-mono outline-none" 
                       />
                       <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-black transition-all">Upload Paper</button>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Official Marking Scheme</label>
                    <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-gray-200">
                       <input 
                         type="text" 
                         value={activeResource.schemeUrl || ''}
                         onChange={(e) => updateResourceField('schemeUrl', e.target.value)}
                         placeholder="Attach Scheme Link..." 
                         className="flex-1 bg-transparent px-4 py-3 text-xs font-mono outline-none" 
                       />
                       <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-black transition-all">Upload Scheme</button>
                    </div>
                 </div>
              </div>

              {/* REVISION STRATEGY & CURRICULUM COVERAGE */}
              <div className="bg-blue-950 rounded-[3rem] p-10 text-white space-y-10 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-bl-full blur-3xl"></div>
                 
                 <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                    <div className="space-y-2">
                       <h4 className="text-xl font-black uppercase tracking-tighter">Revision Strategy & Coverage</h4>
                       <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Integrated 3-Year Curriculum Shard</p>
                    </div>
                    <div className="flex items-center gap-6 bg-white/5 p-4 rounded-3xl border border-white/10">
                       <div className="text-center">
                          <span className="text-[8px] font-black text-blue-300 uppercase block mb-1">Coverage Ratio</span>
                          <p className="text-2xl font-black font-mono">{coverageStats.percentage.toFixed(1)}%</p>
                       </div>
                       <div className="w-px h-10 bg-white/10"></div>
                       <div className="text-center">
                          <span className="text-[8px] font-black text-blue-300 uppercase block mb-1">Indicators Covered</span>
                          <p className="text-2xl font-black font-mono">{coverageStats.covered} / {coverageStats.total}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="flex flex-wrap gap-4">
                       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                          {[7, 8, 9].map(year => (
                             <button 
                               key={year}
                               onClick={() => setActivePlanYear(year as any)}
                               className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activePlanYear === year ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-300 hover:bg-white/5'}`}
                             >
                               Basic {year}
                             </button>
                          ))}
                       </div>
                       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                          {[1, 2, 3].map(term => (
                             <button 
                               key={term}
                               onClick={() => setActivePlanTerm(term as any)}
                               className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activePlanTerm === term ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-300 hover:bg-white/5'}`}
                             >
                               Term {term}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
                       <div className="p-6 border-b border-white/10 flex justify-between items-center">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Scheme of Learning — Weekly Breakdown</span>
                          <div className="flex gap-2">
                             <button onClick={handleDownloadSchemeCSV} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all flex items-center gap-2">
                               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                               Download CSV
                             </button>
                             <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all flex items-center gap-2 cursor-pointer">
                               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                               Upload CSV
                               <input type="file" accept=".csv" onChange={handleUploadSchemeCSV} className="hidden" />
                             </label>
                             <button onClick={handleSyncFromScheme} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all">Sync to Connector</button>
                          </div>
                       </div>
                       <div className="max-h-[500px] overflow-y-auto custom-scrollbar-v p-6 space-y-8">
                          {Array.from({ length: 16 }, (_, i) => i + 1).map(week => {
                             const weekEntries = activeScheme.weeks.filter(w => w.week === week);
                             
                             return (
                                <div key={week} className="space-y-3 border-b border-white/10 pb-6 last:border-0">
                                   <div className="flex justify-between items-center px-2">
                                      <span className="text-xs font-black text-blue-500 uppercase tracking-widest">Week {week}</span>
                                      <button 
                                        onClick={() => addSchemeEntry(week)}
                                        className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        Add Entry
                                      </button>
                                   </div>
                                   
                                   {weekEntries.length > 0 ? weekEntries.map((weekData, idx) => (
                                      <div key={weekData.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/20 transition-all relative group">
                                         <div className="md:col-span-2">
                                            <input 
                                              type="text" 
                                              placeholder="Strand"
                                              value={weekData.strand}
                                              onChange={e => updateSchemeWeek(weekData.id, 'strand', e.target.value.toUpperCase())}
                                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
                                            />
                                         </div>
                                         <div className="md:col-span-2">
                                            <input 
                                              type="text" 
                                              placeholder="Sub-Strand"
                                              value={weekData.subStrand}
                                              onChange={e => updateSchemeWeek(weekData.id, 'subStrand', e.target.value.toUpperCase())}
                                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
                                            />
                                         </div>
                                         <div className="md:col-span-2">
                                            <input 
                                              type="text" 
                                              placeholder="Code"
                                              value={weekData.indicatorCode}
                                              onChange={e => updateSchemeWeek(weekData.id, 'indicatorCode', e.target.value.toUpperCase())}
                                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono font-black text-blue-400 outline-none focus:border-blue-500"
                                            />
                                         </div>
                                         <div className="md:col-span-3">
                                            <input 
                                              type="text" 
                                              placeholder="Instructional Indicator"
                                              value={weekData.indicator}
                                              onChange={e => updateSchemeWeek(weekData.id, 'indicator', e.target.value.toUpperCase())}
                                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-300 outline-none focus:border-blue-500"
                                            />
                                         </div>
                                         <div className="md:col-span-3">
                                            <input 
                                              type="text" 
                                              placeholder="Additions / Notes"
                                              value={weekData.additions || ''}
                                              onChange={e => updateSchemeWeek(weekData.id, 'additions', e.target.value.toUpperCase())}
                                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-emerald-400 outline-none focus:border-emerald-500"
                                            />
                                         </div>
                                         
                                         {/* Delete Entry Button */}
                                         <button 
                                           onClick={() => removeSchemeEntry(weekData.id)}
                                           className="absolute -right-2 -top-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                           title="Remove Entry"
                                         >
                                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                         </button>
                                      </div>
                                   )) : (
                                      <div className="bg-white/5 p-4 rounded-2xl border border-dashed border-white/10 flex justify-center items-center">
                                         <button 
                                           onClick={() => addSchemeEntry(week)}
                                           className="text-[9px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                                         >
                                           + Initialize Week {week} Entry
                                         </button>
                                      </div>
                                   )}
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[3rem] border border-gray-100 space-y-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full"></div>
                 <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Syllabus Mapping Framework</h4>
                       <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-1">Auto-build assessment blueprints from curriculum nodes</p>
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-3">
                    <button onClick={handleAutoBuildObjectives} className="bg-white border border-gray-200 text-slate-600 px-6 py-3 rounded-xl font-black text-[9px] uppercase hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">Auto-build Objectives (1-40)</button>
                    <button onClick={handleAutoBuildTheory} className="bg-white border border-gray-200 text-slate-600 px-6 py-3 rounded-xl font-black text-[9px] uppercase hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">Add Section B Hubs (Q1-Q5)</button>
                    <button onClick={handlePurge} className="bg-red-50 border border-red-100 text-red-600 px-6 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm">Purge Framework</button>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="flex flex-col md:flex-row justify-between items-center px-4 gap-4">
                    <div className="space-y-1">
                       <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Question & Indicator Curriculum Connector</h5>
                       <p className="text-[8px] font-bold text-slate-400 uppercase">Mapping curriculum nodes to examination items</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleOpenEditor(undefined, 'A')} className="px-6 py-2.5 rounded-xl bg-blue-50 text-blue-600 font-black text-[9px] uppercase border border-blue-100 shadow-sm hover:bg-blue-600 hover:text-white transition-all">+ Add Item A</button>
                       <button onClick={() => handleOpenEditor(undefined, 'B')} className="px-6 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 font-black text-[9px] uppercase border border-indigo-100 shadow-sm hover:bg-indigo-600 hover:text-white transition-all">+ Add Item B</button>
                    </div>
                 </div>

                 <div className="overflow-x-auto rounded-[2.5rem] border border-gray-100 shadow-xl bg-white max-h-[600px] overflow-y-auto custom-scrollbar-v">
                    <table className="w-full text-left border-collapse">
                       <thead className="bg-slate-950 text-slate-500 uppercase text-[7px] font-black tracking-widest border-b border-slate-900 sticky top-0 z-10">
                          <tr className="h-14">
                             <th className="px-6 py-5 text-center w-12">Sec</th>
                             <th className="px-4 py-5 text-center w-12">Q# Ref</th>
                             <th className="px-6 py-5 min-w-[120px]">Strand Name</th>
                             <th className="px-6 py-5 min-w-[140px]">Sub-Strand / Topic</th>
                             <th className="px-6 py-5 w-24">Indicator Code</th>
                             <th className="px-6 py-5">Instructional Indicator Description</th>
                             <th className="px-4 py-5 text-center w-12">Wgt</th>
                             <th className="px-6 py-5 w-24 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                          {paginatedIndicators.length > 0 ? paginatedIndicators.map((ind) => (
                             <tr key={ind.id} className="hover:bg-blue-50/50 transition-colors h-14 group">
                                <td className="px-6 text-center font-black"><span className={`px-2 py-0.5 rounded text-[8px] text-white ${ind.section === 'A' ? 'bg-blue-500' : 'bg-indigo-500'}`}>{ind.section}</span></td>
                                <td className="px-4 text-center font-black text-slate-500 text-[10px]">#{ind.questionRef}</td>
                                <td className="px-6 text-[9px] font-black text-slate-700 uppercase truncate max-w-[100px]">{ind.strand}</td>
                                <td className="px-6 text-[9px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{ind.subStrand}</td>
                                <td className="px-6 text-[9px] font-mono font-black text-blue-600">{ind.indicatorCode}</td>
                                <td className="px-6 text-[9px] text-slate-500 uppercase leading-none truncate max-w-[200px]">{ind.indicator}</td>
                                <td className="px-4 text-center font-mono text-[10px] font-black">{ind.weight}</td>
                                <td className="px-6 text-right">
                                   <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleOpenEditor(ind)} className="text-blue-500 hover:text-blue-700 p-1">
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                      </button>
                                      <button onClick={() => {
                                         const next = activeResource.indicators.filter((i) => i.id !== ind.id);
                                         updateResourceField('indicators', next);
                                      }} className="text-slate-200 hover:text-red-500 p-1">
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          )) : (
                             <tr>
                                <td colSpan={8} className="py-24 text-center opacity-30 italic text-[10px] font-black uppercase tracking-[0.4em]">
                                   No instructional indicators mapped for this subject shard.<br/>
                                   Use structural generators above to initiate framework.
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                  </div>

                  {totalIndicatorPages > 1 && (
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-3xl border border-gray-100 mt-4">
                       <div className="flex gap-2">
                          <button 
                            disabled={indicatorPage === 1}
                            onClick={() => setIndicatorPage(prev => Math.max(1, prev - 1))}
                            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-600 disabled:opacity-30 transition-all hover:bg-blue-50 hover:text-blue-600"
                          >
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                          <button 
                            disabled={indicatorPage === totalIndicatorPages}
                            onClick={() => setIndicatorPage(prev => Math.min(totalIndicatorPages, prev + 1))}
                            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-600 disabled:opacity-30 transition-all hover:bg-blue-50 hover:text-blue-600"
                          >
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page {indicatorPage} of {totalIndicatorPages}</span>
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                             <label className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Jump</label>
                             <input 
                                type="number"
                                min="1"
                                max={totalIndicatorPages}
                                value={indicatorPage}
                                onChange={(e) => {
                                   const val = parseInt(e.target.value);
                                   if (val >= 1 && val <= totalIndicatorPages) setIndicatorPage(val);
                                }}
                                className="w-10 bg-transparent border-none text-slate-900 font-black text-xs outline-none focus:ring-0 text-center"
                             />
                          </div>
                       </div>
                    </div>
                  )}
               </div>

               <div className="flex flex-col sm:flex-row justify-between items-center gap-10 pt-8 border-t border-gray-50">
                 <div className="flex gap-10 items-center">
                    <div className="text-center">
                       <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Cohort Weight Mapped</span>
                       <span className="text-2xl font-black text-slate-950 font-mono">
                          {activeResource.indicators.reduce((sum, i) => sum + i.weight, 0)} <span className="text-[10px] text-slate-400">points</span>
                       </span>
                    </div>
                    <div className="w-px h-10 bg-gray-100"></div>
                    <div className="text-center">
                       <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Blueprint Items</span>
                       <span className="text-2xl font-black text-slate-950 font-mono">{activeResource.indicators.length} <span className="text-[10px] text-slate-400">Items</span></span>
                    </div>
                    <div className="w-px h-10 bg-gray-100"></div>
                    <div className="text-center">
                       <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Shard Status</span>
                       <span className="text-lg font-black text-blue-600 uppercase tracking-widest">{activeResource.indicators.length > 0 ? 'READY' : 'DRAFT'}</span>
                    </div>
                 </div>
                 <button onClick={() => onSave?.()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-16 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Verify & Endorse / Commit Shard</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MockResourcesPortal;