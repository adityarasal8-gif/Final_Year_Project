/**
 * SessionContext.jsx
 * Global state management for physiotherapy session
 * Manages baseline ROM, current angle, reps, and feedback state
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { calculateImprovement, getFeedbackState } from '../utils/geometry';

const SessionContext = createContext(null);

const BASELINE_RECORDS_STORAGE_KEY = 'physio_baseline_records_v2';
const BASELINE_MAX_AGE_DAYS = 7;
const DEFAULT_ANGLE_MODE = 'inner_knee_angle';

const readBaselineRecords = () => {
  try {
    const raw = localStorage.getItem(BASELINE_RECORDS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('⚠️ Failed to read scoped baseline records:', error);
    return {};
  }
};

const writeBaselineRecords = (records) => {
  try {
    localStorage.setItem(BASELINE_RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Error saving scoped baseline records:', error);
  }
};

const buildBaselineRecordKey = ({ exerciseId, legSide, angleMode }) => {
  if (!exerciseId) return null;
  return `${exerciseId}::${legSide || 'left'}::${angleMode || DEFAULT_ANGLE_MODE}`;
};

const getMinimumBaselineByAngleMode = (angleMode) => {
  return angleMode === 'inner_knee_angle' ? 30 : 5;
};

/**
 * Session phases
 */
export const SESSION_PHASES = {
  SETUP: 'setup',           // Initial setup, camera permissions
  CALIBRATION: 'calibration', // Day 1: Max flexion test
  EXERCISE: 'exercise',     // Active exercise session
  COMPLETE: 'complete'      // Session completed
};

/**
 * Feedback states for visual/audio cues
 */
export const FEEDBACK_STATES = {
  NEUTRAL: 'neutral',       // Gray - No specific feedback
  GOOD: 'good',             // Light Green - Progress made
  EXCELLENT: 'excellent',   // Bright Green - Target achieved
  WARNING: 'warning'        // Red - Below baseline
};

/**
 * SessionProvider Component
 * Wraps the application with session state
 */
