import React from 'react';
import { GlobalSettings } from '../../types';
import EditableField from './EditableField';

interface ReportBrandingHeaderProps {
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: any) => void;
  reportTitle: string;
  subtitle?: string;
  isLandscape?: boolean;
  readOnly?: boolean;
  hideMetadataStrip?: boolean;
  hideConnectivity?: boolean;
}

const ReportBrandingHeader: React.FC<ReportBrandingHeaderProps> = ({ 
  settings, 
  onSettingChange, 
  reportTitle, 
  subtitle, 
  isLandscape = false, 
  readOnly = false,
  hideMetadataStrip = false,
  hideConnectivity = false
}) => {
  return (
    <div className="text-center relative border-b-[6px] border-double border-blue-950 pb-4 mb-4 w-full font-sans animate-in fade-in duration-1000">
      
      {/* Micro-Metadata Identity Strip: 6px Precision Shards */}
      {!hideMetadataStrip && (
        <div className="w-full text-[6px] leading-none tracking-tighter text-slate-900 uppercase text-center mb-4 space-x-2 flex flex-wrap justify-center font-black">
          <span>D</span>
          <span className="text-blue-600">|</span>
          <span>DSA</span>
          <span className="text-blue-600">|</span>
          <span><EditableField value={settings.schoolMotto || "EXCELLENCE IN KNOWLEDGE AND CHARACTER"} onChange={(v) => onSettingChange('schoolMotto', v.toUpperCase())} disabled={readOnly} /></span>
          <span className="text-blue-600">|</span>
          <span>AGFHUB NODE: <EditableField value={settings.schoolNumber || "SMA-2025-4759"} onChange={(v) => onSettingChange('schoolNumber', v.toUpperCase())} disabled={readOnly} /></span>
          <span className="text-blue-600">|</span>
          <span>OFFICIAL MOCK ASSESSMENT SERIES</span>
          <span className="text-blue-600">|</span>
          <span>OFFICIAL ACADEMIC ATTAINMENT RECORD</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        {/* Academy Seal */}
        <div className="w-24 h-24 flex items-center justify-center shrink-0">
          {settings.schoolLogo ? (
            <img src={settings.schoolLogo} alt="Academy Seal" className="max-w-full max-h-full object-contain shadow-2xl rounded-3xl" />
          ) : (
            <div className="w-20 h-20 bg-blue-900 text-white rounded-[1.8rem] flex items-center justify-center font-black text-4xl shadow-2xl border-[3px] border-white">
              {settings.schoolName?.substring(0,1) || "U"}
            </div>
          )}
        </div>

        {/* Identity Particulars - ALL EDITABLE */}
        <div className="flex-1">
          <h1 className={`${isLandscape ? 'text-4xl' : 'text-3xl'} font-black text-blue-950 tracking-tighter uppercase leading-[5px]`}>
            <EditableField 
                value={settings.schoolName || "UNITED BAYLOR ACADEMY"} 
                onChange={(v) => onSettingChange('schoolName', v.toUpperCase())} 
                className="text-center w-full font-black" 
                disabled={readOnly}
                placeholder="ACADEMY NAME"
            />
          </h1>
          <div className="text-[16px] font-black text-blue-800 uppercase tracking-[0.4em] italic leading-[5px] pt-1">
            <EditableField 
                value={settings.schoolMotto || "EXCELLENCE IN KNOWLEDGE AND CHARACTER"} 
                onChange={(v) => onSettingChange('schoolMotto', v.toUpperCase())} 
                className="text-center w-full" 
                disabled={readOnly}
                placeholder="ACADEMY MOTTO"
            />
          </div>
          <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] pt-1 leading-[5px]">
            <EditableField 
                value={settings.schoolAddress || "ACCRA DIGITAL CENTRE, GHANA"} 
                onChange={(v) => onSettingChange('schoolAddress', v.toUpperCase())} 
                className="text-center w-full" 
                disabled={readOnly}
                placeholder="ACADEMY ADDRESS"
            />
          </div>
        </div>
      </div>

      {/* Official Report Identification */}
      <div className="mt-4 mb-3">
         <h2 className="text-xl font-black text-red-700 uppercase tracking-[0.4em] bg-red-50 py-3 border-y-2 border-red-200">
           <EditableField 
            value={reportTitle} 
            onChange={(v) => onSettingChange('examTitle', v.toUpperCase())} 
            className="text-center w-full" 
            disabled={readOnly}
            placeholder="REPORT TITLE"
           />
         </h2>
         {subtitle && <p className="text-[10px] font-black text-blue-900 uppercase tracking-[0.5em] mt-1 leading-[5px]">{subtitle}</p>}
      </div>

      {/* Connectivity Cluster - Particulars Focus */}
      {!hideConnectivity && (
        <div className="flex justify-center flex-wrap gap-x-10 gap-y-0 pt-3 border-t border-slate-100 no-print">
          <div className="flex gap-1 items-center px-1">
            <span className="text-slate-400 text-[6px] leading-none uppercase font-black">TEL:</span>
            <EditableField 
              value={settings.schoolContact} 
              onChange={(v) => onSettingChange('schoolContact', v)} 
              className="font-black text-[10px] tracking-widest" 
              disabled={readOnly}
              placeholder="+233..."
            />
          </div>
          <div className="flex gap-1 items-center px-1">
            <span className="text-slate-400 text-[6px] leading-none uppercase font-black">MAIL:</span>
            <EditableField 
              value={settings.schoolEmail} 
              onChange={(v) => onSettingChange('schoolEmail', v.toLowerCase())} 
              className="font-black text-[10px] tracking-widest" 
              disabled={readOnly}
              placeholder="MAIL@ACADEMY.EDU"
            />
          </div>
          <div className="flex gap-1 items-center px-1">
            <span className="text-slate-400 text-[6px] leading-none uppercase font-black">WEB:</span>
            <EditableField 
              value={settings.schoolWebsite || "WWW.UNITEDBAYLOR.EDU"} 
              onChange={(v) => onSettingChange('schoolWebsite', v.toLowerCase())} 
              className="font-black text-[10px] tracking-widest" 
              disabled={readOnly}
              placeholder="WWW.ACADEMY.EDU"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportBrandingHeader;
