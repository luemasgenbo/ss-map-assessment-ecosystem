import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PracticeAssignment, MasterQuestion, GlobalSettings, ProcessedStudent } from '../../types';
import { supabase } from '../../supabaseClient';

interface PupilPracticeHubProps {
  schoolId: string;
  student: ProcessedStudent;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
}

interface HistoricalResult {
  subject: string;
  score: number;
  total_items: number;
  time_taken: number;
  completed_at: string;
}

interface IdentityShard {
  monetary_balance: number;
  daily_usage_count: number;
  last_limit_reset: string;
}

const PupilPracticeHub: React.FC<PupilPracticeHubProps> = ({ schoolId, student, settings, onSettingChange }) => {
  const studentId = student.id;
  const studentName = student.name;
  
  const [activeSet, setActiveSet] = useState<PracticeAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedQs, setSubmittedQs] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [history, setHistory] = useState<HistoricalResult[]>([]);
  const [availableShards, setAvailableShards] = useState<PracticeAssignment[]>([]);
  const [identityShard, setIdentityShard] = useState<IdentityShard | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isNavVisible, setIsNavVisible] = useState(false);
  const objScrollRef = useRef<HTMLDivElement>(null);

  const markIndicatorAsCovered = useCallback((subject: string, indicatorCode: string) => {
    if (!indicatorCode || !settings.resourcePortal) return;
    
    const currentPortal = { ...settings.resourcePortal };
    const mockData = { ...currentPortal[settings.activeMock] };
    const subjectData = { ...mockData[subject] };
    
    if (!subjectData.indicators) return;
    
    let changed = false;
    const nextIndicators = subjectData.indicators.map(ind => {
      if (ind.indicatorCode === indicatorCode && !ind.isCovered) {
        changed = true;
        return { ...ind, isCovered: true, coveredAt: new Date().toISOString() };
      }
      return ind;
    });

    if (changed) {
      onSettingChange('resourcePortal', {
        ...currentPortal,
        [settings.activeMock]: {
          ...mockData,
          [subject]: { ...subjectData, indicators: nextIndicators }
        }
      });
    }
  }, [settings, onSettingChange]);

  const fetchIdentityAndHistory = useCallback(async () => {
    try {
      const studentIdStr = studentId.toString();
      const { data: ident } = await supabase
        .from('uba_identities')
        .select('monetary_balance, daily_usage_count, last_limit_reset')
        .eq('node_id', studentIdStr)
        .maybeSingle();
      
      if (ident) {
        const lastReset = new Date(ident.last_limit_reset || 0);
        const hoursDiff = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60);
        if (hoursDiff >= 24) {
           await supabase.from('uba_identities').update({ 
             daily_usage_count: 0, 
             last_limit_reset: new Date().toISOString() 
           }).eq('node_id', studentIdStr);
           setIdentityShard({ ...ident, daily_usage_count: 0 });
        } else {
           setIdentityShard(ident as IdentityShard);
        }
      } else {
        // Auto-initialize identity if missing
        const newIdent = { monetary_balance: 0, daily_usage_count: 0, last_limit_reset: new Date().toISOString() };
        await supabase.from('uba_identities').insert({
          node_id: studentIdStr,
          ...newIdent
        });
        setIdentityShard(newIdent);
      }

      const { data: hist } = await supabase
        .from('uba_practice_results')
        .select('subject, score, total_items, time_taken, completed_at')
        .eq('student_id', studentIdStr)
        .order('completed_at', { ascending: false });

      if (hist) setHistory(hist as HistoricalResult[]);
    } catch (e) {
      console.error("Recall Error:", e);
    }
  }, [studentId]);

  const fetchAvailableShards = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('uba_instructional_shards')
        .select('payload')
        .eq('hub_id', schoolId);
      if (data) setAvailableShards(data.map(d => d.payload as PracticeAssignment));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [schoolId]);

  useEffect(() => {
    fetchIdentityAndHistory();
    fetchAvailableShards();
  }, [fetchIdentityAndHistory, fetchAvailableShards]);

  const startSession = (assignment: PracticeAssignment) => {
    setActiveSet(assignment);
    setAnswers({});
    setSubmittedQs({});
    setIsCompleted(false);
    setIsPaused(false);
    setSessionScore(0);
    setSecondsElapsed(0);
    setCurrentIdx(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsElapsed(prev => isPaused ? prev : prev + 1);
    }, 1000);
  };

  const handleObjectiveSelect = async (qId: string, opt: string) => {
    if (isPaused) return;
    
    // If already selected this exact option, do nothing
    if (answers[qId] === opt) return;

    const isFirstSelection = !answers[qId];
    
    setAnswers(prev => ({ ...prev, [qId]: opt }));
    setSubmittedQs(prev => ({ ...prev, [qId]: true }));
    
    const q = activeSet?.questions.find(x => x.id === qId);
    
    // Update score logic: if it was correct before and now it's not, decrement. If it's now correct, increment.
    if (q) {
      const wasCorrect = answers[qId] === q.correctKey;
      const isNowCorrect = opt === q.correctKey;
      
      if (wasCorrect && !isNowCorrect) setSessionScore(prev => Math.max(0, prev - 1));
      else if (!wasCorrect && isNowCorrect) setSessionScore(prev => prev + 1);

      // Mark curriculum coverage
      if (activeSet?.subject && q.indicatorCode) {
        markIndicatorAsCovered(activeSet.subject, q.indicatorCode);
      }
    }

    // Metering logic - only charge on first selection
    if (isFirstSelection && identityShard) {
      const isFree = (identityShard.monetary_balance || 0) <= 0;
      if (isFree && (identityShard.daily_usage_count || 0) >= 40) {
         // Rollback selection if quota exceeded
         setAnswers(prev => { const n = {...prev}; delete n[qId]; return n; });
         setSubmittedQs(prev => { const n = {...prev}; delete n[qId]; return n; });
         return alert("24-HOUR QUOTA EXCEEDED.");
      }

      try {
        if (isFree) {
          const nextCount = (identityShard.daily_usage_count || 0) + 1;
          await supabase.from('uba_identities').update({ daily_usage_count: nextCount }).eq('node_id', studentId.toString());
          setIdentityShard({ ...identityShard, daily_usage_count: nextCount });
        } else {
          const nextBal = Math.max(0, (identityShard.monetary_balance || 0) - 0.05);
          await supabase.from('uba_identities').update({ monetary_balance: nextBal }).eq('node_id', studentId.toString());
          setIdentityShard({ ...identityShard, monetary_balance: nextBal });
        }
      } catch (e) { console.error("Metering Failure"); }
    }
  };

  const handleFinalizeSession = useCallback(async (auto = false) => {
    if (!activeSet || isCompleted) return;
    if (!auto && !window.confirm("Finalize session?")) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await supabase.from('uba_practice_results').insert({
        hub_id: schoolId || 'GLOBAL',
        student_id: studentId.toString(),
        student_name: studentName || 'CANDIDATE',
        subject: activeSet.subject,
        assignment_id: activeSet.id,
        score: sessionScore,
        total_items: activeSet.questions.length,
        answer_matrix: answers,
        time_taken: secondsElapsed,
        completed_at: new Date().toISOString()
      });
      setIsCompleted(true);
      fetchIdentityAndHistory();
    } catch (e) { setIsCompleted(true); }
  }, [activeSet, isCompleted, sessionScore, answers, secondsElapsed, studentId, studentName, schoolId, fetchIdentityAndHistory]);

  const formatTime = (totalSecs: number) => {
     const mins = Math.floor(totalSecs / 60);
     const secs = totalSecs % 60;
     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const { specialMocks, regularPractice } = useMemo(() => ({
    specialMocks: availableShards.filter(s => s.pushedBy === 'HQ-SERIALIZED'),
    regularPractice: availableShards.filter(s => s.pushedBy !== 'HQ-SERIALIZED' && s.pushedBy !== 'AUTO_GENERATED')
  }), [availableShards]);

  const autoGeneratedPractice = useMemo(() => 
    availableShards.filter(s => s.pushedBy === 'AUTO_GENERATED'),
  [availableShards]);

  const generateDailyPractice = async () => {
    setIsGenerating(true);
    try {
      // 1. Determine target terms
      const mockNumMatch = settings.activeMock.match(/\d+/);
      const mockNum = mockNumMatch ? parseInt(mockNumMatch[0]) : 0;
      
      let targetTerms: number[] = [];
      if (mockNum === 10) targetTerms = [1, 2, 3];
      else if ([1, 4, 7].includes(mockNum)) targetTerms = [1];
      else if ([2, 5, 8].includes(mockNum)) targetTerms = [2];
      else if ([3, 6, 9].includes(mockNum)) targetTerms = [3];

      // 2. Get mapped indicators for the current mock
      const portal = settings.resourcePortal || {};
      const mockData = portal[settings.activeMock] || {};
      
      // Collect all indicators across all subjects the student takes
      const studentSubjects = student.subjects.map(s => s.subject);
      const targetIndicatorCodes = new Set<string>();
      
      studentSubjects.forEach(sub => {
        const subResource = mockData[sub];
        if (subResource) {
          subResource.indicators.forEach(ind => {
            if (ind.indicatorCode) targetIndicatorCodes.add(ind.indicatorCode);
          });
        }
      });

      // 3. Fetch all questions for these subjects
      const { data: allQuestions, error } = await supabase
        .from('uba_questions')
        .select('*')
        .in('subject', studentSubjects);

      if (error) throw error;
      if (!allQuestions || allQuestions.length === 0) throw new Error("No questions found in bank.");

      const mappedQs: MasterQuestion[] = allQuestions.map(q => ({
        id: q.external_id || q.id,
        originalIndex: 0,
        type: q.type as 'OBJECTIVE' | 'THEORY',
        subject: q.subject,
        strand: q.strand || 'UNMAPPED',
        strandCode: q.strand_code || '',
        subStrand: q.sub_strand || 'UNMAPPED',
        subStrandCode: q.sub_strand_code || '',
        indicator: q.indicator_text || 'UNMAPPED',
        indicatorCode: q.indicator_code || '',
        questionText: q.question_text,
        instruction: q.instruction || '',
        correctKey: q.correct_key || '',
        answerScheme: q.answer_scheme || '',
        weight: q.weight || 1,
        blooms: q.blooms_level as any,
        parts: [],
        diagramUrl: q.diagram_url || '',
        ghanaianLanguageTag: q.ghanaian_language_tag,
        facilitatorName: q.facilitator_email || 'NETWORK_SHARD'
      }));

      // 4. Filter by target indicators (Syllabus Mapping Framework)
      const filteredQs = mappedQs.filter(q => q.indicatorCode && targetIndicatorCodes.has(q.indicatorCode));
      
      if (filteredQs.length === 0) throw new Error("No questions match the current syllabus mapping.");

      // 5. Calculate Mastery & Coverage
      const masteryMap = student.masteryMap || [];
      const getMastery = (indicatorCode: string) => {
        const m = masteryMap.find(x => x.indicator === indicatorCode);
        return m ? m.averageScore : 0;
      };

      // 6. Split into Objective and Theory
      const objectives = filteredQs.filter(q => q.type === 'OBJECTIVE');
      const theory = filteredQs.filter(q => q.type === 'THEORY');

      // 7. Sampling Logic: 80% lowest mastery, 20% repeated
      const attemptedIds = new Set(history.map(h => (h as any).assignment_id)); 
      
      const sampleSet = (pool: MasterQuestion[], targetCount: number) => {
        if (pool.length === 0) return [];
        
        const sortedByMastery = [...pool].sort((a, b) => getMastery(a.indicatorCode || '') - getMastery(b.indicatorCode || ''));
        
        const count80 = Math.round(targetCount * 0.8);
        const count20 = targetCount - count80;
        
        const lowestMastery = sortedByMastery.slice(0, count80);
        const remaining = sortedByMastery.slice(count80);
        const repeated = [...remaining].sort(() => 0.5 - Math.random()).slice(0, count20);
        
        return [...lowestMastery, ...repeated].sort(() => 0.5 - Math.random());
      };

      let finalObjectives: MasterQuestion[] = [];
      let finalTheory: MasterQuestion[] = [];

      if (mockNum === 10) {
        // Mock 10 distribution: 34% T1, 36% T2, 30% T3
        const filterByTerm = (qs: MasterQuestion[], term: number) => {
          // We need to know the term of the indicator. We can get this from the resourcePortal.
          const termIndicators = new Set<string>();
          studentSubjects.forEach(sub => {
            const subResource = mockData[sub];
            if (subResource) {
              subResource.indicators.filter(i => i.sourceTerm === term).forEach(ind => {
                if (ind.indicatorCode) termIndicators.add(ind.indicatorCode);
              });
            }
          });
          return qs.filter(q => q.indicatorCode && termIndicators.has(q.indicatorCode));
        };

        const objT1 = filterByTerm(objectives, 1);
        const objT2 = filterByTerm(objectives, 2);
        const objT3 = filterByTerm(objectives, 3);

        finalObjectives = [
          ...sampleSet(objT1, Math.round(40 * 0.34)),
          ...sampleSet(objT2, Math.round(40 * 0.36)),
          ...sampleSet(objT3, Math.max(0, 40 - Math.round(40 * 0.34) - Math.round(40 * 0.36)))
        ];

        const theoryT1 = filterByTerm(theory, 1);
        const theoryT2 = filterByTerm(theory, 2);
        const theoryT3 = filterByTerm(theory, 3);

        finalTheory = [
          ...sampleSet(theoryT1, 1),
          ...sampleSet(theoryT2, 2),
          ...sampleSet(theoryT3, 2)
        ];
      } else {
        finalObjectives = sampleSet(objectives, 40);
        finalTheory = sampleSet(theory, 5);
      }

      const finalQuestions = [...finalObjectives, ...finalTheory];

      // 8. Create Assignment
      const assignment: PracticeAssignment = {
        id: `AUTO-${studentId}-${Date.now()}`,
        title: `Daily Practice: ${settings.activeMock}`,
        subject: "MULTI-SUBJECT ADAPTIVE",
        timeLimit: 45,
        questions: finalQuestions,
        pushedBy: 'AUTO_GENERATED',
        timestamp: new Date().toISOString()
      };

      // 9. Save to Shards so it persists for the session
      await supabase.from('uba_instructional_shards').upsert({
        id: assignment.id,
        hub_id: schoolId,
        payload: assignment
      });

      setAvailableShards(prev => [assignment, ...prev]);
      startSession(assignment);
      alert("Personalized Daily Practice Generated based on Syllabus Mapping Framework.");
    } catch (e: any) {
      alert(`Generation Failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const isMock = activeSet?.pushedBy === 'HQ-SERIALIZED';

  if (activeSet && !isCompleted) {
    const q = activeSet.questions[currentIdx];
    const hasSubmitted = submittedQs[q.id];
    const timeLimit = (activeSet.timeLimit || 30) * 60;
    const timeRemaining = Math.max(0, timeLimit - secondsElapsed);
    const isFirst = currentIdx === 0;
    const isLast = currentIdx === activeSet.questions.length - 1;

    return (
      <div className="fixed inset-0 bg-slate-950 z-[300] flex flex-col font-sans overflow-hidden">
         
         {/* JUMP MATRIX DROPDOWN TRIGGER */}
         <div className="absolute top-4 left-4 z-[450]">
            <button 
              onClick={() => setIsNavVisible(!isNavVisible)}
              className="bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/20 hover:bg-blue-600 transition-all"
            >
               Jump Matrix
            </button>
         </div>

         {isNavVisible && (
            <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
               <div className="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                     <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Navigate Matrix</h4>
                     <button onClick={() => setIsNavVisible(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                     </button>
                  </div>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                     {activeSet.questions.map((oq, i) => (
                        <button 
                           key={oq.id} 
                           onClick={() => { setCurrentIdx(i); setIsNavVisible(false); }} 
                           className={`h-10 w-10 rounded-xl font-black text-xs transition-all border ${currentIdx === i ? 'bg-blue-600 text-white border-blue-400' : submittedQs[oq.id] ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-gray-100 hover:bg-slate-100'}`}
                        >
                           {i + 1}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         )}

         {/* HEADER - CHRONOMETER, QUOTA, CONTROL */}
         <div className="bg-slate-900 p-3 flex flex-col sm:flex-row justify-between items-center text-white shrink-0 border-b border-white/5 shadow-2xl relative z-20 gap-3">
            <div className="flex items-center gap-4 ml-24">
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
               </div>
               <div className="hidden sm:block">
                  <h4 className="text-[8px] font-black uppercase tracking-widest text-blue-400 leading-none">NODE ASSESSMENT</h4>
                  <p className="text-xs font-black uppercase tracking-tight mt-0.5 truncate max-w-[150px]">{activeSet.subject}</p>
               </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
               {!isMock && (
                  <div className="bg-slate-950/40 border border-emerald-500/10 px-4 py-1.5 rounded-xl flex flex-col items-center">
                     <span className="text-[6px] font-black font-mono text-white">
                        {40 - (identityShard?.daily_usage_count || 0)} / 40 Shards
                     </span>
                  </div>
               )}

               <div className="bg-slate-950/40 border border-white/5 text-center px-6 py-1.5 rounded-xl">
                  <span className={`text-base font-black font-mono tracking-widest ${timeRemaining < 300 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                     {formatTime(timeRemaining)}
                  </span>
               </div>

               {!isMock && (
                  <button 
                    onClick={() => setIsPaused(!isPaused)} 
                    className={`px-5 py-2 rounded-xl font-black text-[9px] uppercase transition-all active:scale-95 border border-white/5 ${isPaused ? 'bg-amber-600/80 text-white' : 'bg-slate-800/40 text-slate-400'}`}
                  >
                    {isPaused ? 'Continue' : 'Pause'}
                  </button>
               )}

               <button 
                 onClick={() => handleFinalizeSession(false)} 
                 className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase shadow-xl transition-all"
               >
                 Finalize
               </button>
            </div>
         </div>

         {/* MAIN CONTENT AREA */}
         <div className="flex-1 flex overflow-hidden relative group/viewport">
            
            {isPaused && (
               <div className="absolute inset-0 z-[400] bg-slate-950/90 backdrop-blur-3xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Suspended</h3>
                  <button 
                    onClick={() => setIsPaused(false)} 
                    className="bg-white text-slate-950 px-12 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-blue-600 hover:text-white"
                  >
                    Resume Session
                  </button>
               </div>
            )}

            {/* PREVIOUS QUESTION MOVEMENT TRIGGER */}
            <button 
               disabled={isFirst || isPaused}
               onClick={() => setCurrentIdx(prev => prev - 1)}
               className={`absolute inset-y-0 left-8 w-12 md:w-16 z-[460] flex items-center justify-center transition-all opacity-0 group-hover/viewport:opacity-100 disabled:hidden`}
            >
               <div className="w-12 h-12 rounded-full bg-slate-950/40 backdrop-blur-sm flex items-center justify-center text-white/40 shadow-xl border border-white/5 hover:text-white hover:scale-110 transition-all">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M15 18l-6-6 6-6"/></svg>
               </div>
            </button>

            {/* NEXT QUESTION MOVEMENT TRIGGER */}
            <button 
               disabled={isLast || isPaused}
               onClick={() => setCurrentIdx(prev => prev + 1)}
               className={`absolute inset-y-0 right-8 w-12 md:w-16 z-[460] flex items-center justify-center transition-all opacity-0 group-hover/viewport:opacity-100 disabled:hidden`}
            >
               <div className="w-12 h-12 rounded-full bg-slate-950/40 backdrop-blur-sm flex items-center justify-center text-white/40 shadow-xl border border-white/5 hover:text-white hover:scale-110 transition-all">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M9 18l6-6-6-6"/></svg>
               </div>
            </button>

            <main className="flex-1 flex flex-col items-center justify-center p-0 bg-slate-950">
               <div className="w-full max-w-5xl h-full bg-white shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col border-x border-white/5">
                  <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-10 lg:p-12">
                     <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center gap-6">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-xl transition-all ${hasSubmitted ? 'bg-slate-950 text-white' : 'bg-blue-600/90 text-white'}`}>
                              {currentIdx + 1}
                           </div>
                           <div className="space-y-0.5">
                              <span className="text-[8px] font-black uppercase text-blue-600 tracking-[0.3em] block leading-none">Cognitive Node</span>
                              <h5 className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                {q.strand} — {q.blooms}
                                {(q as any).section && ` — SECTION ${(q as any).section}`}
                              </h5>
                           </div>
                        </div>
                        
                        <div className="space-y-6">
                           {q.diagramUrl && (
                              <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4 flex justify-center overflow-hidden">
                                 <img src={q.diagramUrl} alt="Question Illustration" className="max-h-[300px] object-contain rounded-xl" referrerPolicy="no-referrer" />
                              </div>
                           )}
                           <h3 className="text-sm md:text-base font-black text-slate-900 uppercase leading-relaxed tracking-tight border-l-[6px] border-blue-900 pl-6">
                              {q.questionText}
                           </h3>
                           
                           {q.type === 'OBJECTIVE' && (
                              <div className="pt-2 space-y-2">
                                 {['A', 'B', 'C', 'D'].map((opt, i) => {
                                    const isSelected = answers[q.id] === opt;
                                    const alternatives = q.answerScheme?.split('|') || [];
                                    return (
                                       <button 
                                          key={opt} 
                                          disabled={isPaused} 
                                          onClick={() => handleObjectiveSelect(q.id, opt)} 
                                          className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 text-left group/opt relative overflow-hidden ${isSelected ? 'bg-blue-900 border-blue-900 text-white shadow-xl scale-[1.02]' : 'bg-slate-50/50 border-gray-100 text-slate-700 hover:border-blue-300 hover:bg-white'}`}
                                       >
                                          <div className={`w-6 h-6 rounded flex items-center justify-center font-black text-[10px] shrink-0 border relative z-10 transition-colors ${isSelected ? 'bg-white text-blue-900 border-white' : 'bg-white text-slate-300 border-gray-100 group-hover/opt:border-blue-400 group-hover/opt:text-blue-600'}`}>{opt}</div>
                                          <span className="text-xs font-black uppercase tracking-tight leading-none relative z-10">{alternatives[i] || `Statement ${opt}`}</span>
                                       </button>
                                    );
                                 })}
                              </div>
                           )}

                           {q.type === 'THEORY' && (
                              <div className="pt-1 space-y-2">
                                 <textarea 
                                    disabled={isPaused}
                                    value={answers[q.id] || ''} 
                                    onChange={(e) => { 
                                       const val = e.target.value;
                                       setAnswers(prev => ({ ...prev, [q.id]: val })); 
                                       setSubmittedQs(prev => ({ ...prev, [q.id]: !!val.trim() })); 
                                       if (activeSet?.subject && q.indicatorCode && val.trim()) {
                                         markIndicatorAsCovered(activeSet.subject, q.indicatorCode);
                                       }
                                    }} 
                                    className="w-full min-h-[250px] p-8 bg-slate-50/50 border border-gray-100 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner placeholder:text-slate-200 uppercase" 
                                    placeholder="ANALYSIS TERMINAL ACTIVE..." 
                                 />
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                  
                  {/* FOOTER STATUS BAR */}
                  <div className="bg-slate-50/80 border-t border-gray-100 px-10 py-4 flex justify-between items-center shrink-0">
                     <span className="text-[8px] font-black text-blue-900/60 uppercase tracking-widest">Item {currentIdx + 1} of {activeSet.questions.length}</span>
                     <div className="flex gap-4">
                        <button disabled={isFirst} onClick={() => setCurrentIdx(prev => prev - 1)} className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-[8px] font-black uppercase text-slate-500 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30">Prev</button>
                        <button disabled={isLast} onClick={() => setCurrentIdx(prev => prev + 1)} className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-[8px] font-black uppercase text-slate-500 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30">Next</button>
                     </div>
                  </div>
               </div>
            </main>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-14 animate-in fade-in duration-1000 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        <div className="lg:col-span-2 space-y-12">
          {specialMocks.length > 0 && (
            <section className="space-y-6">
              <h4 className="text-[11px] font-black text-red-600 uppercase tracking-[0.4em] flex items-center gap-3"><div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></div>Authorized Serialized Mocks</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {specialMocks.map(shard => (
                  <button key={shard.id} onClick={() => startSession(shard)} className="bg-white border-2 border-red-100 p-8 rounded-[3.5rem] shadow-xl text-left hover:border-red-500 hover:shadow-2xl transition-all group relative overflow-hidden"><div className="absolute top-0 right-0 bg-red-600 text-white px-5 py-1.5 rounded-bl-3xl font-black text-[9px] uppercase tracking-widest">OFFICIAL</div><div className="flex items-center gap-6"><div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border border-red-100">{shard.subject?.charAt(0) || '?'}</div><div className="space-y-1.5"><h4 className="text-xl font-black text-slate-900 uppercase leading-none">{shard.subject}</h4><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">HQ Serialized Node</span></div></div></button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-6">
            <div className="flex justify-between items-center">
               <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.4em]">Standard Instructional Shards</h4>
               <button 
                 onClick={generateDailyPractice}
                 disabled={isGenerating}
                 className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
               >
                 {isGenerating ? (
                   <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 ) : (
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                 )}
                 Generate Daily Practice
               </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {autoGeneratedPractice.map(shard => (
                <button key={shard.id} onClick={() => startSession(shard)} className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[3.5rem] shadow-xl text-left hover:border-emerald-500 hover:shadow-2xl transition-all group relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-emerald-600 text-white px-4 py-1 rounded-bl-2xl font-black text-[8px] uppercase tracking-widest">ADAPTIVE</div>
                   <div className="flex items-center gap-8">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">DP</div>
                      <div className="space-y-1.5">
                         <h4 className="text-xl font-black text-slate-900 uppercase leading-none">Daily Practice</h4>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{shard.questions.length} Items • {new Date(shard.timestamp).toLocaleDateString()}</p>
                      </div>
                   </div>
                </button>
              ))}
              {regularPractice.map(shard => (
                <button key={shard.id} onClick={() => startSession(shard)} className="bg-white border border-gray-100 p-8 rounded-[3.5rem] shadow-xl text-left hover:border-blue-500 hover:shadow-2xl transition-all group"><div className="flex items-center gap-8"><div className="w-16 h-16 bg-blue-50 text-blue-900 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border border-blue-100 group-hover:bg-blue-900 group-hover:text-white transition-colors">{shard.subject?.charAt(0) || '?'}</div><div className="space-y-1.5"><h4 className="text-xl font-black text-slate-900 uppercase leading-none">{shard.subject}</h4><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facilitator Push • {shard.questions.length} Items</p></div></div></button>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-950 p-10 rounded-[3.5rem] shadow-2xl border border-emerald-500/20 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full" />
              <div className="space-y-1">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Candidate Account Balance</span>
                 <h3 className="text-4xl font-black text-white font-mono">GHS {identityShard?.monetary_balance?.toFixed(2) || '0.00'}</h3>
              </div>
           </div>

           <div className="bg-slate-900 text-white p-10 rounded-[3.5rem] shadow-2xl border border-white/5 space-y-8">
              <div className="flex justify-between items-center border-b border-white/10 pb-6"><h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Instructional History</h4><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[8px] font-black">{history.length} SYNCED</span></div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
                 {history.length > 0 ? history.map((res, i) => {
                    const accuracy = Math.round((res.score / res.total_items) * 100);
                    return (
                       <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4 hover:border-blue-500/40 transition-all group"><div className="flex justify-between items-center"><p className="text-[11px] font-black uppercase text-white truncate max-w-[120px] group-hover:text-blue-400 transition-colors">{res.subject}</p><span className={`px-3 py-1 rounded-lg text-[9px] font-black font-mono ${accuracy >= 70 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{accuracy}%</span></div><div className="flex justify-between text-[7px] font-mono text-slate-500 uppercase tracking-widest"><span>{new Date(res.completed_at).toLocaleDateString()}</span><span>{formatTime(res.time_taken)} DUR</span></div></div>
                    );
                 }) : (<p className="py-20 text-center opacity-20 text-[10px] uppercase font-black tracking-widest italic">Buffer Vacant</p>)}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PupilPracticeHub;
