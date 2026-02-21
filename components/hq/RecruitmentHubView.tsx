import React, { useState, useEffect, useMemo } from 'react';
import { SchoolRegistryEntry, StaffAssignment, StaffApplication, ForwardingData, GlobalSettings } from '../../types';
import { supabase } from '../../supabaseClient';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

const ROLES_META = [
  { id: "DEVELOPER", label: "Questions Bank-DEVELOPER" },
  { id: "INVIGILATOR", label: "Invigilation Slots-INVIGILATOR" },
  { id: "EXAMINER", label: "Marking Proceeds-EXAMINER" }
];

interface ItemizedClaim {
  id: string;
  email: string;
  name: string;
  hub_id: string;
  momoNumber: string;
  momoNetwork: string;
  amounts: { questions: number, invigilation: number, marking: number };
  total: number;
  status: 'PENDING' | 'PENDING_CLAIM_AUDIT' | 'AUTHORIZED_FOR_SETTLEMENT' | 'DISBURSED' | 'REJECTED';
  timestamp: string;
  source?: string;
  auditorToken?: string;
  auditorFeedback?: string;
}

export default function RecruitmentHubView({ registry }: { registry: SchoolRegistryEntry[], onLogAction: any }) {
  const [activeTab, setActiveTab] = useState<'ENLISTMENT' | 'CLAIMS' | 'INSTITUTIONS'>('ENLISTMENT');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [incomingApps, setIncomingApps] = useState<StaffApplication[]>([]);
  const [withdrawalClaims, setWithdrawalClaims] = useState<ItemizedClaim[]>([]);
  const [forwardRequests, setForwardRequests] = useState<ForwardingData[]>([]);
  const [fontScale, setFontScale] = useState(1);
  
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<Set<string>>(new Set());

  const [hqSettings, setHqSettings] = useState<GlobalSettings>({
    schoolName: "UNITED BAYLOR ACADEMY",
    schoolMotto: "EXCELLENCE IN KNOWLEDGE AND CHARACTER",
    schoolAddress: "ACCRA DIGITAL CENTRE, GHANA",
    schoolContact: "+233 24 350 4091",
    schoolEmail: "hq@unitedbaylor.edu.gh",
    schoolWebsite: "WWW.UNITEDBAYLOR.EDU",
    schoolNumber: "HQ-MASTER-NODE",
    examTitle: "NETWORK HUB PERFORMANCE AUDIT",
    academicYear: "2024/2025",
  } as any);

  const [auditorToken, setAuditorToken] = useState('');
  const [auditorFeedback, setAuditorFeedback] = useState('');
  const [activeApp, setActiveApp] = useState<StaffApplication | null>(null);
  const [editApp, setEditApp] = useState<StaffApplication | null>(null);
  const [activeAuditClaim, setActiveAuditClaim] = useState<ItemizedClaim | null>(null);

  const fetchData = async () => {
    setIsProcessing(true);
    try {
      // 1. Fetch Staff Applications
      const { data: apps } = await supabase.from('uba_staff_applications').select('*');
      if (apps) setIncomingApps(apps.map(a => ({
        id: a.id,
        email: a.email,
        name: a.name,
        hub_id: a.hub_id,
        role: a.role,
        status: a.status,
        expectedPayment: a.expected_payment,
        venue: a.venue,
        auditorToken: a.auditor_token,
        auditorFeedback: a.auditor_feedback,
        timestamp: a.timestamp,
        applyDate: new Date(a.timestamp).toLocaleDateString(),
        contractorContact: '+233 24 350 4091'
      }) as StaffApplication));

      // 2. Fetch Claims
      const { data: clms } = await supabase.from('uba_claims').select('*');
      if (clms) setWithdrawalClaims(clms.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        hub_id: c.hub_id,
        momoNumber: c.momo_number,
        momoNetwork: c.momo_network,
        amounts: { questions: c.amount_questions, invigilation: c.amount_invigilation, marking: c.amount_marking },
        total: c.total_amount,
        status: c.status,
        timestamp: c.created_at,
        auditorToken: c.auditor_token,
        auditorFeedback: c.auditor_feedback
      }) as ItemizedClaim));

      // 3. Fetch Forwarding Requests
      const { data: fwds } = await supabase.from('uba_school_forwarding').select('*');
      if (fwds) setForwardRequests(fwds.map(d => ({
        schoolId: d.school_id,
        schoolName: d.school_name,
        submissionTimestamp: d.submission_timestamp,
        approvalStatus: d.approval_status,
        feedback: d.feedback,
        bulkPayment: { amount: d.bulk_payment_amount, transactionId: d.transaction_id },
        ...(d.payload || {})
      }) as ForwardingData));
    } catch (e) {
      console.error("HQ Recall Failure:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenAudit = (app: StaffApplication) => {
    setActiveApp(app);
    setEditApp({ ...app });
    setAuditorToken('');
    setAuditorFeedback('');
  };

  const handleUpdateStatus = async (status: 'APPROVED' | 'CONFIRMED' | 'REJECTED') => {
    if (!editApp || !editApp.email) return;
    setIsProcessing(true);
    try {
      const ts = new Date().toISOString();
      const updatedApp = { 
        id: editApp.id,
        email: editApp.email.toLowerCase(),
        name: editApp.name,
        hub_id: editApp.hub_id || 'HQ-INTERNAL',
        role: editApp.role,
        status: status,
        expected_payment: editApp.expectedPayment || 150.00,
        venue: editApp.venue || 'CENTRAL HQ NODE',
        auditor_token: auditorToken || editApp.id,
        auditor_feedback: auditorFeedback,
        timestamp: ts
      };

      await supabase.from('uba_staff_applications').upsert(updatedApp);

      if (status === 'CONFIRMED') {
        const claimId = `claim_contract_${editApp.id}`;
        const claimPayload = {
          id: claimId,
          email: editApp.email.toLowerCase(),
          name: editApp.name,
          hub_id: editApp.hub_id || 'HQ-HUB',
          momo_number: 'SYSTEM_VAULT',
          momo_network: 'INTERNAL',
          amount_questions: editApp.role === 'DEVELOPER' ? updatedApp.expected_payment : 0, 
          amount_invigilation: editApp.role === 'INVIGILATOR' ? updatedApp.expected_payment : 0, 
          amount_marking: editApp.role === 'EXAMINER' ? updatedApp.expected_payment : 0,
          total_amount: updatedApp.expected_payment,
          status: 'AUTHORIZED_FOR_SETTLEMENT',
          auditor_token: auditorToken || editApp.id,
          auditor_feedback: auditorFeedback,
          created_at: ts
        };

        await supabase.from('uba_claims').upsert(claimPayload);
      }

      alert(`HANDSHAKE EXECUTED: Status for ${editApp.name} updated to ${status}. Authorization Token ${auditorToken || editApp.id} attached.`);
      setActiveApp(null);
      setEditApp(null);
      await fetchData();
    } catch (e: any) {
      alert("Matrix Handshake Error: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthorizeWithdrawal = async (claim: ItemizedClaim) => {
    if (!auditorToken) return alert("SECURITY ERROR: A valid withdrawal token must be assigned for this shard.");
    setIsProcessing(true);
    try {
      const ts = new Date().toISOString();
      
      await supabase.from('uba_claims').update({
        status: 'AUTHORIZED_FOR_SETTLEMENT',
        auditor_token: auditorToken,
        auditor_feedback: auditorFeedback
      }).eq('id', claim.id);

      alert(`CLAIM VERIFIED: Shard for ${claim.name} authorized with token ${auditorToken}. Amount: GHS ${claim.total.toFixed(2)} pushed to Settlement Queue.`);
      setActiveAuditClaim(null);
      setAuditorToken('');
      setAuditorFeedback('');
      await fetchData();
    } catch (e: any) {
      alert("Audit Handshake Failure: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredStaff = useMemo(() => {
    const list: any[] = [];
    const validIncomingApps = incomingApps.filter(a => a && a.email);
    const uniqueEmails = Array.from(new Set(validIncomingApps.map(a => a.email.toLowerCase())));
    
    uniqueEmails.forEach(email => {
       const apps = validIncomingApps.filter(a => a.email.toLowerCase() === email);
       if (apps.length === 0) return;
       const first = apps[0];
       const school = registry.find(r => r.id === first.hub_id);
       const isForwarded = forwardRequests.some(f => f.schoolId === first.hub_id);
       list.push({
          name: first.name || 'UNKNOWN',
          email: email,
          schoolName: first.schoolName || school?.name || 'EXTERNAL SOURCE',
          hubId: first.hub_id,
          isForwarded: isForwarded,
          apps: apps
       });
    });
    return list.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [incomingApps, registry, searchTerm, forwardRequests]);

  const filteredInstitutions = useMemo(() => {
    return forwardRequests.filter(f => f && f.schoolName && f.schoolName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [forwardRequests, searchTerm]);

  const handleToggleInstitution = (id: string) => {
    const next = new Set(selectedInstitutionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInstitutionIds(next);
  };

  const handleToggleAllInstitutions = () => {
    if (selectedInstitutionIds.size === filteredInstitutions.length) {
      setSelectedInstitutionIds(new Set());
    } else {
      setSelectedInstitutionIds(new Set(filteredInstitutions.map(f => f.schoolId)));
    }
  };

  const handleDownloadSelectedInstitutions = () => {
    const selected = forwardRequests.filter(f => selectedInstitutionIds.has(f.schoolId));
    if (selected.length === 0) return alert("Select institutions to download.");

    let text = `${hqSettings.schoolName} - HQ DISPATCH AUDIT REPORT\n`;
    text += `ADDRESS: ${hqSettings.schoolAddress}\n`;
    text += `FORWARDED INSTITUTIONAL NODES SUMMARY\n`;
    text += `DATE: ${new Date().toLocaleString()}\n`;
    text += `==========================================================\n\n`;

    selected.forEach((f, i) => {
        text += `[NODE ${i + 1}]\n`;
        text += `INSTITUTION: ${f.schoolName}\n`;
        text += `HUB NODE ID: ${f.schoolId}\n`;
        text += `ROSTER SIZE: ${Object.keys(f.pupilLanguages || {}).length} Pupils\n`;
        text += `PAYMENT REF: ${f.bulkPayment?.transactionId || 'N/A'}\n`;
        text += `GHS VOLUME:  GHS ${f.bulkPayment?.amount.toFixed(2)}\n`;
        text += `STATUS:      ${f.approvalStatus}\n`;
        text += `TIMESTAMP:   ${new Date(f.submissionTimestamp).toLocaleString()}\n`;
        text += `FEEDBACK:    ${f.feedback || 'Handshake synchronized.'}\n`;
        text += `----------------------------------------------------------\n\n`;
    });

    text += `AUDIT END | NETWORK MASTER SIGNATURE: ${new Date().toISOString()}\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HQ_Institutional_Forwarding_Audit.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 font-sans text-slate-100 p-0 space-y-0 min-h-screen">
      
      {/* PERSISTENT HUB NAV BAR */}
      <div className="sticky top-0 z-[100] bg-slate-900 border-b border-slate-800 p-4 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl backdrop-blur-xl">
         <div className="flex gap-2 bg-slate-950/50 p-1.5 rounded-3xl border border-white/5 overflow-hidden">
            <button onClick={() => setActiveTab('ENLISTMENT')} className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'ENLISTMENT' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Matrix</button>
            <button onClick={() => setActiveTab('INSTITUTIONS')} className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'INSTITUTIONS' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Dispatch</button>
            <button onClick={() => setActiveTab('CLAIMS')} className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'CLAIMS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Claims</button>
         </div>

         {/* TEXT SIZE ADJUSTER */}
         <div className="flex items-center gap-4 bg-slate-950/50 px-6 py-2 rounded-2xl border border-white/5">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Text Size</span>
            <input 
              type="range" 
              min="0.7" 
              max="1.5" 
              step="0.05" 
              value={fontScale} 
              onChange={e => setFontScale(parseFloat(e.target.value))}
              className="w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[10px] font-mono text-blue-400 font-black">{Math.round(fontScale * 100)}%</span>
         </div>

         <div className="flex gap-3">
            <button onClick={fetchData} className="p-3 text-emerald-500 hover:text-white transition-colors">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/></svg>
            </button>
         </div>
      </div>

      {/* CONTENT AREA WITH SCALE */}
      <div className="flex-1 overflow-auto p-8" style={{ fontSize: `${fontScale}rem` }}>
        
        {activeTab === 'ENLISTMENT' && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex justify-end px-4 mb-4">
                <input type="text" placeholder="Filter specialists..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none w-full md:w-80 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase" />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] overflow-x-auto shadow-2xl no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-20 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-10">Specialist Identity & Node Context</th>
                        <th className="px-6 text-center">Reward Capacity</th>
                        <th className="px-10 text-right">Role Handshakes (Audit Access)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                      {filteredStaff.map((s, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-all h-32 group">
                          <td className="px-10">
                            <div className="flex items-center gap-4">
                                <div>
                                  <span className="font-black text-white uppercase text-base group-hover:text-blue-400 transition-colors leading-none">{s.name}</span>
                                  <p className="text-[9px] font-mono text-slate-500 mt-2 uppercase tracking-widest">ID Node: {s.email}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[8px] text-slate-600 font-bold uppercase">{s.schoolName}</p>
                                      {s.isForwarded && <span className="bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-[4px] text-[7px] font-black uppercase">FORWARDED</span>}
                                  </div>
                                </div>
                            </div>
                          </td>
                          <td className="px-6 text-center">
                            <span className="text-sm font-black text-indigo-400 font-mono">
                                GHS {s.apps.reduce((sum: number, a: any) => sum + (a.status !== 'REJECTED' && a.status !== 'PAID' ? (a.expectedPayment || 150) : 0), 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-10 text-right">
                            <div className="flex justify-end gap-3 flex-wrap max-w-md ml-auto">
                                {['DEVELOPER', 'EXAMINER', 'INVIGILATOR'].map(role => {
                                  const app = s.apps.find((a: StaffApplication) => a.role === role);
                                  if (!app) return null;
                                  return (
                                    <button 
                                      key={role} 
                                      onClick={() => handleOpenAudit(app)}
                                      className={`px-5 py-2.5 rounded-xl border transition-all flex items-center gap-2 hover:scale-105 active:scale-95 group/btn ${
                                          app.status === 'APPROVED' ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-400' : 
                                          app.status === 'CONFIRMED' ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 
                                          app.status === 'REJECTED' ? 'bg-red-600/10 border-red-500/50 text-red-400' :
                                          app.status === 'PAID' ? 'bg-slate-800 text-slate-500' :
                                          'bg-amber-600/10 border-amber-500/50 text-amber-400 animate-pulse'
                                      }`}
                                    >
                                        <span className="text-[8px] font-black uppercase tracking-widest">{role}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                        <span className="text-[7px] font-black uppercase">{app.status}</span>
                                    </button>
                                  );
                                })}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
            </div>
          </div>
        )}

        {activeTab === 'INSTITUTIONS' && (
          <div className="space-y-8 animate-in slide-in-from-left-4 duration-500 pb-20 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end px-4 gap-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase text-emerald-400 tracking-tight leading-none">Forwarded Institutional Nodes</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Integrated Roster & Payment Shard Audit</p>
                </div>
                <div className="flex gap-3">
                  <input type="text" placeholder="Filter institutions..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none w-full md:w-80 transition-all uppercase" />
                  <button 
                    onClick={handleDownloadSelectedInstitutions}
                    disabled={selectedInstitutionIds.size === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2"
                  >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download Selected ({selectedInstitutionIds.size})
                  </button>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-16 border-b border-slate-800">
                      <tr>
                        <th className="px-10 w-12 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-600" 
                              checked={selectedInstitutionIds.size > 0 && selectedInstitutionIds.size === filteredInstitutions.length}
                              onChange={handleToggleAllInstitutions}
                            />
                        </th>
                        <th className="px-6">Institutional Shard Identity</th>
                        <th className="px-6 text-center">Roster Census</th>
                        <th className="px-6 text-center">Payment Magnitude</th>
                        <th className="px-6">Status / Reference Shard</th>
                        <th className="px-10 text-right">Dispatch Time</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                      {filteredInstitutions.map((f, i) => (
                        <tr key={f.schoolId} className={`hover:bg-white/5 h-24 group transition-colors ${selectedInstitutionIds.has(f.schoolId) ? 'bg-emerald-600/5' : ''}`}>
                          <td className="px-10 text-center">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-600" 
                                checked={selectedInstitutionIds.has(f.schoolId)}
                                onChange={() => handleToggleInstitution(f.schoolId)}
                            />
                          </td>
                          <td className="px-6">
                            <span className="font-black text-white uppercase text-base leading-none group-hover:text-emerald-400 transition-colors">{f.schoolName}</span>
                            <p className="text-[9px] font-mono text-slate-600 mt-2 uppercase tracking-tighter">NODE ID: {f.schoolId}</p>
                          </td>
                          <td className="px-6 text-center">
                            <span className="bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800 text-sm font-black text-blue-400 font-mono">
                                {Object.keys(f.pupilLanguages || {}).length}
                            </span>
                          </td>
                          <td className="px-6 text-center">
                            <span className="text-base font-black text-emerald-400 font-mono">GHS {f.bulkPayment?.amount.toFixed(2)}</span>
                          </td>
                          <td className="px-6">
                            <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase w-fit ${
                                  f.approvalStatus === 'PENDING' ? 'bg-amber-600/20 text-amber-500' :
                                  f.approvalStatus === 'APPROVED' ? 'bg-blue-600/20 text-blue-400' :
                                  'bg-emerald-600/20 text-emerald-400'
                                }`}>
                                  {f.approvalStatus || 'PENDING_AUDIT'}
                                </span>
                                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter truncate max-w-[150px]">REF: {f.bulkPayment?.transactionId || '---'}</span>
                            </div>
                          </td>
                          <td className="px-10 text-right">
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{new Date(f.submissionTimestamp).toLocaleDateString()}</span>
                            <p className="text-[8px] font-mono text-slate-600 uppercase">{new Date(f.submissionTimestamp).toLocaleTimeString()}</p>
                          </td>
                        </tr>
                      ))}
                      {filteredInstitutions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-40 text-center opacity-20">
                            <p className="font-black uppercase text-sm tracking-[1em]">Dispatch Registry Vacant</p>
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
            </div>
          </div>
        )}

        {activeTab === 'CLAIMS' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end px-4 gap-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase text-indigo-400 tracking-tight leading-none">Claims Audit Unit</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Intermediate Verification Layer for Withdrawal Shards</p>
                </div>
                <input type="text" placeholder="Search claims..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none w-full md:w-80 transition-all uppercase" />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[8px] font-black tracking-widest h-20 border-b border-slate-800">
                      <tr>
                        <th className="px-10">Specialist Hub</th>
                        <th className="px-6">Status / Security Token</th>
                        <th className="px-6 text-center">Audit Actions</th>
                        <th className="px-10 text-right">Claim Volume</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                      {withdrawalClaims.filter(c => c && c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())).map((clm, i) => (
                        <tr key={i} className="hover:bg-white/5 h-28">
                          <td className="px-10">
                            <span className="font-black text-white uppercase text-base leading-none">{clm.name}</span>
                            <p className="text-[9px] font-mono text-slate-500 mt-2 uppercase">{clm.email}</p>
                          </td>
                          <td className="px-6">
                            <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase w-fit ${
                                  clm.status === 'PENDING_CLAIM_AUDIT' ? 'bg-amber-600/20 text-amber-500' :
                                  clm.status === 'AUTHORIZED_FOR_SETTLEMENT' ? 'bg-indigo-600/20 text-indigo-400' :
                                  'bg-emerald-600/20 text-emerald-400'
                                }`}>
                                  {clm.status?.replace(/_/g, ' ') || 'UNKNOWN'}
                                </span>
                                <span className="text-[7px] text-slate-600 font-mono">TOKEN: {clm.auditorToken || clm.id?.split('_').pop() || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 text-center">
                            {clm.status === 'PENDING_CLAIM_AUDIT' ? (
                                <button onClick={() => { setActiveAuditClaim(clm); setAuditorToken(''); setAuditorFeedback(''); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-full text-[8px] font-black uppercase shadow-lg transition-all active:scale-95">Audit & Approve</button>
                            ) : (
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">Awaiting Settlement</span>
                            )}
                          </td>
                          <td className="px-10 text-right">
                            <span className="text-sm font-black text-slate-200 font-mono">GHS {clm.total?.toFixed(2) || '0.00'}</span>
                          </td>
                        </tr>
                      ))}
                      {withdrawalClaims.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-32 text-center opacity-20">
                            <p className="font-black uppercase text-sm tracking-[1em]">Claims Registry Vacant</p>
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      {/* ENLISTMENT MODAL */}
      {activeApp && editApp && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Enlistment Shard Audit</h3>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{ROLES_META.find(r=>r.id===activeApp.role)?.label} Sector</p>
                 </div>
                 <button onClick={() => setActiveApp(null)} className="text-slate-500 hover:text-white transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
              </div>
              <div className="p-8 space-y-6 text-slate-900 overflow-y-auto max-h-[70vh]">
                 <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200">
                    <div className="space-y-1">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Specialist Node</span>
                       <p className="text-base font-black text-slate-950 uppercase leading-none">{activeApp.name}</p>
                    </div>
                    <div className="space-y-1 text-right">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Application ID</span>
                       <p className="text-[10px] font-mono font-black text-blue-900 leading-none truncate">{activeApp.id}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Venue Designation</label>
                       <input type="text" value={editApp.venue} onChange={e=>setEditApp({...editApp, venue: e.target.value.toUpperCase()})} className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Reward Shard (GHS)</label>
                       <input type="number" value={editApp.expectedPayment} onChange={e=>setEditApp({...editApp, expectedPayment: parseFloat(e.target.value)||0})} className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-emerald-600 outline-none" />
                    </div>
                 </div>

                 <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-blue-600 uppercase tracking-widest ml-2">Assign Verification Token</label>
                       <input 
                         type="text" 
                         value={auditorToken} 
                         onChange={e=>setAuditorToken(e.target.value.toUpperCase())} 
                         className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl px-6 py-4 text-xs font-mono font-black text-blue-900 placeholder:text-blue-300"
                         placeholder="ENTER UNIQUE AUTH TOKEN..."
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Instructional Audit Feedback</label>
                       <textarea 
                         value={auditorFeedback} 
                         onChange={e=>setAuditorFeedback(e.target.value.toUpperCase())} 
                         className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-bold text-slate-600 min-h-[80px] uppercase"
                         placeholder="ENTER FEEDBACK FOR SPECIALIST..."
                       />
                    </div>
                 </div>

                 <div className="flex flex-col gap-3 pt-2">
                    <div className="flex gap-3">
                       <button onClick={() => handleUpdateStatus('APPROVED')} disabled={isProcessing} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">APPROVE & ISSUE</button>
                       <button onClick={() => handleUpdateStatus('CONFIRMED')} disabled={isProcessing} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">CONFIRM COMPLETION</button>
                    </div>
                    <button onClick={() => handleUpdateStatus('REJECTED')} disabled={isProcessing} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">Deny Shard</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* WITHDRAWAL AUDIT MODAL */}
      {activeAuditClaim && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-indigo-900 p-8 text-white flex justify-between items-center">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase">Withdrawal Audit</h3>
                    <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Verify instructional token eligibility</p>
                 </div>
                 <button onClick={() => setActiveAuditClaim(null)} className="text-indigo-400 hover:text-white transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
              </div>
              <div className="p-8 space-y-6 text-slate-900">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                       <span className="text-[8px] font-black text-slate-400 uppercase">Payee Node</span>
                       <span className="text-[10px] font-black text-indigo-900 uppercase">{activeAuditClaim.name}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-[7px] font-black text-slate-400 uppercase">Target Shard</span>
                       <span className="text-sm font-black text-emerald-600 font-mono">GHS {activeAuditClaim.total.toFixed(2)}</span>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-blue-600 uppercase tracking-widest ml-2">Generated Security Token</label>
                       <input 
                         type="text" 
                         value={auditorToken} 
                         onChange={e=>setAuditorToken(e.target.value.toUpperCase())} 
                         className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl px-6 py-4 text-sm font-mono font-black text-blue-900 placeholder:text-blue-300"
                         placeholder="ASSIGN TOKEN..."
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Administrative Feedback Shard</label>
                       <textarea 
                         value={auditorFeedback} 
                         onChange={e=>setAuditorFeedback(e.target.value.toUpperCase())} 
                         className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-bold text-slate-600 min-h-[100px] uppercase"
                         placeholder="ENTER AUDIT FEEDBACK TO FACILITATOR..."
                       />
                    </div>
                 </div>

                 <div className="flex flex-col gap-3">
                    <button onClick={() => handleAuthorizeWithdrawal(activeAuditClaim)} disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all">Authorize Shard for Settlement</button>
                    <button onClick={() => setActiveAuditClaim(null)} className="w-full py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors text-center">Close Audit Gate</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
