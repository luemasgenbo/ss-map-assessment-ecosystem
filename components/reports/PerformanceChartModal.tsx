import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StudentData, GlobalSettings, MockSeriesRecord } from '../../types';

interface PerformanceChartModalProps {
  student: StudentData;
  allStudents: StudentData[];
  processedStudents: { id: number; category: string }[];
  settings: GlobalSettings;
  onClose: () => void;
}

const PerformanceChartModal: React.FC<PerformanceChartModalProps> = ({ student, allStudents, processedStudents, settings, onClose }) => {
  const mockSeriesNames = settings.committedMocks || [];
  const subjectCount = 10;
  
  const studentCategory = processedStudents.find(p => p.id === student.id)?.category || 'Pass';

  const getGradeValue = (agg: number) => {
    if (agg <= 10) return 4; // EXC
    if (agg <= 20) return 3; // HIGH
    if (agg <= 36) return 2; // PASS
    return 1; // REM
  };

  const getGradeLabel = (val: number) => {
    if (val === 4) return 'EXC';
    if (val === 3) return 'HIGH';
    if (val === 2) return 'PASS';
    return 'REM';
  };

  const calculateRate = (record: MockSeriesRecord | undefined) => {
    if (!record || !record.subScores) return 0;
    const total = Object.values(record.subScores).reduce((acc, sub: any) => acc + ((sub.sectionA || 0) + (sub.sectionB || 0)), 0);
    return parseFloat(((total / (subjectCount * 100)) * 100).toFixed(1));
  };

  const chartData = useMemo(() => {
    return mockSeriesNames.map(mockName => {
      const studentRecord = student.seriesHistory?.[mockName];
      
      const allRecords = allStudents.map(s => s.seriesHistory?.[mockName]).filter(Boolean) as MockSeriesRecord[];
      
      // Class Records (Same Category)
      const classStudentIds = processedStudents.filter(p => p.category === studentCategory).map(p => p.id);
      const classRecords = allStudents
        .filter(s => classStudentIds.includes(s.id))
        .map(s => s.seriesHistory?.[mockName])
        .filter(Boolean) as MockSeriesRecord[];

      // Combined Class (All)
      const combinedAvgAgg = allRecords.length > 0 
        ? allRecords.reduce((acc, r) => acc + r.aggregate, 0) / allRecords.length 
        : 0;
      const combinedAvgRate = allRecords.length > 0
        ? allRecords.reduce((acc, r) => acc + calculateRate(r), 0) / allRecords.length
        : 0;
      const combinedAvgGrade = allRecords.length > 0
        ? allRecords.reduce((acc, r) => acc + getGradeValue(r.aggregate), 0) / allRecords.length
        : 0;

      // Class (Category)
      const classAvgAgg = classRecords.length > 0 
        ? classRecords.reduce((acc, r) => acc + r.aggregate, 0) / classRecords.length 
        : 0;
      const classAvgRate = classRecords.length > 0
        ? classRecords.reduce((acc, r) => acc + calculateRate(r), 0) / classRecords.length
        : 0;
      const classAvgGrade = classRecords.length > 0
        ? classRecords.reduce((acc, r) => acc + getGradeValue(r.aggregate), 0) / classRecords.length
        : 0;

      return {
        name: mockName,
        studentAgg: studentRecord?.aggregate || null,
        classAgg: classAvgAgg || null,
        combinedAgg: combinedAvgAgg || null,
        studentRate: studentRecord ? calculateRate(studentRecord) : null,
        classRate: classAvgRate || null,
        combinedRate: combinedAvgRate || null,
        studentGrade: studentRecord ? getGradeValue(studentRecord.aggregate) : null,
        classGrade: classAvgGrade || null,
        combinedGrade: combinedAvgGrade || null,
      };
    });
  }, [student, allStudents, processedStudents, mockSeriesNames, studentCategory]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-950/40 backdrop-blur-md p-4 md:p-8">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        {/* Header */}
        <div className="py-4 px-8 bg-blue-950 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{student.name}</h2>
            <div className="flex items-center gap-4 mt-1.5">
              <p className="text-[9px] font-black text-blue-300 uppercase tracking-[0.3em]">Longitudinal Performance Analytics Shard</p>
              <span className="px-2 py-0.5 bg-blue-900 rounded-full text-[7px] font-black uppercase tracking-widest text-blue-100 border border-blue-800">Class: {studentCategory}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Aggregate Chart */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-base font-black text-blue-950 uppercase tracking-tight">Aggregate Progression</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Lower values indicate higher academic standing</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Student</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Class Avg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Combined Avg</span>
                </div>
              </div>
            </div>
            <div className="h-[260px] w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} dy={10} />
                  <YAxis reversed domain={[6, 54]} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', textTransform: 'uppercase', fontSize: '10px', fontWeight: '900' }}
                  />
                  <Line type="monotone" dataKey="studentAgg" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="classAgg" stroke="#818cf8" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4, fill: '#818cf8' }} />
                  <Line type="monotone" dataKey="combinedAgg" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#cbd5e1' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Rate% Chart */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-base font-black text-blue-950 uppercase tracking-tight">Efficiency Rate (%)</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Percentage of total marks attained across all disciplines</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Student</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-400"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Class Avg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Combined Avg</span>
                </div>
              </div>
            </div>
            <div className="h-[260px] w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', textTransform: 'uppercase', fontSize: '10px', fontWeight: '900' }}
                  />
                  <Area type="monotone" dataKey="studentRate" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRate)" dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                  <Line type="monotone" dataKey="classRate" stroke="#2dd4bf" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4, fill: '#2dd4bf' }} />
                  <Line type="monotone" dataKey="combinedRate" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#cbd5e1' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Grade Chart */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-base font-black text-blue-950 uppercase tracking-tight">Grade Band Shifting</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Categorical performance levels (EXC &gt; HIGH &gt; PASS &gt; REM)</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Student</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-400"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Class Avg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">Combined Avg</span>
                </div>
              </div>
            </div>
            <div className="h-[260px] w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} dy={10} />
                  <YAxis 
                    domain={[1, 4]} 
                    ticks={[1, 2, 3, 4]} 
                    tickFormatter={(val) => getGradeLabel(val)}
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} 
                  />
                  <Tooltip 
                    formatter={(val: number) => [getGradeLabel(Math.round(val)), 'Grade']}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', textTransform: 'uppercase', fontSize: '10px', fontWeight: '900' }}
                  />
                  <Line type="stepAfter" dataKey="studentGrade" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} />
                  <Line type="stepAfter" dataKey="classGrade" stroke="#a78bfa" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4, fill: '#a78bfa' }} />
                  <Line type="stepAfter" dataKey="combinedGrade" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#cbd5e1' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em]">SS-MAP — Longitudinal Analytics Engine v2.5</p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChartModal;
