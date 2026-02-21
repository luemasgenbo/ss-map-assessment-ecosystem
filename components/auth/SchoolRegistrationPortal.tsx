
import React, { useState } from 'react';
import { GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';

interface SchoolRegistrationPortalProps {
  settings: GlobalSettings;
  onBulkUpdate: (updates: Partial<GlobalSettings>) => void;
  onSave: () => void;
  onComplete?: (hubId: string) => void;
  onResetStudents?: () => void;
  onSwitchToLogin?: () => void;
}

const SchoolRegistrationPortal: React.FC<SchoolRegistrationPortalProps> = ({ 
  settings, onBulkUpdate, onSave, onComplete, onResetStudents, onSwitchToLogin 
}) => {
  const [formData, setFormData] = useState({
    schoolName: '',
    location: '',
    registrant: '', 
    email: '',
    contact: '' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'FORM' | 'SUCCESS'>('FORM');
  const [finalHubId, setFinalHubId] = useState('');
  const [finalAccessKey, setFinalAccessKey] = useState('');

  const generateUniqueKey = () => {
    return 'SMA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleDownloadRequirements = () => {
    const text = `SS-MAP: INSTITUTIONAL ONBOARDING PREREQUISITES\n` +
                 `==================================================\n\n` +
                 `I. BEFORE YOU REGISTER:\n` +
                 `Ensure you have the following information ready:\n` +
                 `1. Official School Name (Exactly as it appears on reports)\n` +
                 `2. Valid Institutional Email (For high-level node recovery)\n` +
                 `3. Full Legal Name of the Registrant (Primary Administrator)\n` +
                 `4. Active Contact Phone Number\n` +
                 `5. Location Particulars (Town, Region, Country)\n\n` +
                 `II. POST-REGISTRATION STEPS:\n` +
                 `Once you receive your Node ID and Access Key:\n` +
                 `1. Login to the Management Hub.\n` +
                 `2. Navigate to 'Staff Hub' to perform a bulk CSV upload of faculty.\n` +
                 `3. Navigate to 'Pupils & SBA' to perform a bulk enrollment of candidates.\n` +
                 `4. Download the generated Private PINs for every pupil.\n\n` +
                 `III. TECHNICAL SUPPORT:\n` +
                 `Direct Line: +233 24 350 4091\n` +
                 `Email: leumasgenbo4@gmail.com\n` +
                 `Registry Controller: Samuel Obeng\n\n` +
                 `"SS-MAP: Precision in Assessment, Excellence in Character."`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SSMap_Registration_Guide.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.schoolName || !formData.registrant || !formData.email || !formData.contact) {
        alert("Complete all particulars."); return;
    }
    setIsLoading(true);
    try {
      const hubId = `SMA-2025-${Math.floor(1000 + Math.random() * 9000)}`;
      const targetEmail = formData.email.toLowerCase().trim();
      const targetName = formData.registrant.toUpperCase().trim();
      const accessKey = generateUniqueKey();
      const ts = new Date().toISOString();

      const { error: idError } = await supabase.from('uba_identities').upsert({
        email: targetEmail,
        full_name: targetName,
        node_id: hubId,
        hub_id: hubId,
        role: 'school_admin',
        unique_code: accessKey 
      });

      if (idError) throw idError;

      const newSettings: GlobalSettings = {
        ...settings,
        schoolName: formData.schoolName.toUpperCase(),
        schoolAddress: formData.location.toUpperCase(),
        registrantName: targetName,
        registrantEmail: targetEmail,
        schoolContact: formData.contact,
        schoolEmail: targetEmail,
        schoolNumber: hubId,
        accessCode: accessKey,
        reportDate: new Date().toLocaleDateString()
      };

      await supabase.from('uba_persistence').upsert([
        { id: `${hubId}_settings`, hub_id: hubId, payload: newSettings, last_updated: ts },
        { id: `${hubId}_students`, hub_id: hubId, payload: [], last_updated: ts },
        { id: `${hubId}_facilitators`, hub_id: hubId, payload: {}, last_updated: ts }
      ]);

      await supabase.from('uba_persistence').upsert({ 
        id: `registry_${hubId}`, 
        hub_id: hubId, 
        payload: { 
          ...newSettings, 
          id: hubId,
          name: formData.schoolName.toUpperCase(),
          status: 'active', 
          lastActivity: ts, 
          studentCount: 0 
        } 
      });

      onBulkUpdate(newSettings);
      if (onResetStudents) onResetStudents();
      setFinalHubId(hubId);
      setFinalAccessKey(accessKey);
      setStep('SUCCESS');
      onSave();

    } catch (err: any) {
      alert("Registration Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCredentials = () => {
    const text = `UNITED BAYLOR ACADEMY - INSTITUTIONAL ACCESS PACK\n` +
                 `==================================================\n\n` +
                 `I. ACCESS CREDENTIALS (SAVE IMMEDIATELY):\n` +
                 `1. Institution Name:   ${formData.schoolName.toUpperCase()}\n` +
                 `2. System Node ID:     ${finalHubId}\n` +
                 `3. Registrant Identity: ${formData.registrant.toUpperCase()}\n` +
                 `4. Master Access Key:   ${finalAccessKey}\n\n` +
                 `--------------------------------------------------\n` +
                 `II. BULK DATA INGESTION INSTRUCTIONS:\n` +
                 `1. Login at the gate using your Full Name and System Node ID.\n` +
                 `2. STAFF UPLOAD: Go to 'Staff Hub' -> 'Download Template'. Fill CSV and upload.\n` +
                 `3. PUPIL ENROLLMENT: Go to 'Pupils & SBA' -> 'Download Template'. Fill CSV and upload.\n` +
                 `4. REPORTING: Ensure all subject shards are synchronized for NRT grading.\n\n` +
                 `--------------------------------------------------\n` +
                 `III. NETWORK SUPPORT:\n` +
                 `Controller: Samuel Obeng\n` +
                 `Direct: +233 24 350 4091\n` +
                 `Email: leumasgenbo4@gmail.com\n\n` +
                 `Notice: This Access Key is unique and required for all future identity recalls.`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UBA_Access_Pack_${finalHubId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCredentials = () => {
    const text = `Institution: ${formData.schoolName.toUpperCase()}\nID: ${finalHubId}\nIdentity: ${formData.registrant.toUpperCase()}\nKey: ${finalAccessKey}`;
    navigator.clipboard.writeText(text);
    alert("Access Credentials copied to clipboard.");
  };

  if (step === 'SUCCESS') {
    return (
      <div className="max-w-2xl mx-auto p-4 animate-in zoom-in-95 duration-700">
         <div className="bg-slate-900 rounded-[3rem] p-12 text-center shadow-2xl border border-white/10 space-y-8">
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="space-y-2">
               <h3 className="text-3xl font-black text-white uppercase tracking-tight">Institutional Enrollment Complete</h3>
               <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Network Shard Synchronized</p>
            </div>
            <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4 text-left">
               <div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">System Node ID (Identity Recall)</span>
                  <p className="text-2xl font-mono font-black text-blue-400 tracking-tighter">{finalHubId}</p>
               </div>
               <div className="pt-4 border-t border-white/5">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Master Access Key</span>
                  <p className="text-2xl font-mono font-black text-emerald-400 tracking-tighter">{finalAccessKey}</p>
               </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
               <button onClick={copyCredentials} className="bg-white/10 hover:bg-white text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Copy Pack</button>
               <button onClick={downloadCredentials} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all">Download (.txt)</button>
            </div>
            <div className="text-left px-4">
              <p className="text-[10px] text-slate-400 italic">Notice: Use your Full Name and the System Node ID above at the Login Gate. Your institutional identity is now unique and stored in the Global Hub.</p>
            </div>
            <button 
              onClick={() => onComplete?.(finalHubId)}
              className="w-full bg-white text-slate-950 py-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              Access Management Hub
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 animate-in fade-in duration-700">
      <div className="bg-slate-950 p-1 rounded-[3.2rem] shadow-2xl border border-white/10">
        <div className="bg-white rounded-[3rem] p-10 md:p-14 relative overflow-hidden">
          <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Institutional Enrollment</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Identity Registry Provisioning</p>
          </div>

          <form onSubmit={handleRegister} className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Academy Name</label>
              <input type="text" value={formData.schoolName} onChange={e=>setFormData({...formData, schoolName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="ENTER SCHOOL NAME..." required />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Registrant Full Name</label>
              <input type="text" value={formData.registrant} onChange={e=>setFormData({...formData, registrant: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="FULL LEGAL IDENTITY..." required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Contact Phone</label>
                <input type="text" value={formData.contact} onChange={e=>setFormData({...formData, contact: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none" placeholder="024 350 4091" required />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Location</label>
                <input type="text" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none uppercase" placeholder="TOWN / CITY" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Official Email</label>
              <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none" placeholder="INFO@ACADEMY.COM" required />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-900 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] disabled:opacity-50 transition-all hover:bg-black mt-4 shadow-2xl active:scale-95">
              {isLoading ? "Syncing Shards..." : "Execute Enrollment"}
            </button>
            
            <div className="flex flex-col gap-4 mt-4">
              <button type="button" onClick={handleDownloadRequirements} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download Onboarding Guide (.txt)
              </button>
              <button type="button" onClick={onSwitchToLogin} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline text-center w-full">Already Registered? Recall Identity</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SchoolRegistrationPortal;
