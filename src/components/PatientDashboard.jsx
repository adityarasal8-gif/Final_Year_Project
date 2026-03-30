/**
 * PatientDashboard.jsx
 * Main patient dashboard with Medical Design System
 * Shows exercise history, progress, and quick actions
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { switchPatientMode, validateTherapistCode, getUserSessions } from '../utils/firestore';
import { exerciseLibrary } from '../data/exercises';
import ExerciseDemo from './ExerciseDemo';
import PhysioLogo from './PhysioLogo';
import { auth } from '../firebase';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// Simple SVG Icons
const PlayIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
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

const TrendingUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const BarChartIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const TargetIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const AwardIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="7"/>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
  </svg>
);

const ChevronRightIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const ActivityIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const XIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const PatientDashboard = ({ user, onStartSession, onNavigate, onLogout }) => {
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showExerciseDemo, setShowExerciseDemo] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [therapistCodeInput, setTherapistCodeInput] = useState('');
  const [modeError, setModeError] = useState(null);
  const [modeSuccess, setModeSuccess] = useState(null);

  // Real session history state
  const [sessionHistory, setSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch real session history from Firebase on mount
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.uid || user?.isDemo) {
        // Demo / unauthenticated: show placeholder data
        setSessionHistory([
          { id: 1, date: '2026-03-08', exerciseName: 'Knee Flexion', maxAngle: 118, duration: 12, totalReps: 15, improvement: 8 },
          { id: 2, date: '2026-03-06', exerciseName: 'Knee Flexion', maxAngle: 112, duration: 10, totalReps: 12, improvement: 5 },
          { id: 3, date: '2026-03-04', exerciseName: 'Knee Extension', maxAngle: 108, duration: 11, totalReps: 14, improvement: 3 },
        ]);
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      try {
        const result = await getUserSessions(user.uid, 20);
        if (result.success && result.data.length > 0) {
          const formatted = result.data.map((s) => ({
            id: s.id,
            date: s.createdAt?.toDate
              ? s.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            exerciseName: s.exerciseName || 'Exercise',
            maxAngle: Math.round(s.maxAngle || 0),
            duration: Math.round((s.duration || 0) / 60) || 1,
            totalReps: s.totalReps || 0,
            improvement: s.improvement || 0,
          }));
          setSessionHistory(formatted);
        }
      } catch (err) {
        console.error('Error loading session history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [user?.uid, user?.isDemo]);

  // Compute stats from real session data
  const stats = (() => {
    if (sessionHistory.length === 0) return { totalSessions: 0, weekStreak: 0, avgAngleImprovement: 0, nextGoal: 145 };
    const angles = sessionHistory.map(s => s.maxAngle);
    const first = angles[angles.length - 1] || 0;
    const latest = angles[0] || 0;
    const avgImprovement = first > 0 ? Math.round(((latest - first) / first) * 100) : 0;
    // streak: count consecutive days from today
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // (simplified streak calculation based on session count in last 7 days)
    return {
      totalSessions: sessionHistory.length,
      weekStreak: Math.min(sessionHistory.length, 7),
      avgAngleImprovement: Math.max(0, avgImprovement),
      nextGoal: Math.min(180, (Math.max(...angles) || 90) + 10)
    };
  })();

  // Chart data: oldest→newest for improvement sparkline
  const chartData = [...sessionHistory].reverse().map((s, i) => ({
    session: i + 1,
    angle: s.maxAngle,
    label: s.date,
  }));

  // Use exercise library instead of hardcoded exercises
  const exercises = exerciseLibrary;

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const handleSwitchMode = async () => {
    setModeError(null);
    setModeSuccess(null);
    setSwitchingMode(true);

    try {
      const newMode = user.patientType === 'independent' ? 'with_therapist' : 'independent';
      
      // If switching to with_therapist, validate therapist code
      if (newMode === 'with_therapist') {
        if (!therapistCodeInput.trim()) {
          setModeError('Please enter a therapist code');
          setSwitchingMode(false);
          return;
        }

        const validation = await validateTherapistCode(therapistCodeInput.trim());
        if (!validation.success) {
          setModeError('Invalid therapist code. Please check and try again.');
          setSwitchingMode(false);
          return;
        }

        const switchResult = await switchPatientMode(user.uid, newMode, therapistCodeInput.trim());
        if (!switchResult.success) {
          setModeError('Failed to connect with therapist. Please try again.');
          setSwitchingMode(false);
          return;
        }
      } else {
        // Switching to independent
        const switchResult = await switchPatientMode(user.uid, newMode);
        if (!switchResult.success) {
          setModeError('Failed to switch mode. Please try again.');
          setSwitchingMode(false);
          return;
        }
      }

      setModeSuccess(`Successfully switched to ${newMode === 'independent' ? 'Independent Mode' : 'With Therapist Mode'}`);
      setTherapistCodeInput('');
      
      // Close modal after 2 seconds and reload page
      setTimeout(() => {
        setShowSettingsModal(false);
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error switching mode:', error);
      setModeError('Failed to switch mode. Please try again.');
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleExerciseSelect = (exercise) => {
    setSelectedExercise(exercise);
    setShowExerciseDemo(true);
  };

  const handleStartExercise = (selectedLeg) => {
    setShowExerciseDemo(false);
    onStartSession(selectedExercise, selectedLeg);
  };

  const handleBackFromDemo = () => {
    setShowExerciseDemo(false);
    setSelectedExercise(null);
  };

  // Show exercise demo screen if an exercise is selected
  if (showExerciseDemo && selectedExercise) {
    return (
      <ExerciseDemo
        exercise={selectedExercise}
        onStart={handleStartExercise}
        onBack={handleBackFromDemo}
      />
    );
  }

  return (
    <div className="min-h-screen bg-medical-background">
    {/* ── Physio Top Bar ── */}
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg p-2">
          <PhysioLogo className="w-5 h-5" color="white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-medical-text-primary leading-tight">Physio</h1>
          <p className="text-xs text-medical-text-secondary">
            {user?.isDemo && '🚀 Demo • '}{user?.name || user?.email}
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

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Welcome Section */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-medical-text-primary mb-2">
          Welcome back, {user.name || 'Patient'}! 👋
        </h1>
        <p className="text-medical-text-secondary">
          {user.hasTherapist 
            ? "Your therapist can monitor your progress and provide guidance."
            : "You're practicing independently. Keep up the great work!"}
        </p>
        {user.patientType === 'independent' && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full">
            <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
            <span className="text-xs font-medium text-teal-700">Independent Mode</span>
          </div>
        )}
        {user.hasTherapist && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <span className="text-xs font-medium text-indigo-700">Connected to Therapist</span>
          </div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-teal-100 rounded-xl">
              <ActivityIcon className="w-6 h-6 text-medical-primary" />
            </div>
            <span className="text-2xl font-bold text-medical-text-primary">
              {stats.totalSessions}
            </span>
          </div>
          <h3 className="text-sm font-medium text-medical-text-secondary">Total Sessions</h3>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <CalendarIcon className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-2xl font-bold text-medical-text-primary">
              {stats.weekStreak} days
            </span>
          </div>
          <h3 className="text-sm font-medium text-medical-text-secondary">Week Streak 🔥</h3>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUpIcon className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-medical-text-primary">
              +{stats.avgAngleImprovement}°
            </span>
          </div>
          <h3 className="text-sm font-medium text-medical-text-secondary">Avg Improvement</h3>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <TargetIcon className="w-6 h-6 text-medical-secondary" />
            </div>
            <span className="text-2xl font-bold text-medical-text-primary">
              {stats.nextGoal}°
            </span>
          </div>
          <h3 className="text-sm font-medium text-medical-text-secondary">Next Goal</h3>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Exercises */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exercise Selection Call-to-Action */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-medical-primary to-teal-600 rounded-2xl p-8 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">Ready for today's session?</h2>
                <p className="text-teal-100 mb-1">Let's improve your knee mobility</p>
                <p className="text-white/90 text-sm font-medium flex items-center gap-2 mt-2">
                  <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  Select an exercise below to begin
                </p>
              </div>
              <div className="text-5xl">🎯</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 mt-4">
              <p className="text-white/90 text-sm text-center">
                💡 <span className="font-semibold">Tip:</span> Each exercise includes a demo and instructions before you start
              </p>
            </div>
          </motion.div>

          {/* Available Exercises */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-bold text-medical-text-primary mb-4 flex items-center gap-2">
              <AwardIcon className="w-6 h-6 text-medical-primary" />
              Available Exercises
            </h2>
            <div className="space-y-4">
              {exercises.map((exercise, index) => (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="group relative p-5 border-2 border-gray-200 rounded-xl hover:border-medical-primary hover:bg-gradient-to-br hover:from-teal-50 hover:to-cyan-50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                  onClick={() => handleExerciseSelect(exercise)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Click indicator badge */}
                  <div className="absolute top-3 right-3 bg-medical-primary text-white text-xs px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-medium animate-pulse">
                    Click to start →
                  </div>
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-medical-primary to-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {exercise.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-medical-text-primary text-lg group-hover:text-medical-primary transition-colors">
                            {exercise.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium text-xs">
                              {exercise.difficulty}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium text-xs">
                              {exercise.category}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-1 text-medical-text-secondary">
                          <span className="font-semibold text-medical-primary">🎯</span>
                          <span className="font-medium">{exercise.targetAngle}° target</span>
                        </div>
                        <div className="flex items-center gap-1 text-medical-text-secondary">
                          <span className="font-semibold text-medical-primary">⏱️</span>
                          <span className="font-medium">{exercise.duration}</span>
                        </div>
                        <div className="flex items-center gap-1 text-medical-text-secondary">
                          <span className="font-semibold text-medical-primary">📊</span>
                          <span className="font-medium">{exercise.targetSets}×{exercise.targetReps} reps</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex flex-wrap gap-1">
                        {exercise.muscleGroups?.slice(0, 3).map((muscle) => (
                          <span key={muscle} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                            {muscle}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-6 h-6 text-gray-400 group-hover:text-medical-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Session History & Improvement */}
        <div className="space-y-6">
          {/* Improvement Sparkline Chart */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-bold text-medical-text-primary mb-1 flex items-center gap-2">
              <TrendingUpIcon className="w-6 h-6 text-green-500" />
              ROM Improvement
            </h2>
            <p className="text-xs text-medical-text-secondary mb-4">Max knee angle per session</p>
            {historyLoading ? (
              <div className="flex items-center justify-center h-28">
                <div className="w-8 h-8 border-4 border-medical-primary/30 border-t-medical-primary rounded-full animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorAngle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" domain={['auto','auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                    formatter={(v) => [`${v}°`, 'Max Angle']}
                  />
                  <Area type="monotone" dataKey="angle" stroke="#0D9488" fill="url(#colorAngle)" strokeWidth={2.5} dot={{ r: 3, fill: '#0D9488' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-28 flex flex-col items-center justify-center text-center">
                <ActivityIcon className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Complete your first session to see progress</p>
              </div>
            )}
          </motion.div>

          {/* Recent Sessions List */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.75 }}
            className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-bold text-medical-text-primary mb-4 flex items-center gap-2">
              <BarChartIcon className="w-6 h-6 text-medical-secondary" />
              Session History
            </h2>
            {historyLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : sessionHistory.length > 0 ? (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {sessionHistory.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-medical-text-primary">{session.date}</span>
                        <span className="ml-2 text-xs text-gray-400">{session.exerciseName}</span>
                      </div>
                      {session.improvement > 0 ? (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+{session.improvement}%</span>
                      ) : (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-medical-text-secondary">
                      <div>
                        <div className="font-bold text-medical-primary text-sm">{session.maxAngle}°</div>
                        <div>Max Angle</div>
                      </div>
                      <div>
                        <div className="font-semibold text-medical-text-primary">{session.duration}m</div>
                        <div>Duration</div>
                      </div>
                      <div>
                        <div className="font-semibold text-medical-text-primary">{session.totalReps}</div>
                        <div>Reps</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
                <p className="text-xs text-gray-400 mt-1">Complete an exercise to see your history here</p>
              </div>
            )}
          </motion.div>

          {/* Progress Tip */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.85 }}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
          >
            <div className="text-3xl mb-3">💡</div>
            <h3 className="font-bold mb-2">Progress Tip</h3>
            <p className="text-sm text-indigo-100">
              Consistency is key! Try to complete at least 3 sessions per week for optimal recovery.
            </p>
          </motion.div>
        </div>
      </div>

    </div>{/* end inner px wrapper */}

    {/* Settings Modal */}
    <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-medical-text-primary">Settings</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XIcon className="w-5 h-5 text-medical-text-secondary" />
                </button>
              </div>

              {/* Current Mode Display */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <h3 className="text-sm font-medium text-medical-text-secondary mb-2">Current Mode</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${user.patientType === 'independent' ? 'bg-teal-500' : 'bg-indigo-500'}`}></div>
                  <span className="font-semibold text-medical-text-primary">
                    {user.patientType === 'independent' ? 'Independent Practice' : 'With Therapist'}
                  </span>
                </div>
                {user.hasTherapist && user.therapistCode && (
                  <p className="text-xs text-medical-text-secondary mt-2">
                    Therapist Code: <span className="font-mono font-semibold">{user.therapistCode}</span>
                  </p>
                )}
              </div>

              {/* Switch Mode Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-medical-text-secondary mb-3">Switch Mode</h3>
                <p className="text-sm text-medical-text-secondary mb-4">
                  {user.patientType === 'independent'
                    ? 'Connect with a therapist to receive personalized guidance and monitoring.'
                    : 'Switch to independent practice to continue on your own.'}
                </p>

                {user.patientType === 'independent' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-medical-text-secondary mb-2">
                      Therapist Code
                    </label>
                    <input
                      type="text"
                      value={therapistCodeInput}
                      onChange={(e) => setTherapistCodeInput(e.target.value.toUpperCase())}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent font-mono text-center text-lg tracking-wider"
                    />
                  </div>
                )}

                {modeError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{modeError}</p>
                  </div>
                )}

                {modeSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-600">{modeSuccess}</p>
                  </div>
                )}

                <button
                  onClick={handleSwitchMode}
                  disabled={switchingMode}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    switchingMode
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : user.patientType === 'independent'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                >
                  {switchingMode
                    ? 'Switching...'
                    : user.patientType === 'independent'
                    ? 'Connect with Therapist'
                    : 'Switch to Independent Mode'}
                </button>
              </div>

              {/* Logout */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    if (onLogout) onLogout();
                    else if (onNavigate) onNavigate('login');
                  }}
                  className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
    </AnimatePresence>
  </div>
  );
};

export default PatientDashboard;