export const SessionProvider = ({ children }) => {
  // Session configuration
  const [phase, setPhase] = useState(SESSION_PHASES.SETUP);
  const [legSide, setLegSide] = useState('left'); // 'left' or 'right' or 'both'
  const [targetROM, setTargetROM] = useState(135); // Target angle in degrees

  // Baseline data (from calibration)
  const [baselineROM, setBaselineROM] = useState(null);
  const [baselineProfile, setBaselineProfile] = useState(null);
  const [calibrationDate, setCalibrationDate] = useState(null);
  const [exerciseContext, setExerciseContextState] = useState({
    exerciseId: null,
    angleMode: DEFAULT_ANGLE_MODE
  });

  // Current session data
  const [currentAngle, setCurrentAngle] = useState(null);
  const [leftAngle, setLeftAngle] = useState(null);
  const [rightAngle, setRightAngle] = useState(null);

  // Rollback control - Feature flag for explicit clinical decision math
  const [enableDecisionEngine, setEnableDecisionEngine] = useState(true);
  const [maxAngleThisSession, setMaxAngleThisSession] = useState(null);
  const [reps, setReps] = useState(0);
  const [feedbackState, setFeedbackState] = useState(FEEDBACK_STATES.NEUTRAL);

  // Rep tracking state
  const [isInFlexion, setIsInFlexion] = useState(false);
  const [repHistory, setRepHistory] = useState([]);

  // Session timing
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [setsCompleted, setSetsCompleted] = useState(0);

  // Audio feedback
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Use refs to avoid recreating callbacks
  const maxAngleRef = useRef(null);
  const audioEnabledRef = useRef(audioEnabled);
  const baselineROMRef = useRef(baselineROM);
  const exerciseContextRef = useRef(exerciseContext);
  const targetROMRef = useRef(targetROM);
  const isInFlexionRef = useRef(isInFlexion);
  const legSideRef = useRef(legSide);
  const currentSetRef = useRef(currentSet);
  const flexionStartTimeRef = useRef(null);
  const lastRepTimeRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    maxAngleRef.current = maxAngleThisSession;
  }, [maxAngleThisSession]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    baselineROMRef.current = baselineROM;
  }, [baselineROM]);

  useEffect(() => {
    exerciseContextRef.current = exerciseContext;
  }, [exerciseContext]);

  useEffect(() => {
    targetROMRef.current = targetROM;
  }, [targetROM]);

  useEffect(() => {
    isInFlexionRef.current = isInFlexion;
  }, [isInFlexion]);

  useEffect(() => {
    legSideRef.current = legSide;
  }, [legSide]);

  useEffect(() => {
    currentSetRef.current = currentSet;
  }, [currentSet]);

  /**
   * Calculate improvement based on current angle
   */
  const improvement = currentAngle && baselineROM
    ? calculateImprovement(currentAngle, baselineROM, targetROM)
    : 0;

  /**
   * Set current exercise context so baselines can be scoped per exercise.
   * @param {{exerciseId?: string|null, angleMode?: string|null}} context
   */
  const setExerciseContext = useCallback((context = {}) => {
    const normalizedExerciseId = typeof context?.exerciseId === 'string' && context.exerciseId.trim()
      ? context.exerciseId.trim()
      : null;
    const normalizedAngleMode = typeof context?.angleMode === 'string' && context.angleMode.trim()
      ? context.angleMode.trim()
      : DEFAULT_ANGLE_MODE;

    setExerciseContextState({
      exerciseId: normalizedExerciseId,
      angleMode: normalizedAngleMode
    });
  }, []);

  /**
   * Set baseline ROM from calibration test
   * @param {number} angle - Maximum flexion angle achieved
   * @param {Object|null} profile - Optional cleaned baseline profile metrics
   */
  const setBaseline = useCallback((angle, profile = null) => {
    const angleMode = exerciseContextRef.current?.angleMode || DEFAULT_ANGLE_MODE;
    const minBaseline = getMinimumBaselineByAngleMode(angleMode);

    if (!angle || angle <= minBaseline) {
      console.warn('⚠️ Invalid baseline angle:', angle);
      return;
    }
    
    const roundedAngle = Math.round(angle);
    const normalizedProfile = profile && typeof profile === 'object' ? profile : null;

    setBaselineROM(roundedAngle);
    setBaselineProfile(normalizedProfile);
    const calibrationTimestamp = new Date().toISOString();
    setCalibrationDate(calibrationTimestamp);
    setPhase(SESSION_PHASES.EXERCISE);
    
    // Save scoped baseline per exercise+leg+angleMode.
    try {
      const context = exerciseContextRef.current;
      const recordKey = buildBaselineRecordKey({
        exerciseId: context?.exerciseId,
        legSide: legSideRef.current,
        angleMode: context?.angleMode
      });

      if (recordKey) {
        const records = readBaselineRecords();
        records[recordKey] = {
          exerciseId: context.exerciseId,
          legSide: legSideRef.current,
          angleMode: context.angleMode || DEFAULT_ANGLE_MODE,
          baselineROM: roundedAngle,
          baselineProfile: normalizedProfile,
          targetROM: targetROMRef.current,
          calibrationDate: calibrationTimestamp
        };
        writeBaselineRecords(records);
      } else {
        console.warn('⚠️ Baseline saved in-memory only because exercise context is missing');
      }

      // Cleanup legacy baseline keys so old unscoped values are not reused.
      localStorage.removeItem('physio_baseline_rom');
      localStorage.removeItem('physio_calibration_date');
      localStorage.removeItem('physio_baseline_leg_side');
      localStorage.removeItem('physio_baseline_profile');
      
      console.log(`✅ Baseline ROM set: ${roundedAngle}° (${legSideRef.current} leg)`);
      
      // Optional: Provide haptic feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    } catch (error) {
      console.error('Error saving baseline to localStorage:', error);
    }
  }, []);

  /**
   * Update current angle and calculate feedback
   * @param {number} angle - Current measured knee angle
   */
  const updateAngle = useCallback((angle) => {
    setCurrentAngle(angle);

    // Update max angle for this session
    if (!maxAngleRef.current || angle > maxAngleRef.current) {
      maxAngleRef.current = angle;
      setMaxAngleThisSession(angle);
    }

    // Only calculate feedback if baseline is set
    if (baselineROMRef.current) {
      const newFeedbackState = getFeedbackState(angle, baselineROMRef.current, targetROMRef.current);
      setFeedbackState(newFeedbackState);

      // Trigger audio cue for warning
      if (newFeedbackState === FEEDBACK_STATES.WARNING && audioEnabledRef.current) {
        playWarningSound();
      }
    }
  }, []);

  /**
   * Detect and count a rep
   * Movement pattern is exercise-configurable and posture-gated.
   */
  const detectRep = useCallback((angle, repConfig = null, postureOk = true) => {
    if (!baselineROMRef.current || typeof angle !== 'number') return;

    const now = Date.now();

    const movementPattern = repConfig?.movementPattern || 'increase_then_decrease';
    const isIncreaseThenDecrease = movementPattern === 'increase_then_decrease';
    const baselineReference = baselineROMRef.current || 0;

    let peakThreshold = typeof repConfig?.peakThreshold === 'number'
      ? repConfig.peakThreshold
      : Math.max(baselineReference + 8, (targetROMRef.current || 0) - 15);

    if (Number.isFinite(repConfig?.peakBaselineOffset)) {
      peakThreshold = baselineReference + repConfig.peakBaselineOffset;
    }

    if (Number.isFinite(repConfig?.minPeakThreshold)) {
      peakThreshold = Math.max(peakThreshold, repConfig.minPeakThreshold);
    }

    if (Number.isFinite(repConfig?.maxPeakThreshold)) {
      peakThreshold = Math.min(peakThreshold, repConfig.maxPeakThreshold);
    }

    let resetThreshold = typeof repConfig?.resetThreshold === 'number'
      ? repConfig.resetThreshold
      : Math.max(10, baselineReference - 8);

    if (Number.isFinite(repConfig?.resetBaselineDrop)) {
      resetThreshold = isIncreaseThenDecrease
        ? baselineReference - repConfig.resetBaselineDrop
        : baselineReference + repConfig.resetBaselineDrop;
    }

    if (Number.isFinite(repConfig?.minResetThreshold)) {
      resetThreshold = Math.max(resetThreshold, repConfig.minResetThreshold);
    }

    if (Number.isFinite(repConfig?.maxResetThreshold)) {
      resetThreshold = Math.min(resetThreshold, repConfig.maxResetThreshold);
    }

    const adaptiveResetFactor = Number.isFinite(repConfig?.adaptiveResetFactor)
      ? repConfig.adaptiveResetFactor
      : null;
    const adaptiveResetMin = Number.isFinite(repConfig?.adaptiveResetMin)
      ? repConfig.adaptiveResetMin
      : null;
    const minPeakHoldTime = typeof repConfig?.minPeakHoldTime === 'number' ? repConfig.minPeakHoldTime : 180;
    const minRepInterval = typeof repConfig?.minRepInterval === 'number' ? repConfig.minRepInterval : 600;

    const enteredPeak = isIncreaseThenDecrease
      ? angle >= peakThreshold
      : angle <= peakThreshold;

    if (!isInFlexionRef.current && enteredPeak && postureOk) {
      isInFlexionRef.current = true;
      setIsInFlexion(true);
      flexionStartTimeRef.current = now;
      return;
    }

    if (!isInFlexionRef.current) {
      return;
    }

    const effectiveResetThreshold = (() => {
      if (!Number.isFinite(adaptiveResetFactor)) {
        return resetThreshold;
      }

      const adaptiveByPeak = peakThreshold * adaptiveResetFactor;

      if (isIncreaseThenDecrease) {
        const boostedReset = Math.max(resetThreshold, adaptiveByPeak);
        return Number.isFinite(adaptiveResetMin)
          ? Math.max(boostedReset, adaptiveResetMin)
          : boostedReset;
      }

      const loweredReset = Math.min(resetThreshold, adaptiveByPeak);
      return Number.isFinite(adaptiveResetMin)
        ? Math.min(loweredReset, adaptiveResetMin)
        : loweredReset;
    })();

    const reachedReset = isIncreaseThenDecrease
      ? angle <= effectiveResetThreshold
      : angle >= effectiveResetThreshold;

    if (!reachedReset) {
      return;
    }

    const phaseStartedAt = flexionStartTimeRef.current || now;
    const heldLongEnough = now - phaseStartedAt >= minPeakHoldTime;
    const cooldownPassed = now - lastRepTimeRef.current >= minRepInterval;

    isInFlexionRef.current = false;
    setIsInFlexion(false);
    flexionStartTimeRef.current = null;

    if (!heldLongEnough || !cooldownPassed || !postureOk) {
      return;
    }

    lastRepTimeRef.current = now;

    setReps(prev => {
      const newRepCount = prev + 1;

      const repData = {
        repNumber: newRepCount,
        maxAngle: maxAngleRef.current || angle,
        timestamp: new Date().toISOString(),
        improvement: calculateImprovement(maxAngleRef.current || angle, baselineROMRef.current, targetROMRef.current),
        improvementPercent: calculateImprovement(maxAngleRef.current || angle, baselineROMRef.current, targetROMRef.current),
        set: currentSetRef.current
      };

      setRepHistory(prevHistory => [...prevHistory, repData]);

      if (audioEnabledRef.current) {
        playSuccessSound();
      }

      console.log(`✅ Rep ${newRepCount} completed: ${Math.round(maxAngleRef.current || angle)}° (Set ${currentSetRef.current})`);

      return newRepCount;
    });

    setMaxAngleThisSession(null);
    maxAngleRef.current = null;
  }, []);

  /**
   * Play warning sound (below baseline)
   */
  const playWarningSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 200; // Low frequency for warning
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  }, []);

  /**
   * Play success sound (rep completed)
   */
  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // High frequency for success
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  }, []);

  /**
   * Start a new exercise session
   */
  const startSession = useCallback(() => {
    setSessionStartTime(Date.now());
    setSessionEndTime(null);
    setReps(0);
    setRepHistory([]);
    setMaxAngleThisSession(null);
    setCurrentAngle(null);
    setIsInFlexion(false);
    setFeedbackState(FEEDBACK_STATES.NEUTRAL);
    setCurrentSet(1);
    setSetsCompleted(0);
    flexionStartTimeRef.current = null;
    lastRepTimeRef.current = 0;
    isInFlexionRef.current = false;
    console.log('🏁 Session started');
  }, []);

  /**
   * End current session and return summary data
   */
  const endSession = useCallback(() => {
    const endTime = Date.now();
    setSessionEndTime(endTime);
    
    const duration = sessionStartTime ? Math.round((endTime - sessionStartTime) / 1000) : 0;
    const bestAngle = repHistory.length > 0 
      ? Math.max(...repHistory.map(r => r.maxAngle))
      : maxAngleThisSession || 0;
    const improvementDeg = baselineROM ? Math.round(bestAngle - baselineROM) : 0;
    const improvementPercent = calculateImprovement(bestAngle, baselineROM, targetROMRef.current);
    
    const sessionData = {
      reps: repHistory,
      totalReps: reps,
      bestAngle,
      duration,
      baselineROM,
      baselineProfile,
      improvement: improvementDeg,
      improvementDeg,
      improvementPercent,
      sessionStartTime,
      sessionEndTime: endTime,
      currentSet,
      setsCompleted
    };
    
    console.log('🏁 Session ended:', sessionData);
    return sessionData;
  }, [reps, repHistory, baselineROM, baselineProfile, maxAngleThisSession, sessionStartTime, currentSet, setsCompleted]);

  /**
   * Reset session (start new exercise session)
   */
  const resetSession = useCallback(() => {
    setReps(0);
    setRepHistory([]);
    setMaxAngleThisSession(null);
    setCurrentAngle(null);
    setIsInFlexion(false);
    setFeedbackState(FEEDBACK_STATES.NEUTRAL);
    setSessionStartTime(null);
    setSessionEndTime(null);
    setCurrentSet(1);
    setSetsCompleted(0);
    flexionStartTimeRef.current = null;
    lastRepTimeRef.current = 0;
    isInFlexionRef.current = false;
  }, []);

  /**
   * Move to next set
   */
  const nextSet = useCallback(() => {
    setSetsCompleted(prev => prev + 1);
    setCurrentSet(prev => prev + 1);
    setReps(0);
    setMaxAngleThisSession(null);
    setCurrentAngle(null);
    setIsInFlexion(false);
    flexionStartTimeRef.current = null;
    lastRepTimeRef.current = 0;
    isInFlexionRef.current = false;
    console.log(`📊 Moving to set ${currentSet + 1}`);
  }, [currentSet]);

  /**
   * Load scoped baseline when exercise context or leg side changes.
   */
  useEffect(() => {
    if (!exerciseContext?.exerciseId) {
      return;
    }

    const recordKey = buildBaselineRecordKey({
      exerciseId: exerciseContext.exerciseId,
      legSide,
      angleMode: exerciseContext.angleMode
    });

    if (!recordKey) {
      return;
    }

    const records = readBaselineRecords();
    const record = records[recordKey];

    if (!record) {
      setBaselineROM(null);
      setBaselineProfile(null);
      setCalibrationDate(null);
      setPhase(SESSION_PHASES.SETUP);
      return;
    }

    const baselineValue = parseFloat(record.baselineROM);
    const minBaseline = getMinimumBaselineByAngleMode(exerciseContext.angleMode || DEFAULT_ANGLE_MODE);
    const savedDate = record.calibrationDate;
    const calibrationAge = savedDate ? Date.now() - new Date(savedDate).getTime() : Number.POSITIVE_INFINITY;
    const daysOld = calibrationAge / (1000 * 60 * 60 * 24);

    if (daysOld < BASELINE_MAX_AGE_DAYS && baselineValue > minBaseline) {
      const parsedProfile = record.baselineProfile && typeof record.baselineProfile === 'object'
        ? record.baselineProfile
        : null;

      setBaselineROM(baselineValue);
      setBaselineProfile(parsedProfile);
      setCalibrationDate(savedDate || null);
      setPhase(SESSION_PHASES.EXERCISE);
      console.log(`📌 Loaded scoped baseline ROM: ${baselineValue}° (${exerciseContext.exerciseId}/${legSide})`);
      return;
    }

    delete records[recordKey];
    writeBaselineRecords(records);

    setBaselineROM(null);
    setBaselineProfile(null);
    setCalibrationDate(null);
    setPhase(SESSION_PHASES.SETUP);
    console.log('⚠️ Scoped baseline expired - requiring new calibration');
  }, [exerciseContext, legSide]);

  /**
   * Context value
   */
  const value = {
    // Session state
    phase,
    setPhase,
    legSide,
    setLegSide,
    targetROM,
    setTargetROM,

    // Feature Flags
    enableDecisionEngine,
    setEnableDecisionEngine,

    // Baseline data
    baselineROM,
    baselineProfile,
    calibrationDate,
    setExerciseContext,
    setBaseline,

    leftAngle,
    rightAngle,
    // Current session
    currentAngle,
    updateAngle,
    maxAngleThisSession,
    reps,
    repHistory,
    feedbackState,
    improvement,

    // Session timing and sets
    sessionStartTime,
    sessionEndTime,
    currentSet,
    setsCompleted,

    // Rep detection
    detectRep,

    // Audio
    audioEnabled,
    setAudioEnabled,

    // Actions
    startSession,
    endSession,
    resetSession,
    nextSet
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

/**
 * useSession Hook
 * Access session context in components
 */
export const useSession = () => {
  const context = useContext(SessionContext);
  
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  
  return context;
};

export default SessionContext;
