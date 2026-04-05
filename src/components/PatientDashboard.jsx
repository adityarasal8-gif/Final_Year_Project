/**
 * PatientDashboard.jsx
 * Tabbed patient dashboard with exercise-aware metrics and persistent recovery history.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  switchPatientMode,
  validateTherapistCode,
  getUserSessions
} from '../utils/firestore';
import { exerciseLibrary } from '../data/exercises';
import { mapRecoverySession, calculateMedian } from '../utils/recoveryMetrics';
import ExerciseDemo from './ExerciseDemo';
import PhysioLogo from './PhysioLogo';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
  BarChart,
  Bar
} from 'recharts';

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

const TabButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
      active
        ? 'bg-teal-600 text-white shadow'
        : 'bg-white text-medical-text-secondary hover:bg-teal-50 border border-gray-200'
    }`}
  >
    {label}
  </button>
);

const getStreak = (records) => {
  if (!records.length) return 0;

  const uniqueDays = [...new Set(records.map((r) => r.dateKey))].sort((a, b) => new Date(b) - new Date(a));
  let streak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};
const PatientDashboard = ({ user, onStartSession, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [exerciseFilter, setExerciseFilter] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showExerciseDemo, setShowExerciseDemo] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [therapistCodeInput, setTherapistCodeInput] = useState('');
  const [modeError, setModeError] = useState(null);
  const [modeSuccess, setModeSuccess] = useState(null);

  const [sessionHistory, setSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.uid || user?.isDemo) {
        const demo = [
          { id: 'd1', exerciseId: 'knee-flexion', exerciseName: 'Knee Flexion', createdAt: '2026-03-29', maxAngle: 72, baselineROM: 42, targetAngle: 145, totalReps: 40, duration: 900, improvement: 12, postureAccuracy: 88 },
          { id: 'd2', exerciseId: 'knee-flexion', exerciseName: 'Knee Flexion', createdAt: '2026-03-27', maxAngle: 65, baselineROM: 42, targetAngle: 145, totalReps: 34, duration: 760, improvement: 8, postureAccuracy: 82 },
          { id: 'd3', exerciseId: 'knee-extension', exerciseName: 'Knee Extension', createdAt: '2026-03-24', maxAngle: 164, baselineROM: 142, targetAngle: 180, totalReps: 31, duration: 720, improvement: 10, postureAccuracy: 85 },
          { id: 'd4', exerciseId: 'bodyweight-squats', exerciseName: 'Bodyweight Squats', createdAt: '2026-03-21', maxAngle: 82, baselineROM: 48, targetAngle: 90, totalReps: 45, duration: 930, improvement: 14, postureAccuracy: 80 }
        ];
        setSessionHistory(demo.map(mapRecoverySession).sort((a, b) => b.createdAtMs - a.createdAtMs));
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      try {
        const result = await getUserSessions(user.uid, 100);
        if (result.success) {
          const mapped = result.data.map(mapRecoverySession).sort((a, b) => b.createdAtMs - a.createdAtMs);
          setSessionHistory(mapped);
        }
      } catch (err) {
        console.error('Error loading session history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [user?.uid, user?.isDemo]);

  const filteredHistory = useMemo(() => {
    if (exerciseFilter === 'all') return sessionHistory;
    return sessionHistory.filter((s) => s.exerciseId === exerciseFilter);
  }, [exerciseFilter, sessionHistory]);

  const chartableHistory = useMemo(() => {
    return filteredHistory.filter((session) => session.isChartable);
  }, [filteredHistory]);

  const plotHistory = useMemo(() => {
    if (chartableHistory.length) {
      return chartableHistory;
    }

    return filteredHistory.filter((session) => Number.isFinite(session.maxAngle) && session.maxAngle > 0);
  }, [chartableHistory, filteredHistory]);

  const stats = useMemo(() => {
    if (!filteredHistory.length) {
      return {
        totalSessions: 0,
        usableSessions: 0,
        weekStreak: 0,
        avgROMGain: 0,
        avgProgress: 0,
        nextGoal: 0,
        avgPosture: 0
      };
    }

    const source = chartableHistory.length ? chartableHistory : filteredHistory;
    const latest = source[0] || filteredHistory[0];
    const totalSessions = filteredHistory.length;
    const weekStreak = getStreak(source);
    const usableSessions = chartableHistory.length;
    const avgROMGain = Math.round(source.reduce((sum, s) => sum + (s.romGainDeg || 0), 0) / source.length);
    const avgProgress = Math.round(source.reduce((sum, s) => sum + (s.improvementPercent || 0), 0) / source.length);
    const avgPosture = Math.round(source.reduce((sum, s) => sum + (s.postureAccuracy || 0), 0) / source.length);

    let nextGoal = 0;
    if (exerciseFilter !== 'all') {
      const exerciseTarget = exerciseLibrary.find((e) => e.id === exerciseFilter)?.targetAngle || latest.targetAngle || 0;
      nextGoal = latest.maxAngle >= exerciseTarget ? Math.min(180, exerciseTarget + 5) : exerciseTarget;
    } else {
      const maxAngle = Math.max(...source.map((s) => s.maxAngle || 0));
      nextGoal = Math.min(180, maxAngle + 5);
    }

    return { totalSessions, usableSessions, weekStreak, avgROMGain, avgProgress, nextGoal, avgPosture };
  }, [chartableHistory, exerciseFilter, filteredHistory]);

  const trendData = useMemo(() => {
    const sorted = [...plotHistory]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((s, idx) => ({
        ...s,
        i: idx + 1
      }));

    const sessionsPerDay = {};
    return sorted.map((session) => {
      const nextIndex = (sessionsPerDay[session.dateKey] || 0) + 1;
      sessionsPerDay[session.dateKey] = nextIndex;

      return {
        i: session.i,
        label: nextIndex > 1 ? `${session.dateLabel} (${nextIndex})` : session.dateLabel,
        maxAngle: session.maxAngle,
        baseline: session.baselineROM,
        target: session.targetAngle || null,
        romGain: session.romGainDeg,
        progressPercent: session.hasProgressMetric ? session.improvementPercent : null,
        posture: session.postureAccuracy
      };
    });
  }, [plotHistory]);

  const chartReferences = useMemo(() => {
    if (exerciseFilter === 'all' || !plotHistory.length) {
      return { baselineRef: null, targetRef: null, yMax: 120 };
    }

    const baselineValues = plotHistory.map((s) => s.baselineROM).filter((v) => Number.isFinite(v));
    const targetValues = plotHistory.map((s) => s.targetAngle).filter((v) => Number.isFinite(v));
    const maxValues = plotHistory.map((s) => s.maxAngle).filter((v) => Number.isFinite(v));

    const baselineRef = calculateMedian(baselineValues);
    const configuredTarget = exerciseLibrary.find((exercise) => exercise.id === exerciseFilter)?.targetAngle;
    const targetRef = Number.isFinite(configuredTarget) ? configuredTarget : calculateMedian(targetValues);

    const ceiling = Math.max(
      ...(maxValues.length ? maxValues : [0]),
      Number.isFinite(targetRef) ? targetRef : 0,
      Number.isFinite(baselineRef) ? baselineRef : 0
    );

    return {
      baselineRef: Number.isFinite(baselineRef) ? Math.round(baselineRef) : null,
      targetRef: Number.isFinite(targetRef) ? Math.round(targetRef) : null,
      yMax: Math.min(180, Math.max(100, Math.round(ceiling + 10)))
    };
  }, [exerciseFilter, plotHistory]);

  const recoveryDiagnostics = useMemo(() => {
    const legacyAdjustedCount = filteredHistory.filter((session) => session.legacyAngleAdjusted).length;
    const anomalyCount = filteredHistory.filter((session) => session.calibrationAnomaly).length;

    return {
      total: filteredHistory.length,
      chartable: chartableHistory.length,
      plotted: plotHistory.length,
      excluded: Math.max(0, filteredHistory.length - chartableHistory.length),
      legacyAdjustedCount,
      anomalyCount
    };
  }, [chartableHistory.length, filteredHistory, plotHistory.length]);

  const exerciseRecovery = useMemo(() => {
    const source = sessionHistory.filter((session) => session.isChartable);
    const grouped = {};

    source.forEach((s) => {
      if (!grouped[s.exerciseId]) {
        grouped[s.exerciseId] = {
          name: s.exerciseName,
          sessions: 0,
          totalProgress: 0,
          totalROMGain: 0,
          totalPosture: 0
        };
      }

      grouped[s.exerciseId].sessions += 1;
      grouped[s.exerciseId].totalProgress += s.improvementPercent || 0;
      grouped[s.exerciseId].totalROMGain += s.romGainDeg || 0;
      grouped[s.exerciseId].totalPosture += s.postureAccuracy || 0;
    });

    return Object.values(grouped).map((g) => ({
      name: g.name,
      progress: Math.round(g.totalProgress / Math.max(1, g.sessions)),
      romGain: Math.round(g.totalROMGain / Math.max(1, g.sessions)),
      posture: Math.round(g.totalPosture / Math.max(1, g.sessions)),
      sessions: g.sessions
    }));
  }, [sessionHistory]);

  const handleSwitchMode = async () => {
    setModeError(null);
    setModeSuccess(null);
    setSwitchingMode(true);

    try {
      const newMode = user.patientType === 'independent' ? 'with_therapist' : 'independent';

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
        const switchResult = await switchPatientMode(user.uid, newMode);
        if (!switchResult.success) {
          setModeError('Failed to switch mode. Please try again.');
          setSwitchingMode(false);
          return;
        }
      }

      setModeSuccess(`Successfully switched to ${newMode === 'independent' ? 'Independent Mode' : 'With Therapist Mode'}`);
      setTherapistCodeInput('');

      setTimeout(() => {
        setShowSettingsModal(false);
        window.location.reload();
      }, 1500);
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

  const handleStartExercise = (leg) => {
    setShowExerciseDemo(false);
    onStartSession(selectedExercise, leg);
  };

  if (showExerciseDemo && selectedExercise) {
    return (
      <ExerciseDemo
        exercise={selectedExercise}
        onStart={handleStartExercise}
        onBack={() => {
          setShowExerciseDemo(false);
          setSelectedExercise(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-medical-background">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg p-2">
            <PhysioLogo className="w-5 h-5" color="white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-medical-text-primary leading-tight">Physio</h1>
            <p className="text-xs text-medical-text-secondary">
              {user?.isDemo && 'Demo - '}{user?.name || user?.email}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton active={activeTab === 'dashboard'} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
          <TabButton active={activeTab === 'exercises'} label="Exercises" onClick={() => setActiveTab('exercises')} />
          <TabButton active={activeTab === 'history'} label="Session History" onClick={() => setActiveTab('history')} />
          <TabButton active={activeTab === 'recovery'} label="Recovery" onClick={() => setActiveTab('recovery')} />
        </div>

        {(activeTab === 'dashboard' || activeTab === 'history' || activeTab === 'recovery') && (
          <div className="bg-white rounded-2xl p-4 border border-gray-200 mb-6 flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-medical-text-secondary">Exercise filter</label>
            <select
              value={exerciseFilter}
              onChange={(e) => setExerciseFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All exercises</option>
              {exerciseLibrary.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              Showing {filteredHistory.length} session{filteredHistory.length === 1 ? '' : 's'} - {recoveryDiagnostics.plotted} usable for plotting
            </span>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total Sessions', value: stats.totalSessions },
                { label: 'Streak', value: `${stats.weekStreak} day${stats.weekStreak === 1 ? '' : 's'}` },
                { label: 'Avg ROM Gain', value: `${stats.avgROMGain} deg` },
                { label: 'Avg Progress', value: `${stats.avgProgress}%` },
                { label: 'Posture Score', value: `${stats.avgPosture}%` }
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                  <div className="text-2xl font-bold text-medical-text-primary">{card.value}</div>
                  <div className="text-xs mt-1 text-medical-text-secondary uppercase tracking-wide">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-medical-text-primary mb-1">Recovery Trend</h3>
                <p className="text-xs text-medical-text-secondary mb-4">Validated max-angle trend from chartable sessions</p>
                {historyLoading ? (
                  <div className="h-56 flex items-center justify-center text-sm text-gray-400">Loading...</div>
                ) : trendData.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="maxAngle" stroke="#0D9488" fill="#99F6E4" fillOpacity={0.35} name="Max Angle" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-56 flex items-center justify-center text-sm text-gray-400">No sessions yet</div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-medical-text-primary mb-4">Recent Sessions</h3>
                {historyLoading ? (
                  <div className="text-sm text-gray-400">Loading...</div>
                ) : filteredHistory.length ? (
                  <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                    {filteredHistory.slice(0, 6).map((session) => (
                      <div key={session.id} className="p-3 border border-gray-100 rounded-xl">
                        <div className="flex justify-between text-sm font-semibold text-medical-text-primary">
                          <span>{session.dateLabel} - {session.exerciseName}</span>
                          <span className="text-teal-600">{session.maxAngle} deg</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {session.totalReps} reps - {session.durationMin} min - ROM gain {session.romGainDeg} deg - posture {session.postureAccuracy}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No sessions yet</div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'exercises' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {exerciseLibrary.map((exercise) => (
              <motion.button
                key={exercise.id}
                onClick={() => handleExerciseSelect(exercise)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="text-left bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-teal-400 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-medical-text-primary">{exercise.name}</h3>
                    <p className="text-sm text-medical-text-secondary mt-1 leading-relaxed">{exercise.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 font-semibold">
                        {exercise.category}
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
                        {exercise.duration}
                      </span>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                        exercise?.demo?.videoUrl?.trim()
                          ? 'bg-teal-50 text-teal-700 border-teal-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {exercise?.demo?.videoUrl?.trim() ? 'Demo ready' : 'Demo pending'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-teal-100 text-teal-700 font-semibold">{exercise.difficulty}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 text-xs text-gray-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Target</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{exercise.targetAngle} deg</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Sets</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{exercise.targetSets}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Reps</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{exercise.targetReps}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-slate-600">Preview demo, checklist, and start</span>
                  <span className="text-sm font-semibold text-teal-700">Open Exercise</span>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-medical-text-primary mb-4">Session History</h3>
            {historyLoading ? (
              <div className="text-sm text-gray-400">Loading sessions...</div>
            ) : filteredHistory.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-800">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-3">Date</th>
                      <th className="py-3">Exercise</th>
                      <th className="py-3">Reps</th>
                      <th className="py-3">Max Angle</th>
                      <th className="py-3">ROM Gain</th>
                      <th className="py-3">Progress</th>
                      <th className="py-3">Posture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 text-gray-800">
                        <td className="py-3 text-gray-800">{s.dateLabel}</td>
                        <td className="py-3 text-gray-800">{s.exerciseName}</td>
                        <td className="py-3 text-gray-800">{s.totalReps}</td>
                        <td className="py-3 text-gray-800">{s.maxAngle} deg</td>
                        <td className="py-3 text-gray-800">{s.romGainDeg} deg</td>
                        <td className="py-3 text-gray-800">{s.improvementPercent}%</td>
                        <td className="py-3 text-gray-800">{s.postureAccuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-400">No sessions available for this filter.</div>
            )}
          </div>
        )}

        {activeTab === 'recovery' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-medical-text-primary mb-1">Recovery Chart</h3>
              <p className="text-xs text-medical-text-secondary mb-4">
                {exerciseFilter === 'all'
                  ? 'Normalized progress (%) across mixed exercises.'
                  : 'Track max angle with robust baseline and target references.'}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                ROM gain = max angle - baseline. Progress % = (max angle - baseline) / (target - baseline) * 100.
              </p>
              {historyLoading ? (
                <div className="h-72 flex items-center justify-center text-sm text-gray-400">Loading recovery data...</div>
              ) : trendData.length ? (
                exerciseFilter === 'all' ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 120]} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Progress']} />
                      <Legend />
                      <ReferenceLine y={100} stroke="#0EA5E9" strokeDasharray="4 4" label="Target %" />
                      <Line type="monotone" dataKey="progressPercent" stroke="#0D9488" strokeWidth={3} dot={{ r: 3 }} name="Progress %" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, chartReferences.yMax]} />
                    <Tooltip formatter={(value, name) => [`${value} deg`, name]} />
                    <Legend />
                    <Line type="monotone" dataKey="maxAngle" stroke="#0D9488" strokeWidth={3} dot={{ r: 3 }} name="Max Angle" />
                    {Number.isFinite(chartReferences.baselineRef) && (
                      <ReferenceLine y={chartReferences.baselineRef} stroke="#F59E0B" strokeDasharray="4 4" label="Baseline ref" />
                    )}
                    {Number.isFinite(chartReferences.targetRef) && (
                      <ReferenceLine y={chartReferences.targetRef} stroke="#0EA5E9" strokeDasharray="4 4" label="Target" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                )
              ) : (
                <div className="h-72 flex items-center justify-center text-sm text-gray-400">No sessions yet to plot.</div>
              )}
              {!historyLoading && filteredHistory.length > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  Plotting {recoveryDiagnostics.plotted} of {recoveryDiagnostics.total} sessions.
                  {recoveryDiagnostics.chartable !== recoveryDiagnostics.plotted ? ` ${recoveryDiagnostics.chartable} passed strict quality checks.` : ''}
                  {recoveryDiagnostics.legacyAdjustedCount > 0 ? ` Legacy angle normalization applied to ${recoveryDiagnostics.legacyAdjustedCount} older session${recoveryDiagnostics.legacyAdjustedCount === 1 ? '' : 's'}.` : ''}
                  {recoveryDiagnostics.anomalyCount > 0 ? ` ${recoveryDiagnostics.anomalyCount} session${recoveryDiagnostics.anomalyCount === 1 ? '' : 's'} skipped due to baseline-target mismatch.` : ''}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-medical-text-primary mb-4">Exercise Recovery Comparison</h3>
              {exerciseRecovery.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={exerciseRecovery}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="progress" fill="#0D9488" name="Avg Progress (%)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="posture" fill="#2563EB" name="Avg Posture (%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-gray-400">No recovery metrics yet.</div>
              )}
            </div>
          </div>
        )}
      </div>

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

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    onLogout?.();
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
