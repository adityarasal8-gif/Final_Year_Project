/**
 * TherapistDashboard.jsx
 * Tabbed therapist dashboard with patient analytics, history, and recovery charts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import PhysioLogo from './PhysioLogo';
import {
  getTherapistPatients,
  getPatientSessionHistory,
  calculateComplianceScore,
  getUserProfile,
  createTherapistProfile
} from '../utils/firestore';
import { auth } from '../firebase';

const UsersIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const TabButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
      active ? 'bg-teal-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:bg-teal-50'
    }`}
  >
    {label}
  </button>
);

const StatCard = ({ title, value, tone = 'teal' }) => {
  const toneClass = {
    teal: 'from-teal-500 to-cyan-600',
    indigo: 'from-indigo-500 to-indigo-600',
    green: 'from-green-500 to-emerald-600',
    amber: 'from-amber-500 to-orange-500'
  };

  return (
    <div className={`bg-gradient-to-br ${toneClass[tone]} rounded-2xl p-5 text-white shadow`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
};

const NoPatientsHint = () => (
  <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
    No linked patients yet. Share your therapist code in Settings to start receiving chart data.
  </p>
);

const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  let date;
  if (timestamp?.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp?.seconds === 'number') {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSessionData = (sessions) => {
  return sessions.map((session) => ({
    id: session.id,
    date: formatDate(session.createdAt),
    exerciseName: session.exerciseName || 'Exercise',
    exerciseId: session.exerciseId || 'unknown',
    maxAngle: Math.round(session.maxAngle || 0),
    reps: session.reps ?? session.totalReps ?? 0,
    postureAccuracy: Math.round(session.postureAccuracy || 0),
    improvement: Math.round(session.improvement ?? ((session.maxAngle || 0) - (session.baselineROM || 0))),
    createdAt: session.createdAt
  }));
};

const generateDemoData = () => {
  const demoPatients = [
    { id: 'demo-patient-1', name: 'John Smith', email: 'john.smith@demo.com' },
    { id: 'demo-patient-2', name: 'Sarah Johnson', email: 'sarah.j@demo.com' },
    { id: 'demo-patient-3', name: 'Mike Chen', email: 'mike.c@demo.com' }
  ];

  const sessions = [];
  const exercises = ['Knee Flexion', 'Knee Extension', 'Bodyweight Squats'];
  const today = new Date();
  for (let i = 20; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    sessions.push({
      id: `demo-session-${i}`,
      userId: i % 2 === 0 ? 'demo-patient-1' : 'demo-patient-2',
      createdAt: date,
      exerciseName: exercises[i % exercises.length],
      maxAngle: 70 + (20 - i) * 2 + Math.round(Math.random() * 8),
      reps: 20 + Math.round(Math.random() * 18),
      postureAccuracy: 72 + Math.round(Math.random() * 20),
      improvement: 4 + Math.round(Math.random() * 10)
    });
  }

  return { demoPatients, sessions };
};

const TherapistDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(0);
  const [complianceData, setComplianceData] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [therapistCode, setTherapistCode] = useState(user?.therapistCode || '');
  const [loadingCode, setLoadingCode] = useState(true);
  const [copied, setCopied] = useState(false);
  const noLinkedPatients = patients.length === 0;

  const handleCopyCode = () => {
    if (!therapistCode) return;
    navigator.clipboard.writeText(therapistCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const loadCode = async () => {
      setLoadingCode(true);

      if (user?.isDemo) {
        setTherapistCode('DEMO123');
        setLoadingCode(false);
        return;
      }

      if (!auth?.currentUser) {
        setLoadingCode(false);
        return;
      }

      try {
        const result = await getUserProfile(auth.currentUser.uid);
        if (result.success && result.data.therapistCode) {
          setTherapistCode(result.data.therapistCode);
        } else if (result.success && !result.data.therapistCode) {
          const codeResult = await createTherapistProfile(auth.currentUser.uid, {
            name: user?.displayName || user?.name || user?.email,
            email: user?.email,
            role: 'therapist'
          });
          if (codeResult.success) {
            setTherapistCode(codeResult.code);
          }
        }
      } catch (error) {
        console.error('Error loading therapist profile:', error);
      } finally {
        setLoadingCode(false);
      }
    };

    loadCode();
  }, [user]);

  useEffect(() => {
    const loadPatients = async () => {
      setLoading(true);

      if (user?.isDemo) {
        const { demoPatients } = generateDemoData();
        setPatients(demoPatients);
        setSelectedPatient(demoPatients[0] || null);
        setLoading(false);
        return;
      }

      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      const result = await getTherapistPatients(auth.currentUser.uid);
      if (result.success) {
        setPatients(result.data);
        setSelectedPatient(result.data[0] || null);
      }

      setLoading(false);
    };

    loadPatients();
  }, [user]);

  useEffect(() => {
    if (!selectedPatient) return;

    const loadPatientData = async () => {
      if (user?.isDemo) {
        const { sessions } = generateDemoData();
        const filtered = sessions.filter((s) => s.userId === selectedPatient.id);
        setSessionHistory(formatSessionData(filtered));
        setComplianceData({ completedSessions: 4, assignedSessions: 5, complianceScore: 80 });
        return;
      }

      const historyResult = await getPatientSessionHistory(selectedPatient.id, timeRange);
      if (historyResult.success) {
        setSessionHistory(formatSessionData(historyResult.data));
      } else {
        setSessionHistory([]);
      }

      const complianceResult = await calculateComplianceScore(selectedPatient.id, 5);
      if (complianceResult.success) {
        setComplianceData(complianceResult.data);
      } else {
        setComplianceData(null);
      }
    };

    loadPatientData();
  }, [selectedPatient, timeRange, user]);

  const stats = useMemo(() => {
    if (!sessionHistory.length) {
      return { avgROM: 0, maxROM: 0, totalSessions: 0, avgReps: 0, avgPosture: 0, improvement: 0 };
    }

    const angles = sessionHistory.map((s) => s.maxAngle);
    const reps = sessionHistory.map((s) => s.reps);
    const posture = sessionHistory.map((s) => s.postureAccuracy || 0);

    const avgROM = Math.round(angles.reduce((a, b) => a + b, 0) / angles.length);
    const maxROM = Math.max(...angles);
    const avgReps = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);
    const avgPosture = Math.round(posture.reduce((a, b) => a + b, 0) / posture.length);

    const firstROM = angles[0] || 0;
    const latestROM = angles[angles.length - 1] || 0;
    const improvement = firstROM > 0 ? Math.round(((latestROM - firstROM) / firstROM) * 100) : 0;

    return { avgROM, maxROM, totalSessions: sessionHistory.length, avgReps, avgPosture, improvement };
  }, [sessionHistory]);

  const exerciseBreakdown = useMemo(() => {
    const grouped = {};
    sessionHistory.forEach((s) => {
      if (!grouped[s.exerciseName]) {
        grouped[s.exerciseName] = { name: s.exerciseName, sessions: 0, avgAngle: 0, avgPosture: 0, totalAngle: 0, totalPosture: 0 };
      }
      grouped[s.exerciseName].sessions += 1;
      grouped[s.exerciseName].totalAngle += s.maxAngle;
      grouped[s.exerciseName].totalPosture += s.postureAccuracy || 0;
    });

    return Object.values(grouped).map((g) => ({
      name: g.name,
      sessions: g.sessions,
      avgAngle: Math.round(g.totalAngle / Math.max(1, g.sessions)),
      avgPosture: Math.round(g.totalPosture / Math.max(1, g.sessions))
    }));
  }, [sessionHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-medical-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-medical-primary/30 border-t-medical-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-medical-background">
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-medical-text-primary">Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">?</button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-medical-text-secondary mb-1">Signed in as</p>
              <p className="font-semibold text-medical-text-primary">{user?.name || user?.email}</p>
              <p className="text-xs text-medical-text-secondary mt-0.5">Therapist account</p>
            </div>

            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-xs text-medical-text-secondary mb-2">Your Therapist Code</p>
              {loadingCode ? (
                <div className="text-sm text-gray-400">Generating...</div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-bold font-mono tracking-widest text-indigo-700">{therapistCode || '-'}</span>
                  {therapistCode && (
                    <button onClick={handleCopyCode} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors">
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-medical-text-secondary mt-2">Share this code with patients so they can connect with you.</p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={() => { setShowSettingsModal(false); onLogout?.(); }}
                className="w-full py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg p-2">
            <PhysioLogo className="w-6 h-6" color="white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-medical-text-primary">Physio - Therapist</h1>
            <p className="text-xs text-medical-text-secondary">
              {user?.isDemo && 'Demo Mode - '}
              {user?.name || user?.email || 'Therapist'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowSettingsModal(true)} aria-label="Settings" className="p-2 rounded-xl hover:bg-gray-100 text-medical-text-secondary hover:text-medical-primary transition-colors">
          <SettingsIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton active={activeTab === 'dashboard'} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
          <TabButton active={activeTab === 'patients'} label="Patients" onClick={() => setActiveTab('patients')} />
          <TabButton active={activeTab === 'history'} label="Session History" onClick={() => setActiveTab('history')} />
          <TabButton active={activeTab === 'recovery'} label="Recovery" onClick={() => setActiveTab('recovery')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <UsersIcon className="w-5 h-5 text-teal-600" />
                <h3 className="text-lg font-bold text-gray-900">Patients</h3>
              </div>

              {patients.length ? (
                <div className="space-y-2">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selectedPatient?.id === patient.id
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">{patient.name || 'Patient'}</div>
                      <div className={`text-xs ${selectedPatient?.id === patient.id ? 'text-white/80' : 'text-gray-500'}`}>{patient.email}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400">No connected patients yet.</div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Time Range</h3>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="relative z-10 w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value={0}>All time</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {activeTab === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard title="Avg ROM" value={`${stats.avgROM} deg`} tone="teal" />
                  <StatCard title="Max ROM" value={`${stats.maxROM} deg`} tone="green" />
                  <StatCard title="Sessions" value={stats.totalSessions} tone="indigo" />
                  <StatCard title="Avg Reps" value={stats.avgReps} tone="amber" />
                  <StatCard title="Posture" value={`${stats.avgPosture}%`} tone="teal" />
                </div>

                {complianceData && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Compliance</h3>
                    <div className="text-sm text-gray-600">
                      Completed <span className="font-semibold text-gray-900">{complianceData.completedSessions}</span> of <span className="font-semibold text-gray-900">{complianceData.assignedSessions}</span> assigned sessions this week.
                    </div>
                    <div className="mt-3 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${Math.min(100, complianceData.complianceScore)}%` }} />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-teal-700">{complianceData.complianceScore}% compliance</div>
                  </div>
                )}

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">ROM Progress</h3>
                  {sessionHistory.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={sessionHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="maxAngle" stroke="#0D9488" fill="#99F6E4" fillOpacity={0.35} name="Max ROM" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-sm text-gray-400">No session data available.</div>
                  )}
                  {noLinkedPatients && <NoPatientsHint />}
                </div>
              </>
            )}

            {activeTab === 'patients' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Patient Overview</h3>
                {selectedPatient ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-900"><span className="font-semibold text-gray-700">Name:</span> {selectedPatient.name || 'Patient'}</div>
                    <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-900"><span className="font-semibold text-gray-700">Email:</span> {selectedPatient.email || '-'}</div>
                    <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-900"><span className="font-semibold text-gray-700">Sessions in range:</span> {stats.totalSessions}</div>
                    <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-900"><span className="font-semibold text-gray-700">Current progress:</span> {stats.improvement}%</div>
                    <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-900"><span className="font-semibold text-gray-700">Average posture:</span> {stats.avgPosture}%</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Select a patient from the left panel.</div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Session History</h3>
                {sessionHistory.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-800">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-3">Date</th>
                          <th className="py-3">Exercise</th>
                          <th className="py-3">Max ROM</th>
                          <th className="py-3">Reps</th>
                          <th className="py-3">Posture</th>
                          <th className="py-3">Improvement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionHistory.slice().reverse().map((session) => (
                          <tr key={session.id} className="border-b border-gray-100 text-gray-800">
                            <td className="py-3 text-gray-800">{session.date}</td>
                            <td className="py-3 text-gray-800">{session.exerciseName}</td>
                            <td className="py-3 text-gray-800">{session.maxAngle} deg</td>
                            <td className="py-3 text-gray-800">{session.reps}</td>
                            <td className="py-3 text-gray-800">{session.postureAccuracy}%</td>
                            <td className="py-3 text-gray-800">{session.improvement} deg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No sessions yet.</div>
                )}
              </div>
            )}

            {activeTab === 'recovery' && (
              <>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Reps and Posture Trend</h3>
                  {sessionHistory.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={sessionHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="reps" stroke="#4F46E5" strokeWidth={2.5} name="Reps" />
                        <Line type="monotone" dataKey="postureAccuracy" stroke="#0D9488" strokeWidth={2.5} name="Posture %" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-sm text-gray-400">No sessions yet.</div>
                  )}
                  {noLinkedPatients && <NoPatientsHint />}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Exercise Breakdown</h3>
                  {exerciseBreakdown.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={exerciseBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="avgAngle" fill="#0D9488" name="Avg ROM" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="avgPosture" fill="#2563EB" name="Avg Posture %" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-sm text-gray-400">No exercise breakdown available.</div>
                  )}
                  {noLinkedPatients && <NoPatientsHint />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistDashboard;
