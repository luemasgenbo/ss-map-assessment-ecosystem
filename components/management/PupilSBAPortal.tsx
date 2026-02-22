
import React, { useState, useRef } from 'react';
import { StudentData, GlobalSettings, MockScoreSet } from '../../types';
import { supabase } from '../../supabaseClient';

interface PupilSBAPortalProps {
  students: StudentData[];
  setStudents: React.Dispatch<React.SetStateAction<StudentData[]>>;
  settings: GlobalSettings;
  subjects: string[];
  onSave: (overrides?: any) => void;
}

const PupilSBAPortal: React.FC<PupilSBAPortalProps> = ({ students, setStudents, settings, subjects, onSave }) => {
  const [formData, setFormData] = useState({ 
    name: '', gender: 'M', guardianName: '', parentContact: '', parentEmail: '',
    ghanaianLanguage: 'TWI (ASANTE)', practiceFee: 0, paymentToken: ''
  });
  
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeSbaId, setActiveSbaId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateCompositeId = (hubId: string, academicYear: string, sequence: number) => {
     const tail = (hubId || "SMA-0000").split('-').pop() || "0000";
     const year = (academicYear || "2025").split(/[/|-]/).pop() || new Date().getFullYear().toString();
     const number = sequence.toString().padStart(3, '0');
     return `${tail}${year}${number}`;
  };

  const generateSixDigitPin = () => Math.floor(100000 + Math.random() * 900000).toString();

  const handleGlobalCloudSync = async () => {
    if (students.length === 0) return alert("No pupils found to sync.");
    setIsEnrolling(true);
    try {
      // 1. Save to persistence blob (legacy support)
      await onSave({ students: students }); 

      // 2. Push granular shards to uba_pupils
      const pupilShards = students.map(s => ({
        student_id: s.indexNumber || s.id.toString(),
        name: s.name,
        gender: s.gender,
        class_name: 'BASIC 9',
        hub_id: settings.schoolNumber,
        unique_code: s.uniqueCode,
        created_at: new Date().toISOString()
      }));

      if (pupilShards.length > 0) {
        await supabase.from('uba_pupils').upsert(pupilShards, { onConflict: 'student_id' });
      }

      alert(`CLOUD IDENTITY MIRROR COMPLETE: ${students.length} pupils projected to login registry and granular shards synchronized.`);
    } catch (err: any) {
      alert("Sync Failure: " + err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDownloadTemplate = () => {
    const header = "Full Name,Gender(M/F),Guardian Name,Phone Contact,Notification Email\n";
    const sample = "DOE JOHN,M,DOE SR,0240000000,john@example.com\n";
    const blob = new Blob([header + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "UBA_Pupil_Enrollment_Template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPupilPack = (s: StudentData) => {
    const text = `UNITED BAYLOR ACADEMY - PUPIL ACCESS PACK\n` +
                 `==========================================\n\n` +
                 `CANDIDATE:     ${s.name}\n` +
                 `INDEX NUMBER:  ${s.indexNumber}\n` +
                 `ACCESS PIN:    ${s.uniqueCode}\n\n` +
                 `------------------------------------------\n` +
                 `INSTRUCTIONS:\n` +
                 `1. Access the Pupil Portal at the login gate.\n` +
                 `2. Enter your Name or Index Number.\n` +
                 `3. Use the 6-Digit PIN above for authorization.\n\n` +
                 `INSTITUTION:   ${settings.schoolName}\n` +
                 `HUB NODE ID:   ${settings.schoolNumber}\n` +
                 `DATE ISSUED:   ${new Date().toLocaleDateString()}\n\n` +
                 `* KEEP THIS PIN SECURE AND PRIVATE.`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AccessPack_${s.indexNumber}_${s.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareWhatsApp = (s: StudentData) => {
    const msg = `*UNITED BAYLOR ACADEMY - PUPIL LOGIN PACK*\n\n` +
                `Hello *${s.name}*,\n` +
                `Your academic node has been activated.\n\n` +
                `*ACCESS CREDENTIALS:*\n` +
                `Identity: *${s.name}*\n` +
                `Index Number: *${s.indexNumber}*\n` +
                `Login PIN: *${s.uniqueCode}*\n\n` +
                `_Use these to access your reports at the Pupil Portal._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleAddOrUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsEnrolling(true);
    try {
      if (editingId) {
        const student = students.find(s => s.id === editingId);
        if (!student) return;
        const updatedPupil = { 
          ...student, name: formData.name.toUpperCase(), gender: formData.gender, 
          parentName: formData.guardianName.toUpperCase(), parentContact: formData.parentContact, 
          parentEmail: formData.parentEmail.toLowerCase(),
          ghanaianLanguage: formData.ghanaianLanguage,
          practiceFee: formData.practiceFee,
          practiceTokenIds: formData.paymentToken ? [formData.paymentToken.toUpperCase()] : student.practiceTokenIds
        };
        const nextStudents = students.map(s => s.id === editingId ? updatedPupil : s);
        setStudents(nextStudents);
        await onSave({ students: nextStudents });
      } else {
        const nextSeq = students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 101;
        const studentId = generateCompositeId(settings.schoolNumber, settings.academicYear, nextSeq);
        const accessPin = generateSixDigitPin();
        const newPupil: StudentData = {
          id: nextSeq, indexNumber: studentId, uniqueCode: accessPin, name: formData.name.toUpperCase().trim(),
          gender: formData.gender, email: formData.parentEmail?.toLowerCase().trim() || `${studentId}@uba.internal`,
          parentName: formData.guardianName.toUpperCase().trim(), parentContact: formData.parentContact.trim(),
          parentEmail: formData.parentEmail?.toLowerCase().trim(), attendance: 0, scores: {}, sbaScores: {}, examSubScores: {}, mockData: {},
          ghanaianLanguage: formData.ghanaianLanguage,
          practiceFee: formData.practiceFee,
          practiceTokenIds: formData.paymentToken ? [formData.paymentToken.toUpperCase()] : []
        };
        const nextStudents = [...students, newPupil];
        setStudents(nextStudents);
        await onSave({ students: nextStudents });
      }
      setFormData({ 
        name: '', gender: 'M', guardianName: '', parentContact: '', parentEmail: '',
        ghanaianLanguage: 'TWI (ASANTE)', practiceFee: 0, paymentToken: ''
      });
      setEditingId(null);
    } catch (err: any) { 
      alert("Matrix Fault: " + err.message); 
    } finally { 
      setIsEnrolling(false); 
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
      const dataLines = lines.slice(1);
      const nextStudents = [...students];
      let startId = nextStudents.length > 0 ? Math.max(...nextStudents.map(s => s.id)) + 1 : 101;
      
      for (const line of dataLines) {
        const parts = line.split(",").map(p => p.replace(/"/g, '').trim());
        if (parts[0]) {
          const studentId = generateCompositeId(settings.schoolNumber, settings.academicYear, startId);
          const pin = generateSixDigitPin();
          nextStudents.push({
            id: startId++, 
            name: parts[0].toUpperCase(), 
            gender: (parts[1] || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
            parentName: parts[2] || '', 
            parentContact: parts[3] || '', 
            parentEmail: parts[4] || '',
            email: parts[4] || `${studentId.toLowerCase()}@uba.internal`, 
            indexNumber: studentId, 
            uniqueCode: pin,
            attendance: 0, scores: {}, sbaScores: {}, examSubScores: {}, mockData: {}
          });
        }
      }
      setStudents(nextStudents);
      onSave({ students: nextStudents });
      alert(`BULK INGESTION SUCCESS: ${dataLines.length} candidates projected to network buffer.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const updateSbaScore = (studentId: number, subject: string, value: string) => {
    const numeric = Math.min(100, Math.max(0, parseInt(value) || 0));
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const activeMock = settings.activeMock;
      const currentMockData = s.mockData?.[activeMock] || { scores: {}, sbaScores: {}, examSubScores: {}, facilitatorRemarks: {}, observations: { facilitator: "", invigilator: "", examiner: "" }, attendance: 0, conductRemark: "" };
      return { 
        ...s, 
        sbaScores: { ...(s.sbaScores || {}), [subject]: numeric },
        mockData: {
          ...(s.mockData || {}),
          [activeMock]: { ...currentMockData, sbaScores: { ...(currentMockData.sbaScores || {}), [subject]: numeric } }
        }
      };
    }));
  };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 font-sans">
      <section className="bg-slate-950 border border-white/5 p-10 rounded-[4rem] shadow-2xl space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-1">
               <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.5em]">Identity Mirror Hub</h4>
               <p className="text-white text-2xl font-black uppercase tracking-tight">Security Node Synchronization</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
               <button onClick={handleGlobalCloudSync} disabled={isEnrolling} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/></svg>
                  Mirror All Identities
               </button>
               <button onClick={handleDownloadTemplate} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white/10 transition-all flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Template
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
                  Bulk Enrolment (CSV)
               </button>
               <input type="file" ref={fileInputRef} onChange={handleBulkUpload} accept=".csv" className="hidden" />
            </div>
         </div>
      </section>

      <section className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-2xl relative overflow-hidden">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">{editingId ? 'Modulate Candidate Identity' : 'Individual Enrollment'}</h3>
        <form onSubmit={handleAddOrUpdateStudent} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Full Identity</label>
            <input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase" placeholder="PUPIL FULL IDENTITY" required />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Gender</label>
            <select value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black"><option value="M">MALE</option><option value="F">FEMALE</option></select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Guardian Name</label>
            <input type="text" value={formData.guardianName} onChange={e=>setFormData({...formData, guardianName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase" placeholder="Guardian Full Name" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Phone Contact</label>
            <input type="text" value={formData.parentContact} onChange={e=>setFormData({...formData, parentContact: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black" placeholder="PHONE CONTACT" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Notification Email</label>
            <input type="email" value={formData.parentEmail} onChange={e=>setFormData({...formData, parentEmail: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black" placeholder="Notification Email" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Ghanaian Language</label>
            <select value={formData.ghanaianLanguage} onChange={e=>setFormData({...formData, ghanaianLanguage: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black">
              {["TWI (AKUAPEM)", "TWI (ASANTE)", "FANTE", "GA", "EWE", "DANGME", "NZEMA", "KASEM", "GONJA"].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Practice Fee (GHS)</label>
            <input type="number" value={formData.practiceFee} onChange={e=>setFormData({...formData, practiceFee: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black" placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Payment Token / ID</label>
            <input type="text" value={formData.paymentToken} onChange={e=>setFormData({...formData, paymentToken: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black" placeholder="TKN-XXXXX" />
          </div>
          <div className="lg:col-span-3 pt-4 flex gap-4">
             <button type="submit" disabled={isEnrolling} className={`flex-1 ${editingId ? 'bg-indigo-600' : 'bg-blue-900'} text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl transition-all`}>
                {isEnrolling ? "Syncing Identity..." : editingId ? "Update Identity" : "Enroll & Synchronize"}
             </button>
             {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData({name:'',gender:'M',guardianName:'',parentContact:'',parentEmail:'', ghanaianLanguage: 'TWI (ASANTE)', practiceFee: 0, paymentToken: ''});}} className="px-10 bg-slate-100 text-slate-500 rounded-3xl font-black text-[11px] uppercase">Cancel</button>}
          </div>
        </form>
      </section>

      <div className="space-y-6">
         <div className="relative">
            <input type="text" placeholder="SEARCH COHORT REGISTRY..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-gray-100 rounded-3xl px-14 py-6 text-sm font-bold shadow-xl outline-none transition-all uppercase" />
            <svg className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" cy="11" x2="16.65" y2="16.65"/></svg>
         </div>

         <div className="grid grid-cols-1 gap-6">
            {filteredStudents.map(s => {
               const isOpen = activeSbaId === s.id;
               const mockSba = s.mockData?.[settings.activeMock]?.sbaScores || {};
               return (
                 <div key={s.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-lg overflow-hidden group hover:border-blue-300 transition-all">
                    <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-8">
                       <div className="flex items-center gap-6 flex-1">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-4 border-white shadow-md ${s.gender === 'F' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                             {s.name.charAt(0)}
                          </div>
                          <div className="space-y-1">
                             <h4 className="text-lg font-black text-slate-900 uppercase leading-none">{s.name}</h4>
                             <div className="flex flex-wrap items-center gap-3">
                                <span className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded tracking-widest">{s.indexNumber}</span>
                                <span className="text-[8px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded tracking-widest">PIN: {s.uniqueCode}</span>
                                <span className="text-[8px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded tracking-widest">{s.ghanaianLanguage}</span>
                                {s.practiceFee ? <span className="text-[8px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded tracking-widest">Fee: GHS {s.practiceFee}</span> : null}
                             </div>
                          </div>
                       </div>
                       
                           <div className="flex flex-wrap gap-2 justify-center">
                              <button onClick={() => { setEditingId(s.id); setFormData({ name: s.name, gender: s.gender === 'F' ? 'F' : 'M', guardianName: s.parentName || '', parentContact: s.parentContact || '', parentEmail: s.parentEmail || '', ghanaianLanguage: s.ghanaianLanguage || 'TWI (ASANTE)', practiceFee: s.practiceFee || 0, paymentToken: s.practiceTokenIds?.[0] || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-gray-50 text-slate-500 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase border border-gray-200 hover:bg-white transition-all">Edit</button>
                          <button onClick={() => setActiveSbaId(isOpen ? null : s.id)} className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all shadow-md ${isOpen ? 'bg-blue-900 text-white' : 'bg-indigo-50 text-indigo-600'}`}>SBA Ledger</button>
                          <button onClick={() => handleDownloadPupilPack(s)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                             Credentials
                          </button>
                          <button onClick={() => handleShareWhatsApp(s)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-green-700 transition-all flex items-center gap-2">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-7.6 8.38 8.38 0 0 1 3.8.9L21 3.5Z"/></svg>
                             Share
                          </button>
                       </div>
                    </div>
                    {isOpen && (
                       <div className="px-8 pb-8 pt-4 bg-slate-50 border-t border-gray-100 animate-in slide-in-from-top-2">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                             {subjects.map(sub => (
                                <div key={sub} className="space-y-1">
                                   <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block ml-1">{sub}</label>
                                   <input 
                                     type="number" 
                                     value={mockSba[sub] || 0} 
                                     onChange={(e) => updateSbaScore(s.id, sub, e.target.value)}
                                     className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                                   />
                                </div>
                             ))}
                          </div>
                          <div className="mt-6 flex justify-end">
                             <button onClick={() => { onSave(); setActiveSbaId(null); }} className="bg-blue-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">Commit SBA</button>
                          </div>
                       </div>
                    )}
                 </div>
               );
            })}
         </div>
      </div>
    </div>
  );
};

export default PupilSBAPortal;
