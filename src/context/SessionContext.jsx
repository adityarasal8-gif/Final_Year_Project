/**
 * SessionContext.jsx
 * Global state management for physiotherapy session
 * Manages baseline ROM, current angle, reps, and feedback state
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { calculateImprovement, getFeedbackState } from '../utils/geometry';

const SessionContext = createContext(null);

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
  const [calibrationDate, setCalibrationDate] = useState(null);

  // Current session data
  const [currentAngle, setCurrentAngle] = useState(null);
  const [leftAngle, setLeftAngle] = useState(null);
  const [rightAngle, setRightAngle] = useState(null);
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
  const targetROMRef = useRef(targetROM);
  const isInFlexionRef = useRef(isInFlexion);

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
    targetROMRef.current = targetROM;
  }, [targetROM]);

  useEffect(() => {
    isInFlexionRef.current = isInFlexion;
  }, [isInFlexion]);

  /**
   * Calculate improvement based on current angle
   */
  const improvement = currentAngle && baselineROM
    ? calculateImprovement(currentAngle, baselineROM, targetROM)
    : 0;

  /**
   * Set baseline ROM from calibration test
   * @param {number} angle - Maximum flexion angle achieved
   */
  const setBaseline = useCallback((angle) => {
    if (!angle || angle <= 30) {
      console.warn('⚠️ Invalid baseline angle:', angle);
      return;
    }
    
    const roundedAngle = Math.round(angle);
    setBaselineROM(roundedAngle);
    setCalibrationDate(new Date().toISOString());
    setPhase(SESSION_PHASES.EXERCISE);
    
    // Save to localStorage for persistence with user identification
    try {
      localStorage.setItem('physio_baseline_rom', roundedAngle.toString());
      localStorage.setItem('physio_calibration_date', new Date().toISOString());
      localStorage.setItem('physio_baseline_leg_side', legSideRef.current);
      
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
   * Rep logic: Flexion (angle decreases below threshold) -> Extension (angle returns above threshold)
   */
  const detectRep = useCallback((angle) => {
    if (!baselineROMRef.current) return;

    const flexionThreshold = baselineROMRef.current + 10; // Angle must exceed baseline by 10°
    const extensionThreshold = 60; // Return to near-straight position

    // Transitioning into flexion
    if (!isInFlexionRef.current && angle >= flexionThreshold) {
      isInFlexionRef.current = true;
      setIsInFlexion(true);
    }

    // Completing a rep (returning from flexion)
    if (isInFlexionRef.current && angle <= extensionThreshold) {
      isInFlexionRef.current = false;
      setIsInFlexion(false);
      
      // Count the rep
      setReps(prev => {
        const newRepCount = prev + 1;

        // Record the rep with detailed data
        const repData = {
          repNumber: newRepCount,
          maxAngle: maxAngleRef.current || angle,
          timestamp: new Date().toISOString(),
          improvement: calculateImprovement(maxAngleRef.current || angle, baselineROMRef.current, targetROMRef.current),
          set: currentSet
        };

        setRepHistory(prevHistory => [...prevHistory, repData]);

        // Play success sound
        if (audioEnabledRef.current) {
          playSuccessSound();
        }

        console.log(`✅ Rep ${newRepCount} completed: ${maxAngleRef.current}° (Set ${currentSet})`);
        
        return newRepCount;
      });

      // Reset session max for next rep
      setMaxAngleThisSession(null);
      maxAngleRef.current = null;
    }
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
    
    const sessionData = {
      reps: repHistory,
      totalReps: reps,
      bestAngle,
      duration,
      baselineROM,
      improvement: bestAngle - baselineROM,
      sessionStartTime,
      sessionEndTime: endTime,
      currentSet,
      setsCompleted
    };
    
    console.log('🏁 Session ended:', sessionData);
    return sessionData;
  }, [reps, repHistory, baselineROM, maxAngleThisSession, sessionStartTime, currentSet, setsCompleted]);

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
    console.log(`📊 Moving to set ${currentSet + 1}`);
  }, [currentSet]);

  /**
   * Load baseline from localStorage on mount
   */
  useEffect(() => {
    const savedBaseline = localStorage.getItem('physio_baseline_rom');
    const savedDate = localStorage.getItem('physio_calibration_date');
    const savedLegSide = localStorage.getItem('physio_baseline_leg_side');

    if (savedBaseline && savedDate) {
      const baselineValue = parseFloat(savedBaseline);
      const calibrationAge = Date.now() - new Date(savedDate).getTime();
      const daysOld = calibrationAge / (1000 * 60 * 60 * 24);
      
      // Only use baseline if it's less than 7 days old and matches current leg side
      if (daysOld < 7 && baselineValue > 30 && (!savedLegSide || savedLegSide === legSideRef.current)) {
        setBaselineROM(baselineValue);
        setCalibrationDate(savedDate);
        setPhase(SESSION_PHASES.EXERCISE);
        console.log(`📌 Loaded baseline ROM: ${baselineValue}° (${Math.round(daysOld)} days old)`);
      } else {
        console.log('⚠️ Baseline expired or leg side mismatch - requiring new calibration');
        localStorage.removeItem('physio_baseline_rom');
        localStorage.removeItem('physio_calibration_date');
        localStorage.removeItem('physio_baseline_leg_side');
      }
    }
  }, []);

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

    // Baseline data
    baselineROM,
    calibrationDate,
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
