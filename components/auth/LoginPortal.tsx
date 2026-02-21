import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

interface LoginPortalProps {
  onLoginSuccess: (hubId: string, user: { name: string, nodeId: string, role: string, email: string, subject?: string }) => void;
  onSuperAdminLogin: () => void;
  onSwitchToRegister: () => void;
}

type UserRole = 'admin' | 'facilitator' | 'pupil' | 'superadmin' | null;

const LoginPortal: React.FC<LoginPortalProps> = ({ onLoginSuccess, onSuperAdminLogin, onSwitchToRegister }) => {
  const [activeGate, setActiveGate] = useState<UserRole>(null);
  const [identityInput, setIdentityInput] = useState(''); // Full Name, Email, or Node ID
  const [pinInput, setPinInput] = useState('');           // PIN or Master Key
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGateSelect = (role: UserRole) => {
    setActiveGate(role);
    setError(null);
  };

  const handleSyncIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const inputIdentity = identityInput.trim().toUpperCase();
    const inputPin = pinInput.trim().toUpperCase();

    if (!inputIdentity || !inputPin) {
      setError("Provide both Identity Shard and Access PIN.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. HARDCODED MASTER HQ BYPASS (Case Insensitive Handshake)
      const isHqIdentity = ["HQ CONTROLLER", "HQ-MASTER-NODE", "HQ@UNITEDBAYLOR.EDU.GH"].includes(inputIdentity);
      if (isHqIdentity && inputPin === "UBA-HQ-MASTER-2025") {
        onSuperAdminLogin();
        return;
      }

      let hubId = '';
      let userData: any = null;

      // 2. PUPIL GATE LOGIC (Search by Index or Name)
      if (activeGate === 'pupil') {
        const { data: pupil, error: pError } = await supabase
          .from('uba_pupils')
          .select('*')
          .or(`name.ilike."${inputIdentity}",student_id.ilike."${inputIdentity}"`)
          .ilike('unique_code', inputPin)
          .maybeSingle();

        if (pError) throw new Error("Pupil Registry unreachable: " + pError.message);
        
        if (!pupil) {
          // Fallback to identities table
          const { data: identity } = await supabase
            .from('uba_identities')
            .select('*')
            .or(`full_name.ilike."${inputIdentity}",node_id.ilike."${inputIdentity}",email.ilike."${inputIdentity}"`)
            .eq('role', 'pupil')
            .ilike('unique_code', inputPin)
            .maybeSingle();
          
          if (identity) {
            hubId = identity.hub_id;
            userData = {
              name: identity.full_name,
              nodeId: identity.node_id,
              role: 'pupil',
              email: identity.email
            };
          } else {
            throw new Error("Handshake Refused: Identity or PIN mismatch in Pupil Registry.");
          }
        } else {
          hubId = pupil.hub_id;
          userData = {
            name: pupil.name,
            nodeId: pupil.student_id,
            role: 'pupil',
            email: `${pupil.student_id.toLowerCase()}@uba.internal`
          };
        }
      } 
      // 3. ADMINISTRATIVE GATES (Admin & Facilitator)
      else {
        const { data: identity, error: idError } = await supabase
          .from('uba_identities')
          .select('*')
          .or(`full_name.ilike."${inputIdentity}",node_id.ilike."${inputIdentity}",email.ilike."${inputIdentity}"`)
          .ilike('unique_code', inputPin)
          .maybeSingle();

        if (idError) throw idError;
        if (!identity) throw new Error("Handshake Refused: Check identity particulars and PIN. Ensure you have selected the correct gate.");

        const roleMap: Record<string, string> = { 
          'school_admin': 'admin', 
          'facilitator': 'facilitator', 
          'super_admin': 'superadmin',
          'pupil': 'pupil'
        };
        
        if (roleMap[identity.role] !== activeGate) {
          throw new Error(`Gate Refusal: This identity belongs to the ${identity.role.replace('_', ' ')} sector.`);
        }

        hubId = identity.hub_id;
        userData = {
          name: identity.full_name,
          nodeId: identity.node_id,
          role: identity.role,
          email: identity.email
        };

        if (identity.role === 'facilitator') {
          const { data: facRecord } = await supabase
            .from('uba_facilitators')
            .select('taught_subject')
            .eq('email', identity.email)
            .maybeSingle();
          if (facRecord) userData.subject = facRecord.taught_subject;
        }
      }

      onLoginSuccess(hubId, userData);

    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  if (!activeGate) {
    return (
      <div className="w-full max-w-5xl p-4 animate-in fade-in duration-500">
        <div className="text-center mb-16">
           <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">SS-MAP</h2>
           <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mt-3 leading-none">Unified Assessment Network — Secure Identity Recall</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
             { id: 'admin', label: 'Institutional Admin', color: 'from-blue-600 to-blue-900', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
             { id: 'facilitator', label: 'Faculty Shard', color: 'from-indigo-600 to-indigo-900', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
             { id: 'pupil', label: 'Pupil Portal', color: 'from-emerald-600 to-emerald-900', icon: 'M22 10v6M2 10l10-5 10 5-10 5z' },
             { id: 'superadmin', label: 'HQ Master Console', color: 'from-slate-700 to-slate-950', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' }
           ].map(gate => (
             <button key={gate.id} onClick={() => handleGateSelect(gate.id as UserRole)} className="group bg-slate-950 border border-white/10 p-10 rounded-[3rem] text-center hover:border-white/30 transition-all hover:-translate-y-2 shadow-2xl">
                <div className={`w-16 h-16 bg-gradient-to-br ${gate.color} text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 transition-transform`}>
                   <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={gate.icon}/></svg>
                </div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none">{gate.label}</h3>
             </button>
           ))}
        </div>

        <div className="mt-16 text-center space-y-6">
          <button onClick={onSwitchToRegister} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Onboard New Institution</button>
          <div className="pt-8 border-t border-white/5 opacity-40 text-center">
            <p className="text-[7px] text-slate-600 uppercase tracking-[0.4em] mb-4 leading-none">Global Network Registry — Authorized Access Only</p>
          </div>
        </div>
      </div>
    );
  }

  const gateColorMap = {
    pupil: 'bg-emerald-600',
    facilitator: 'bg-indigo-600',
    superadmin: 'bg-slate-800',
    admin: 'bg-blue-600'
  };

  const gateTextColorMap = {
    pupil: 'text-emerald-400',
    facilitator: 'text-indigo-400',
    superadmin: 'text-slate-400',
    admin: 'text-blue-400'
  };

  const gateFocusColorMap = {
    pupil: 'focus:ring-emerald-500/10',
    facilitator: 'focus:ring-indigo-500/10',
    superadmin: 'focus:ring-slate-500/10',
    admin: 'focus:ring-blue-500/10'
  };

  return (
    <div className="w-full max-w-xl p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-950 p-10 md:p-14 rounded-[4rem] shadow-2xl border border-white/10 relative overflow-hidden">
        <button onClick={() => setActiveGate(null)} className="absolute top-10 left-10 text-slate-500 hover:text-white transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        
        <div className="text-center relative mb-12">
          <div className={`w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center text-white shadow-2xl border border-white/20 uppercase font-black text-xs ${gateColorMap[activeGate!]}`}>
            {activeGate?.substring(0, 3)}
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">IDENTITY RECALL</h2>
          <p className={`text-[9px] font-black ${gateTextColorMap[activeGate!]} uppercase tracking-[0.4em] mt-3 leading-none`}>Authorized Sector Handshake Protocol</p>
        </div>

        <form onSubmit={handleSyncIdentity} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Full Name, Email or Node ID</label>
            <input 
              type="text" 
              value={identityInput} 
              onChange={(e) => setIdentityInput(e.target.value)} 
              className={`w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:ring-4 ${gateFocusColorMap[activeGate!]} transition-all uppercase`} 
              placeholder="ENTER IDENTITY" 
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Access PIN</label>
            <input 
              type="password" 
              value={pinInput} 
              onChange={(e) => setPinInput(e.target.value)} 
              className={`w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-sm font-mono font-bold text-white outline-none focus:ring-4 ${gateFocusColorMap[activeGate!]} transition-all uppercase`} 
              placeholder="ENTER PIN" 
              required 
            />
          </div>
          
          {error && <div className="bg-red-500/10 text-red-500 p-5 rounded-2xl text-[9px] font-black uppercase text-center border border-red-500/20">{error}</div>}
          
          <button type="submit" disabled={isLoading} className={`w-full ${gateColorMap[activeGate!]} hover:opacity-90 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all`}>
            {isLoading ? "SYNCING SHARDS..." : "ACTIVATE HUB SESSION"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPortal;