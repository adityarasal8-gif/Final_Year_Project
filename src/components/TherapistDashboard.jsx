/**
 * TherapistDashboard.jsx (Medical Design System)
 * Modern analytics dashboard for therapists with medical UI
 * Features: Patient list, ROM charts, compliance tracking, session history
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
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

// Simple SVG Icons
const UsersIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const TrendingUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const ActivityIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const CalendarIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const AwardIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="7"/>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TargetIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const BarChartIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const CopyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

/**
 * Generate demo data for demo mode
 */
const generateDemoData = () => {
  const demoPatients = [
    { id: 'demo-patient-1', name: 'John Smith', email: 'john.smith@demo.com', baseline: 85 },
    { id: 'demo-patient-2', name: 'Sarah Johnson', email: 'sarah.j@demo.com', baseline: 90 },
    { id: 'demo-patient-3', name: 'Mike Chen', email: 'mike.c@demo.com', baseline: 78 }
  ];

  const demoSessions = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    demoSessions.push({
      id: `session-${i}`,
      userId: 'demo-patient-1',
      createdAt: date,
      maxAngle: 85 + Math.random() * 25 + (29 - i) * 0.5,
      reps: Math.floor(10 + Math.random() * 10),
      painLevel: Math.floor(Math.random() * 3),
      improvement: Math.floor((29 - i) * 2)
    });
  }

  return { patients: demoPatients, sessions: demoSessions };
};

/**
 * TherapistDashboard Component
 */
const TherapistDashboard = ({ user, onLogout }) => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [complianceData, setComplianceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);  const [copied, setCopied] = useState(false);
  const [therapistCode, setTherapistCode] = useState(user?.therapistCode || '');
  const [loadingCode, setLoadingCode] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(therapistCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch therapist profile to get therapist code
  useEffect(() => {
    const loadTherapistProfile = async () => {
      setLoadingCode(true);
      
      if (user?.isDemo) {
        // Generate a demo code
        setTherapistCode('DEMO123');
        setLoadingCode(false);
        return;
      }

      if (!auth?.currentUser) {
        setLoadingCode(false);
        return;
      }

      try {
        // Fetch therapist profile from Firestore
        const result = await getUserProfile(auth.currentUser.uid);
        
        if (result.success && result.data.therapistCode) {
          // Code exists, use it
          setTherapistCode(result.data.therapistCode);
        } else if (result.success && !result.data.therapistCode) {
          // Profile exists but no code - generate one
          console.log('No therapist code found, generating one...');
          const codeResult = await createTherapistProfile(auth.currentUser.uid, {
            name: user?.displayName || user?.name || user?.email,
            email: user?.email,
            role: 'therapist'
          });
          
          if (codeResult.success) {
            setTherapistCode(codeResult.code);
            console.log('✅ Therapist code generated:', codeResult.code);
          }
        }
      } catch (error) {
        console.error('Error loading therapist profile:', error);
      } finally {
        setLoadingCode(false);
      }
    };

    loadTherapistProfile();
  }, [user]);

  useEffect(() => {
    const loadPatients = async () => {
      setLoading(true);

      if (user?.isDemo) {
        const { patients: demoPatients } = generateDemoData();
        setPatients(demoPatients);
        if (demoPatients.length > 0) {
          setSelectedPatient(demoPatients[0]);
        }
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
        if (result.data.length > 0) {
          setSelectedPatient(result.data[0]);
        }
      }
      setLoading(false);
    };

    loadPatients();
  }, [user]);

  useEffect(() => {
    if (!selectedPatient) return;

    const loadPatientData = async () => {
      if (user?.isDemo) {
        const { sessions: demoSessions } = generateDemoData();
        const filteredSessions = demoSessions.filter(s => s.userId === selectedPatient.id);
        const formattedData = formatSessionData(filteredSessions);
        setSessionHistory(formattedData);
        
        setComplianceData({
          completedSessions: 25,
          assignedSessions: 30,
          complianceScore: 83
        });
        return;
      }

      const historyResult = await getPatientSessionHistory(selectedPatient.id, timeRange);
      if (historyResult.success) {
        const formattedData = formatSessionData(historyResult.data);
        setSessionHistory(formattedData);
      }

      const complianceResult = await calculateComplianceScore(selectedPatient.id, 5);
      if (complianceResult.success) {
        setComplianceData(complianceResult.data);
      }
    };

    loadPatientData();
  }, [selectedPatient, timeRange, user]);

  const formatSessionData = (sessions) => {
    return sessions.map(session => ({
      date: formatDate(session.createdAt),
      maxAngle: session.maxAngle || 0,
      reps: session.reps || 0,
      painLevel: session.painLevel || 0,
      timestamp: session.createdAt
    }));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateStats = () => {
    if (sessionHistory.length === 0) {
      return { avgROM: 0, maxROM: 0, totalSessions: 0, avgReps: 0, improvement: 0 };
    }

    const angles = sessionHistory.map(s => s.maxAngle);
    const reps = sessionHistory.map(s => s.reps);

    const avgROM = Math.round(angles.reduce((a, b) => a + b, 0) / angles.length);
    const maxROM = Math.max(...angles);
    const avgReps = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);

    const firstROM = angles[0] || 0;
    const latestROM = angles[angles.length - 1] || 0;
    const improvement = Math.round(((latestROM - firstROM) / firstROM) * 100) || 0;

    return { avgROM, maxROM, totalSessions: sessionHistory.length, avgReps, improvement };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-medical-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-medical-primary/30 border-t-medical-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 font-medium">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="min-h-screen bg-medical-background">
      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-medical-text-primary">Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-medical-text-secondary mb-1">Signed in as</p>
              <p className="font-semibold text-medical-text-primary">{user?.name || user?.email}</p>
              <p className="text-xs text-medical-text-secondary mt-0.5">Therapist account</p>
            </div>
            {/* Therapist Code inside settings */}
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-xs text-medical-text-secondary mb-2">Your Therapist Code</p>
              {loadingCode ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <span className="text-sm text-gray-400">Generating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-bold font-mono tracking-widest text-indigo-700">{therapistCode || '—'}</span>
                  {therapistCode && (
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {copied ? <><CheckIcon className="w-3.5 h-3.5" />Copied!</> : <><CopyIcon className="w-3.5 h-3.5" />Copy</>}
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
      {/* Top bar – no-patients state */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg p-2">
              <PhysioLogo className="w-6 h-6" color="white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-medical-text-primary">Physio – Therapist</h1>
              <p className="text-xs text-medical-text-secondary">
                {user?.isDemo && '🚀 Demo Mode • '}
                {user?.name || user?.email || 'Therapist'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            aria-label="Settings"
            className="p-2 rounded-xl hover:bg-gray-100 text-medical-text-secondary hover:text-medical-primary transition-colors"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl p-12 text-center shadow-lg">
            <div className="w-20 h-20 bg-medical-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <UsersIcon className="w-10 h-10 text-medical-primary" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">No Patients Yet</h2>
            <p className="text-gray-600 text-lg">
              Patients will appear here once they connect with your therapist code.
            </p>
            {user?.isDemo && (
              <p className="text-amber-600 mt-6 font-medium">
                💡 This is demo mode. In production, you'll see real patient data here.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-medical-background">
      {/* ── Therapist Settings Modal ── */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-medical-text-primary">Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-medical-text-secondary mb-1">Signed in as</p>
              <p className="font-semibold text-medical-text-primary">{user?.name || user?.email}</p>
              <p className="text-xs text-medical-text-secondary mt-0.5">Therapist account</p>
            </div>
            {/* Therapist Code inside settings */}
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-xs text-medical-text-secondary mb-2">Your Therapist Code</p>
              {loadingCode ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <span className="text-sm text-gray-400">Generating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-bold font-mono tracking-widest text-indigo-700">{therapistCode || '—'}</span>
                  {therapistCode && (
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {copied ? <><CheckIcon className="w-3.5 h-3.5" />Copied!</> : <><CopyIcon className="w-3.5 h-3.5" />Copy</>}
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
      {/* Top bar – main state */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg p-2">
            <PhysioLogo className="w-6 h-6" color="white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-medical-text-primary">Physio – Therapist</h1>
            <p className="text-xs text-medical-text-secondary">
              {user?.isDemo && '🚀 Demo Mode • '}
              {user?.name || user?.email || 'Therapist'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          aria-label="Settings"
          className="p-2 rounded-xl hover:bg-gray-100 text-medical-text-secondary hover:text-medical-primary transition-colors"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Patient List */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <div className="flex items-center gap-2 mb-4">
                <UsersIcon className="w-5 h-5 text-medical-primary" />
                <h3 className="text-xl font-bold text-gray-900">My Patients</h3>
              </div>
              
              <div className="space-y-2">
                {patients.map((patient, index) => (
                  <motion.button
                    key={patient.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition ${
                      selectedPatient?.id === patient.id
                        ? 'bg-gradient-to-r from-medical-primary to-teal-600 text-white shadow-lg'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-semibold">{patient.name || 'Patient'}</p>
                    <p className={`text-sm ${selectedPatient?.id === patient.id ? 'text-white/80' : 'text-gray-500'}`}>
                      {patient.email}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Time Range Selector */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="w-5 h-5 text-medical-secondary" />
                <h3 className="text-lg font-bold text-gray-900">Time Range</h3>
              </div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-medical-secondary font-medium"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </motion.div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Statistics Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <StatCard title="Avg ROM" value={`${stats.avgROM}°`} icon={<TargetIcon className="w-6 h-6" />} color="teal" />
              <StatCard title="Max ROM" value={`${stats.maxROM}°`} icon={<TrendingUpIcon className="w-6 h-6" />} color="green" />
              <StatCard title="Sessions" value={stats.totalSessions} icon={<CalendarIcon className="w-6 h-6" />} color="indigo" />
              <StatCard title="Progress" value={`${stats.improvement}%`} icon={<ActivityIcon className="w-6 h-6" />} color="amber" />
            </motion.div>

            {/* Compliance Score */}
            {complianceData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-md"
              >
                <div className="flex items-center gap-2 mb-6">
                  <AwardIcon className="w-6 h-6 text-medical-success" />
                  <h3 className="text-2xl font-bold text-gray-900">Compliance Score</h3>
                </div>
                <div className="flex items-center gap-8">
                  <div className="relative w-32 h-32">
                    <svg className="transform -rotate-90 w-32 h-32">
                      <circle cx="64" cy="64" r="56" stroke="#E5E7EB" strokeWidth="12" fill="none" />
                      <circle
                        cx="64" cy="64" r="56"
                        stroke={getComplianceColor(complianceData.complianceScore)}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${(complianceData.complianceScore / 100) * 351.86} 351.86`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-bold text-gray-900">{complianceData.complianceScore}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {complianceData.completedSessions}
                      <span className="text-lg text-gray-500 font-normal"> / {complianceData.assignedSessions}</span>
                    </p>
                    <p className="text-gray-600 mt-1">Sessions completed this week</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ROM Progress Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-md"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">ROM Progress Over Time</h3>
              {sessionHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={sessionHistory}>
                    <defs>
                      <linearGradient id="colorROM" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} label={{ value: 'Angle (°)', angle: -90, position: 'insideLeft', fill: '#6B7280' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="maxAngle" stroke="#0D9488" fill="url(#colorROM)" strokeWidth={3} name="Max ROM (°)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No session data available</p>
              )}
            </motion.div>

            {/* Reps Per Session Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-8 shadow-md"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Reps Per Session</h3>
              {sessionHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sessionHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="reps" fill="#4F46E5" radius={[8, 8, 0, 0]} name="Reps" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No session data available</p>
              )}
            </motion.div>

            {/* Session History Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-8 shadow-md"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Recent Sessions</h3>
              {sessionHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left text-sm font-semibold text-gray-600 py-3 px-4">Date</th>
                        <th className="text-left text-sm font-semibold text-gray-600 py-3 px-4">Max ROM</th>
                        <th className="text-left text-sm font-semibold text-gray-600 py-3 px-4">Reps</th>
                        <th className="text-left text-sm font-semibold text-gray-600 py-3 px-4">Pain Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionHistory.slice().reverse().slice(0, 10).map((session, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b border-gray-100 hover:bg-gray-50 transition"
                        >
                          <td className="text-gray-900 py-3 px-4 font-medium">{session.date}</td>
                          <td className="text-medical-primary py-3 px-4 font-bold">{session.maxAngle}°</td>
                          <td className="text-medical-secondary py-3 px-4 font-semibold">{session.reps}</td>
                          <td className="text-amber-600 py-3 px-4 font-semibold">{session.painLevel}/10</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-12">No sessions yet</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * StatCard Component
 */
const StatCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    teal: 'from-medical-primary to-teal-600',
    green: 'from-medical-success to-emerald-600',
    indigo: 'from-medical-secondary to-indigo-600',
    amber: 'from-amber-400 to-amber-600'
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white shadow-lg`}
    >
      <div className="mb-3">{icon}</div>
      <p className="text-sm opacity-90 mb-1 font-medium">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </motion.div>
  );
};

const getComplianceColor = (score) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
};

export default TherapistDashboard;
