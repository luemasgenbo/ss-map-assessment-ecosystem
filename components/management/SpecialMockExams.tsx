import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { GlobalSettings, SerializedExam, MasterQuestion } from '../../types';

interface SpecialMockExamsProps {
  settings: GlobalSettings;
}

// Extending local type to handle acceptance state
interface LocalSerializedExam extends SerializedExam {
  accepted?: boolean;
  acceptedDate?: string;
}

const SpecialMockExams: React.FC<SpecialMockExamsProps> = ({ settings }) => {
  const [exams, setExams] = useState<LocalSerializedExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const fetchSpecialMocks = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data } = await supabase
        .from('uba_persistence')
        .select('id, payload')
        .eq('hub_id', settings.schoolNumber)
        .like('id', 'special_mock_%');
      
      if (data) {
        setExams(data.map(d => ({ ...d.payload, uba_persistence_id: d.id }) as LocalSerializedExam));
      }
    } catch (e) {
      console.error("Recall Error:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialMocks();
    const interval = setInterval(() => fetchSpecialMocks(true), 20000);
    return () => clearInterval(interval);
  }, [settings.schoolNumber]);

  const handleAcceptExam = async (exam: LocalSerializedExam) => {
    const id = (exam as any).uba_persistence_id;
    if (!id) return;
    
    setIsProcessing(exam.subject + '_accept');
    try {
      const ts = new Date().toISOString();
      const updatedPayload = { 
        ...exam, 
        accepted: true, 
        acceptedDate: ts 
      };
      // Remove the internal ID before saving back to payload
      delete (updatedPayload as any).uba_persistence_id;

      await supabase.from('uba_persistence').update({
        payload: updatedPayload,
        last_updated: ts
      }).eq('id', id);

      alert(`HANDSHAKE ACCEPTED: ${exam.subject} serialization has been verified and added to the institutional vault.`);
      await fetchSpecialMocks();
    } catch (e: any) {
      alert("Acceptance Fault: " + e.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePushToPracticeHub = async (exam: LocalSerializedExam) => {
    setIsProcessing(exam.subject + '_push');
    try {
      const hubId = settings.schoolNumber;
      const subKey = exam.subject.replace(/\s+/g, '');
      const shardId = `special_mock_shard_${hubId}_${subKey}`;

      // Combine all variants into a unified randomized practice pool for pupils
      const allQs: MasterQuestion[] = [
        ...exam.packs.A.objectives, ...exam.packs.A.theory,
        ...exam.packs.B.objectives, ...exam.packs.B.theory,
        ...exam.packs.C.objectives, ...exam.packs.C.theory,
        ...exam.packs.D.objectives, ...exam.packs.D.theory,
        ...exam.packs.E.objectives, ...exam.packs.E.theory,
      ];

      await supabase.from('uba_instructional_shards').upsert({
        id: shardId,
        hub_id: hubId,
        payload: {
          id: shardId,
          title: `SPECIAL MOCK: ${exam.subject}`,
          subject: exam.subject,
          timeLimit: 120, // Standard exam duration
          questions: allQs,
          pushedBy: 'HQ-SERIALIZED',
          timestamp: new Date().toISOString()
        }
      });
      alert(`SPECIAL MOCK BROADCAST ACTIVE: ${exam.subject} pushed to Pupil Hub.`);
    } catch (e) {
      alert("Push Failed.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDownloadVariant = (exam: LocalSerializedExam, variant: 'A' | 'B' | 'C' | 'D' | 'E') => {
    const pack = exam.packs[variant];
    let text = `UNITED BAYLOR ACADEMY - ${exam.subject.toUpperCase()}\n`;
    text += `SERIES: ${exam.mockSeries} | VARIANT: ${variant}\n`;
    text += `INSTITUTION: ${settings.schoolName}\n`;
    text += `==========================================================\n\n`;
    
    text += `SECTION A: OBJECTIVES\n${pack.sectionInstructions.A}\n\n`;
    pack.objectives.forEach((q, i) => {
      text += `${i + 1}. ${q.questionText}\n`;
      const opts = q.answerScheme.split('|');
      if (opts.length === 4) {
        text += `   A. ${opts[0]}   B. ${opts[1]}\n   C. ${opts[2]}   D. ${opts[3]}\n`;
      }
      text += `\n`;
    });

    text += `\nSECTION B: THEORY\n${pack.sectionInstructions.B}\n\n`;
    pack.theory.forEach((q, i) => {
      text += `QUESTION ${i + 1}\n${q.questionText}\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Exam_${exam.subject}_VAR_${variant}.txt`;
    link.click();
  };

  const { incoming, verified } = useMemo(() => ({
    incoming: exams.filter(e => !e.accepted),
    verified: exams.filter(e => e.accepted)
  }), [exams]);

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20 font-sans">
      <div className="bg-slate-950 text-white p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -mr-40 -mt-40 blur-[120px]"></div>
        <div className="relative space-y-2">
           <h2 className="text-3xl font-black uppercase tracking-tight">Special Mock Exams</h2>
           <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.4em]">Official High-Integrity Serialization Relay</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-40 text-center opacity-30 animate-pulse">
           <p className="text-sm font-black uppercase tracking-[0.5em]">Syncing HQ Serialization Cache...</p>
        </div>
      ) : (
        <div className="space-y-16">
          
          {/* INCOMING QUEUE */}
          {incoming.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-6">
                <h3 className="text-xl font-black text-amber-600 uppercase tracking-tighter flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></div>
                  Incoming Serialization Shards
                </h3>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{incoming.length} Pending Audit</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {incoming.map((exam, i) => (
                  <div key={i} className="bg-white border-2 border-amber-100 p-10 rounded-[3rem] shadow-xl space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-amber-500 text-white px-6 py-2 rounded-bl-3xl font-black text-[9px] uppercase tracking-widest">AWAITING ACCEPTANCE</div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">HQ Dispatch Node</span>
                      <h4 className="text-2xl font-black text-slate-900 uppercase leading-tight">{exam.subject}</h4>
                      <p className="text-[10px] font-mono text-slate-400 uppercase">{exam.mockSeries} | {new Date(exam.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div className="bg-amber-50 p-6 rounded-3xl text-[10px] text-amber-800 font-bold leading-relaxed uppercase">
                      Serialized content has been generated by HQ. Audit the shard before accepting into local registry.
                    </div>
                    <button 
                      onClick={() => handleAcceptExam(exam)}
                      disabled={isProcessing === exam.subject + '_accept'}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all"
                    >
                      {isProcessing === exam.subject + '_accept' ? 'Accepting Shard...' : 'Accept & Verify Paper'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* VERIFIED VAULT */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-6">
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Verified Hub Papers</h3>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{verified.length} Shards Operational</span>
            </div>
            {verified.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {verified.map((exam, i) => (
                  <div key={i} className="bg-white border border-gray-100 p-10 rounded-[3rem] shadow-xl hover:shadow-2xl transition-all space-y-8 relative group overflow-hidden border-l-8 border-l-blue-900">
                    <div className="absolute top-0 right-0 bg-blue-900 text-white px-5 py-2 rounded-bl-3xl font-black text-[9px] uppercase">{exam.mockSeries}</div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">Authorized Hub Subject</span>
                        <h4 className="text-2xl font-black text-slate-900 uppercase leading-tight">{exam.subject}</h4>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase">Accepted: {new Date(exam.acceptedDate || '').toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                        {['A', 'B', 'C', 'D', 'E'].map(v => (
                          <button key={v} onClick={() => handleDownloadVariant(exam, v as any)} className="bg-slate-50 hover:bg-blue-900 hover:text-white p-4 rounded-2xl flex flex-col items-center gap-1 transition-all border border-gray-100">
                              <span className="text-xs font-black">{v}</span>
                              <span className="text-[6px] font-bold uppercase opacity-50">Extract</span>
                          </button>
                        ))}
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-500 uppercase">Items Serialized</span>
                          <span className="text-lg font-black text-slate-900 font-mono">{exam.packs.A.objectives.length + exam.packs.A.theory.length}</span>
                        </div>
                    </div>
                    <button 
                      onClick={() => handlePushToPracticeHub(exam)}
                      disabled={isProcessing === exam.subject + '_push'}
                      className="w-full bg-blue-950 hover:bg-black text-white py-5 rounded-[2.5rem] font-black text-[11px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isProcessing === exam.subject + '_push' ? 'Mirroring Shards...' : 'Push Special Mock to Pupil Hub'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white py-32 rounded-[4rem] text-center opacity-30 flex flex-col items-center gap-10 border-4 border-dashed border-gray-100 shadow-inner">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <p className="font-black uppercase text-sm tracking-[0.6em] text-slate-500">No Serialized Papers in Vault</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default SpecialMockExams;
