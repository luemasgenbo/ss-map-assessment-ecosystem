import React, { useState, useEffect, useMemo } from 'react';
import { GlobalSettings, StudentData, StaffAssignment, ForwardingData, PaymentParticulars, StaffApplication } from '../../types';
import { supabase } from '../../supabaseClient';
import ReportBrandingHeader from '../shared/ReportBrandingHeader';

const GH_LANGS = ["TWI (AKUAPEM)", "TWI (ASANTE)", "FANTE", "GA", "EWE", "DANGME", "NZEMA", "KASEM", "GONJA"];
const ROLES = [
  { id: "DEVELOPER", label: "Questions Bank-DEVELOPER" },
  { id: "INVIGILATOR", label: "Invigilation Slots-INVIGILATOR" },
  { id: "EXAMINER", label: "Marking Proceeds-EXAMINER" }
];

interface EnrolmentForwardingPortalProps {
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  students: StudentData[];
  setStudents: React.Dispatch<React.SetStateAction<StudentData[]>>;
  facilitators: Record<string, StaffAssignment>;
  isFacilitator?: boolean;
  activeFacilitator?: { name: string; email: string; nodeId: string } | null;
}

const EnrolmentForwardingPortal: React.FC<EnrolmentForwardingPortalProps> = ({ settings, onSettingChange, students, setStudents, facilitators, isFacilitator, activeFacilitator }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Admin Forwarding State
  const [schoolLanguage, setSchoolLanguage] = useState('TWI (ASANTE)');
  const [paymentType, setPaymentType] = useState<'BULK' | 'INDIVIDUAL'>('BULK');
  const [transactionRef, setTransactionRef] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [feedback, setFeedback] = useState('');

  // Facilitator Enlistment State
  const [targetRole, setTargetRole] = useState('DEVELOPER');
  const [myApplications, setMyApplications] = useState<StaffApplication[]>([]);

  // Fetch Facilitator's existing applications - ensures real-time sync with HQ responses
  const fetchMyApps = async () => {
    if (!isFacilitator || !activeFacilitator?.email) return;
    const normalizedEmail = activeFacilitator.email.toLowerCase();
    const { data } = await supabase
      .from('uba_staff_applications')
      .select('*')
      .eq('email', normalizedEmail);
    
    if (data) setMyApplications(data.map(a => ({
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
  };

  useEffect(() => {
    if (isFacilitator) {
       fetchMyApps();
       // Poller to keep status up to date with HQ actions
       const poller = setInterval(fetchMyApps, 15000);
       return () => clearInterval(poller);
    }
  }, [isFacilitator, activeFacilitator]);

  // UI Filter: Terminal applications (PAID/REJECTED) are archived from the active matrix view
  const activeMatrixApps = useMemo(() => {
    return myApplications.filter(app => app.status !== 'PAID' && app.status !== 'REJECTED');
  }, [myApplications]);

  const handleForwardToHQ = async () => {
    if (!transactionRef || !totalAmount) return alert("Financial Handshake Required: Transaction Ref and Amount are mandatory.");
    if (students.length === 0) return alert("No pupils found in roster to forward.");

    setIsSyncing(true);
    try {
      const hubId = settings.schoolNumber;
      const ts = new Date().toISOString();
      
      const paymentInfo: PaymentParticulars = {
        amount: parseFloat(totalAmount),
        paidBy: settings.schoolName,
        sentBy: settings.registrantName || 'ADMIN',
        transactionId: transactionRef.toUpperCase(),
        date: ts.split('T')[0],
        isBulk: paymentType === 'BULK',
        isVerified: false
      };

      const payload: ForwardingData = {
        schoolId: hubId,
        schoolName: settings.schoolName,
        feedback: feedback,
        pupilLanguages: students.reduce((acc, s) => ({ ...acc, [s.id]: s.ghanaianLanguage || schoolLanguage }), {}),
        pupilSpecialMockPreferences: students.reduce((acc, s) => ({ ...acc, [s.id]: s.specialMockPreference || 'STANDARD' }), {}),
        pupilPracticeFees: students.reduce((acc, s) => ({ ...acc, [s.id]: s.practiceFee || 0 }), {}),
        pupilPracticeTokens: students.reduce((acc, s) => ({ ...acc, [s.id]: s.practiceTokenIds || [] }), {}),
        pupilPayments: students.reduce((acc, s) => ({ ...acc, [s.id]: true }), {}),
        bulkPayment: paymentInfo,
        facilitatorRecommendations: {},
        submissionTimestamp: ts,
        approvalStatus: 'PENDING'
      };

      await supabase.from('uba_school_forwarding').upsert({
        school_id: hubId,
        school_name: settings.schoolName,
        roster_census: students.length,
        bulk_payment_amount: paymentInfo.amount,
        transaction_id: paymentInfo.transactionId,
        approval_status: 'PENDING',
        feedback: feedback,
        submission_timestamp: ts,
        payload: payload
      });

      alert("ENROLMENT DATA DISPATCHED: HQ will audit the financial handshake and roster for serialization.");
      setFeedback(''); setTransactionRef(''); setTotalAmount('');
    } catch (e: any) {
      alert("Dispatch Fault: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApplyForRole = async () => {
    if (!activeFacilitator) return;
    const normalizedEmail = activeFacilitator.email.toLowerCase();

    // HANDSHAKE LOGIC: Re-enlistment is restricted ONLY if a previous application for the same role is still ACTIVE.
    // 'PAID' or 'REJECTED' statuses indicate completion/termination, allowing for a new enlistment shard.
    const activeStates = ['PENDING', 'APPROVED', 'CONFIRMED'];
    if (myApplications.some(a => a.role === targetRole && activeStates.includes(a.status))) {
      return alert(`PROTOCOL ERROR: You already have an ACTIVE enlistment shard for this role in the recruitment matrix. Complete or settle existing work before re-applying.`);
    }

    setIsSyncing(true);
    try {
      const ts = new Date().toISOString();
      // Generate unique ID for each application instance to allow multiple approved shards over time
      const appId = `staff_app_${normalizedEmail}_${targetRole}_${Date.now()}`;
      
      const appPayload = {
        id: appId,
        email: normalizedEmail,
        name: activeFacilitator.name.toUpperCase(),
        hub_id: settings.schoolNumber,
        role: targetRole,
        status: 'PENDING',
        expected_payment: 150.00,
        venue: 'CENTRAL HQ NODE',
        timestamp: ts
      };

      await supabase.from('uba_staff_applications').upsert(appPayload);

      alert(`ENLISTMENT PUSHED: Your application for ${ROLES.find(r=>r.id===targetRole)?.label} is now in the HQ Recruitment Matrix.`);
      await fetchMyApps();
    } catch (e: any) {
      alert("Application Fault: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20 font-sans max-w-6xl mx-auto">
      
      {isFacilitator ? (
        /* FACILITATOR SECTOR: ROLE ENLISTMENT & MATRIX STATUS */
        <div className="space-y-12">
          <section className="bg-indigo-950 text-white p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-48 -mt-48 blur-[100px]"></div>
            <div className="relative space-y-8">
               <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black uppercase tracking-tight leading-none">Specialist Enlistment</h3>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Active Specialist Node: {activeFacilitator?.name}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4">
                     <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
                     <span className="text-[9px] font-black uppercase tracking-widest">Payroll Status: ELIGIBLE</span>
                  </div>
               </div>

               <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Desired Specialist Role</label>
                       <select 
                         value={targetRole} 
                         onChange={e=>setTargetRole(e.target.value)}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-black text-blue-400 outline-none"
                       >
                         {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                       </select>
                    </div>
                    <div className="flex items-end">
                       <button 
                         onClick={handleApplyForRole}
                         disabled={isSyncing}
                         className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-30"
                       >
                         {isSyncing ? "Syncing Shard..." : "Push Enlistment Shard"}
                       </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest text-center italic">
                    * Applications are now cycle-aware. You can re-enlist for new tasks once your previous shard is marked as PAID or REJECTED by HQ.
                  </p>
               </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">Recruitment Matrix Status</h4>
            <div className="grid grid-cols-1 gap-6">
               {activeMatrixApps.length > 0 ? activeMatrixApps.map((app, i) => (
                 <div key={i} className="bg-white border border-gray-100 p-8 rounded-[3rem] shadow-xl flex flex-col gap-6 hover:border-blue-400 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border border-indigo-100">
                                {app.role.charAt(0)}
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-lg font-black text-slate-900 uppercase leading-none">{ROLES.find(r=>r.id===app.role)?.label || app.role}</h4>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shard Registered: {app.applyDate}</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-center">
                            <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-sm ${
                              app.status === 'APPROVED' ? 'bg-emerald-600 text-white' : 
                              app.status === 'CONFIRMED' ? 'bg-blue-600 text-white' : 
                              app.status === 'REJECTED' ? 'bg-red-600 text-white' :
                              app.status === 'PAID' ? 'bg-slate-900 text-white' :
                              'bg-amber-600 text-white animate-pulse'
                            }`}>
                                {app.status === 'CONFIRMED' ? 'WORK CONFIRMED' : app.status === 'APPROVED' ? 'CONTRACT ISSUED' : app.status === 'PAID' ? 'SETTLED' : app.status}
                            </span>
                        </div>
                    </div>

                    {app.status !== 'PENDING' && app.status !== 'REJECTED' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50 rounded-[2.5rem] border border-gray-200 animate-in slide-in-from-top-2">
                            <div className="space-y-1">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Venue Node</span>
                                <p className="text-[10px] font-black text-slate-900 uppercase">{app.venue}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Reward Shard</span>
                                <p className="text-[10px] font-black text-emerald-600 uppercase">GHS {app.expectedPayment?.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Work Cycle</span>
                                <p className="text-[10px] font-black text-blue-900 uppercase">{app.workStartDate || '---'} — {app.workEndDate || '---'}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Handshake State</span>
                                <p className="text-[10px] font-black text-indigo-900 uppercase">{app.status === 'CONFIRMED' ? 'AWAITING DISBURSEMENT' : app.status === 'PAID' ? 'PAYMENT DISPATCHED' : 'ACTIVE CONTRACT'}</p>
                            </div>
                        </div>
                    )}
                 </div>
               )) : (
                 <div className="py-20 text-center border-4 border-dashed border-gray-100 rounded-[4rem] opacity-30">
                    <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-900">No active enlistment shards detected</p>
                 </div>
               )}
            </div>
          </section>
        </div>
      ) : (
        /* ADMIN SECTOR: ENROLMENT FORWARDING */
        <div className="space-y-12">
          <section className="bg-slate-900 border border-slate-800 rounded-[4rem] p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full -mr-48 -mt-48 blur-[100px]"></div>
            <div className="relative space-y-10">
                <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-3xl font-black uppercase tracking-tight text-white leading-none">HQ Enrolment Forwarding</h3>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mt-2">Official Institutional Handshake Protocol</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 px-8 py-4 rounded-[2rem] text-center">
                      <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Roster Census</span>
                      <p className="text-3xl font-black text-white font-mono tracking-tighter">{students.length} Pupils</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="bg-slate-950/50 p-8 rounded-[3rem] border border-slate-800 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Language Mapping Shard</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Default School-Wide Dialect</label>
                            <select 
                              value={schoolLanguage} 
                              onChange={e=>setSchoolLanguage(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-blue-400 outline-none"
                            >
                              {GH_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed italic">
                            * Pupils with specific settings in the matrix below will override this choice.
                        </p>
                      </div>
                  </div>

                  <div className="bg-slate-950/50 p-8 rounded-[3rem] border border-slate-800 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Financial Handshake Shard</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 col-span-2">
                            <label className="text-[8px] font-black text-slate-500 uppercase ml-2">MoMo Transaction Reference</label>
                            <input type="text" value={transactionRef} onChange={e=>setTransactionRef(e.target.value.toUpperCase())} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="TX-REF-XXXXX" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Total Amount (GHS)</label>
                            <input type="number" value={totalAmount} onChange={e=>setTotalAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none" placeholder="0.00" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Handshake Type</label>
                            <select value={paymentType} onChange={e=>setPaymentType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-blue-400 outline-none">
                              <option value="BULK">BULK (SCHOOL PAY)</option>
                              <option value="INDIVIDUAL">INDIVIDUAL (PUPIL PAY)</option>
                            </select>
                        </div>
                      </div>
                      {paymentType === 'INDIVIDUAL' && (
                        <div className="pt-4 border-t border-slate-800">
                          <button 
                            onClick={() => {
                              const total = students.reduce((sum, s) => sum + (s.practiceFee || 0), 0);
                              setTotalAmount(total.toString());
                            }}
                            className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors"
                          >
                            Calculate Total from Pupil Matrix
                          </button>
                        </div>
                      )}
                  </div>
                </div>

                {/* PUPIL PREFERENCE MATRIX */}
                <div className="bg-slate-950/50 rounded-[3rem] border border-slate-800 overflow-hidden">
                  <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Pupil Preference & Practice Matrix</h4>
                    </div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      {students.length} Pupils in Roster
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50">
                          <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Pupil Name</th>
                          <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">GH Language</th>
                          <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Special Mock Pref</th>
                          <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Practice Fee (GHS)</th>
                          <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Token IDs (Comma Sep)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {students.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-[10px] font-black text-white uppercase">{student.name}</p>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={student.ghanaianLanguage || schoolLanguage}
                                onChange={(e) => {
                                  const updated = students.map(s => s.id === student.id ? { ...s, ghanaianLanguage: e.target.value } : s);
                                  setStudents(updated);
                                }}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold text-blue-400 outline-none w-full"
                              >
                                {GH_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="text"
                                value={student.specialMockPreference || ''}
                                onChange={(e) => {
                                  const updated = students.map(s => s.id === student.id ? { ...s, specialMockPreference: e.target.value.toUpperCase() } : s);
                                  setStudents(updated);
                                }}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none w-full"
                                placeholder="E.G. CORE ONLY"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="number"
                                value={student.practiceFee || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = students.map(s => s.id === student.id ? { ...s, practiceFee: val } : s);
                                  setStudents(updated);
                                }}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none w-full"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="text"
                                value={student.practiceTokenIds?.join(', ') || ''}
                                onChange={(e) => {
                                  const tokens = e.target.value.split(',').map(t => t.trim()).filter(t => t !== '');
                                  const updated = students.map(s => s.id === student.id ? { ...s, practiceTokenIds: tokens } : s);
                                  setStudents(updated);
                                }}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none w-full"
                                placeholder="TKN-1, TKN-2"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[8px] font-black text-slate-500 uppercase ml-4">Administrative Feedback Shard (Optional)</label>
                  <textarea 
                      value={feedback} 
                      onChange={e=>setFeedback(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-[2.5rem] p-8 text-xs font-bold text-white outline-none min-h-[120px] focus:ring-8 focus:ring-blue-500/5 transition-all uppercase"
                      placeholder="PROVIDE ADDITIONAL CONTEXT TO HQ..."
                  />
                </div>

                <button 
                  onClick={handleForwardToHQ}
                  disabled={isSyncing}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-8 rounded-[3rem] font-black text-sm uppercase tracking-[0.5em] shadow-2xl transition-all active:scale-95 disabled:opacity-30"
                >
                  {isSyncing ? "Establishing Handshake..." : "Execute Forwarding Shard"}
                </button>
            </div>
          </section>

          <div className="max-w-4xl mx-auto bg-blue-50 border border-blue-100 p-8 rounded-[3rem] flex items-start gap-6 shadow-inner">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0 border border-blue-100 font-black italic">!</div>
            <div className="space-y-2">
                <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest">Serialization Notice</h4>
                <p className="text-[10px] text-blue-700 font-bold leading-relaxed uppercase tracking-widest">
                  Forwarding initiates the Serialization Protocol. Pupil Index Numbers and Private PINs will be mirrored to your registry upon HQ financial verification.
                </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrolmentForwardingPortal;