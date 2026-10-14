/**
 * ExerciseViewport.jsx (Minimalist Immersive Mode)
 * Exercise-aware tracking with automatic calibration and posture-gated rep counting.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { usePoseEstimation } from '../hooks/usePoseEstimation';
import { useSession, SESSION_PHASES } from '../context/SessionContext';
import { drawLegSkeleton } from '../utils/drawing';
import {
  buildBaselineProfile,
  calculateSessionMetrics,
  calculateExplicitStageScore,
  decideRecoveryStage
} from '../utils/geometry';
import {
  buildExerciseInstruction,
  speakExerciseInstruction,
  repeatLastInstruction,
  muteVoice,
  unmuteVoice
} from '../utils/voiceFeedback';
import { createVoiceCommandController, isVoiceCommandSupported } from '../utils/voiceCommands';
import { cancelSpeech } from '../utils/tts';

const normalizeAngleForExercise = (rawAngle, angleMode) => {
  if (typeof rawAngle !== 'number') return null;

  if (angleMode === 'flexion_rom') {
    return Math.max(0, Math.min(180, 180 - rawAngle));
  }

  return rawAngle;
};

const isFiniteAngle = (value) => typeof value === 'number' && Number.isFinite(value);

const resolveResetThreshold = (peakThreshold, resetThreshold, config = {}, movementPattern = 'increase_then_decrease') => {
  const adaptiveResetFactor = Number.isFinite(config?.adaptiveResetFactor)
    ? config.adaptiveResetFactor
    : null;
  const adaptiveResetMin = Number.isFinite(config?.adaptiveResetMin)
    ? config.adaptiveResetMin
    : null;

  if (!Number.isFinite(adaptiveResetFactor) || !Number.isFinite(peakThreshold) || !Number.isFinite(resetThreshold)) {
    return resetThreshold;
  }

  const adaptiveByPeak = peakThreshold * adaptiveResetFactor;

  if (movementPattern === 'increase_then_decrease') {
    const boostedReset = Math.max(resetThreshold, adaptiveByPeak);
    return Number.isFinite(adaptiveResetMin)
      ? Math.max(boostedReset, adaptiveResetMin)
      : boostedReset;
  }

  const loweredReset = Math.min(resetThreshold, adaptiveByPeak);
  return Number.isFinite(adaptiveResetMin)
    ? Math.min(loweredReset, adaptiveResetMin)
    : loweredReset;
};

const evaluatePosture = (exercise, legSide, leftAngle, rightAngle) => {
  const posture = exercise?.posture || {};
  const minAngle = typeof posture.minAngle === 'number' ? posture.minAngle : 10;
  const maxAngle = typeof posture.maxAngle === 'number' ? posture.maxAngle : 175;
  const requireSymmetry = !!posture.requireSymmetry;
  const maxSideDiff = typeof posture.maxSideDiff === 'number' ? posture.maxSideDiff : 25;

  const leftValid = isFiniteAngle(leftAngle) && leftAngle >= minAngle && leftAngle <= maxAngle;
  const rightValid = isFiniteAngle(rightAngle) && rightAngle >= minAngle && rightAngle <= maxAngle;

  if (legSide === 'left') return leftValid;
  if (legSide === 'right') return rightValid;

  // For bilateral exercises, avoid marking posture incorrect when one side is
  // temporarily unavailable due camera occlusion/noise.
  if (!leftValid && !rightValid) return false;
  if (!requireSymmetry) return leftValid || rightValid;

  if (!(leftValid && rightValid)) return true;

  return Math.abs(leftAngle - rightAngle) <= maxSideDiff;
};

const toCameraErrorMessage = (error) => {
  const name = String(error?.name || '').trim();

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission denied. Allow camera access in browser settings and retry.';
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera device found. Connect/enable a webcam and retry.';
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is busy or unavailable. Close other apps using the camera and retry.';
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Requested camera settings are not supported. Retrying with fallback settings may help.';
  }

  return error?.message || 'Unable to access camera.';
};

const ExerciseViewport = ({ exercise, selectedLeg, onEndSession }) => {
  if (!exercise) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">??</div>
          <h2 className="text-2xl font-bold mb-2">No Exercise Selected</h2>
          <p className="text-gray-400 mb-4">Please select an exercise from the dashboard to begin.</p>
          <button
            onClick={() => onEndSession?.(null)}
            className="bg-medical-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-600 transition-colors"
          >
            ? Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef({ key: null, offsetX: 0, offsetY: 0, panelWidth: 0, panelHeight: 0 });
  const calibrationTrackerRef = useRef({
    inPeak: false,
    peakAngle: 0,
    peakStartedAt: 0,
    lastCaptureAt: 0
  });
  const calibrationSamplesRef = useRef([]);
  const sessionAngleSamplesRef = useRef([]);
  const recentAnglesRef = useRef([]);
  const postureQualityRef = useRef({ goodFrames: 0, totalFrames: 0 });
  const postureWindowRef = useRef([]);
  const lastPostureGoodAtRef = useRef(0);
  const hasStartedSessionRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calibrationReps, setCalibrationReps] = useState([]);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [calibrationScale, setCalibrationScale] = useState(1);
  const [postureState, setPostureState] = useState('neutral');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  const [voiceCommandStatus, setVoiceCommandStatus] = useState('Voice commands off');
  const [voiceListening, setVoiceListening] = useState(false);
  const [latestInstruction, setLatestInstruction] = useState('Voice guidance ready');

  const [overlayPositions, setOverlayPositions] = useState({
    reps: { x: 16, y: 16 },
    metrics: { x: 0, y: 80 },
    form: { x: 16, y: 0 },
    progress: { x: 0, y: 0 },
    calibration: { x: null, y: 16 }
  });

  const baselineROMRef = useRef(null);
  const legSideRef = useRef('left');
  const leftAngleRef = useRef(null);
  const rightAngleRef = useRef(null);
  const voiceCommandControllerRef = useRef(null);
  const voiceCommandHandlerRef = useRef(null);

  const {
    phase,
    setPhase,
    legSide,
    updateAngle,
    detectRep,
    reps,
    baselineROM,
    baselineProfile,
    enableDecisionEngine,
    setBaseline,
    setExerciseContext,
    currentAngle,
    startSession,
    endSession,
    setLegSide,
    setTargetROM
  } = useSession();

  const activeLeg = selectedLeg || legSide || exercise?.legSide || 'left';

  const handleAngleUpdate = useCallback((primaryAngle, angles) => {
    const normalizedPrimary = normalizeAngleForExercise(primaryAngle, exercise?.angleMode);
    const normalizedLeft = normalizeAngleForExercise(angles?.leftAngle, exercise?.angleMode);
    const normalizedRight = normalizeAngleForExercise(angles?.rightAngle, exercise?.angleMode);
    const postureOk = evaluatePosture(exercise, activeLeg, normalizedLeft, normalizedRight);
    const now = performance.now();
    if (postureOk) {
      lastPostureGoodAtRef.current = now;
    }
    const postureGate = postureOk || (now - lastPostureGoodAtRef.current) <= 260;
    const bilateralValues = [normalizedLeft, normalizedRight].filter((value) => isFiniteAngle(value));

    const requireBothLegs = !!exercise?.repDetection?.requireBothLegs;
    const maxRepSideDiff = Number.isFinite(exercise?.repDetection?.maxRepSideDiff)
      ? exercise.repDetection.maxRepSideDiff
      : 16;
    const minActiveAngle = Number.isFinite(exercise?.repDetection?.minActiveAngle)
      ? exercise.repDetection.minActiveAngle
      : 18;
    const bothLegsVisible = isFiniteAngle(normalizedLeft) && isFiniteAngle(normalizedRight);
    const sideDiff = bothLegsVisible ? Math.abs(normalizedLeft - normalizedRight) : Number.POSITIVE_INFINITY;
    const bilateralSymmetric = bothLegsVisible && sideDiff <= maxRepSideDiff;
    const bilateralActive = bothLegsVisible && normalizedLeft >= minActiveAngle && normalizedRight >= minActiveAngle;
    const bilateralRepGate = activeLeg === 'both' && requireBothLegs
      ? (bilateralSymmetric && bilateralActive)
      : true;

    let effectivePrimary = normalizedPrimary;
    if (activeLeg === 'both' && bilateralValues.length > 0) {
      if (exercise?.angleMode === 'flexion_rom') {
        effectivePrimary = Math.max(...bilateralValues);
      } else {
        effectivePrimary = bilateralValues.reduce((sum, value) => sum + value, 0) / bilateralValues.length;
      }
    }

    if (isFiniteAngle(effectivePrimary)) {
      recentAnglesRef.current.push(effectivePrimary);
      if (recentAnglesRef.current.length > 18) {
        recentAnglesRef.current.shift();
      }

      const movementDeltaThreshold = Number.isFinite(exercise?.posture?.movementDeltaThreshold)
        ? exercise.posture.movementDeltaThreshold
        : 6;
      const recentAngles = recentAnglesRef.current.filter((value) => Number.isFinite(value));
      const movementRange = recentAngles.length > 1
        ? Math.max(...recentAngles) - Math.min(...recentAngles)
        : 0;
      const isMovementActive = movementRange >= movementDeltaThreshold;

      if (phase === SESSION_PHASES.EXERCISE && isMovementActive) {
        postureQualityRef.current.totalFrames += 1;
        if (postureOk) {
          postureQualityRef.current.goodFrames += 1;
        }

        postureWindowRef.current.push(postureOk);
        if (postureWindowRef.current.length > 24) {
          postureWindowRef.current.shift();
        }
      }

      if (phase === SESSION_PHASES.EXERCISE && postureGate && bilateralRepGate) {
        sessionAngleSamplesRef.current.push(effectivePrimary);
        if (sessionAngleSamplesRef.current.length > 3600) {
          sessionAngleSamplesRef.current.shift();
        }
      }

      updateAngle(effectivePrimary);
      detectRep(effectivePrimary, exercise?.repDetection || null, postureGate && bilateralRepGate);
    }
  }, [activeLeg, detectRep, exercise, phase, updateAngle]);

  const {
    isInitialized,
    error: poseError,
    processFrame,
    leftAngle: detectedLeftAngle,
    rightAngle: detectedRightAngle
  } = usePoseEstimation({
    legSide: activeLeg,
    enableSmoothing: true,
    metricMode: exercise?.angleMode || 'inner_knee_angle',
    angleComputationMode: 'auto',
    onAngleUpdate: handleAngleUpdate,
    minDetectionConfidence: 0.5,
    minPresenceConfidence: 0.5
  });

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const derivedSet = Math.min(
    exercise.targetSets || 1,
    Math.floor((reps || 0) / Math.max(1, exercise.targetReps || 1)) + 1
  );

  const repeatCurrentInstruction = useCallback(() => {
    const repeated = repeatLastInstruction();
    if (repeated) {
      setLatestInstruction(repeated);
      setVoiceCommandStatus('Repeated latest instruction');
      return;
    }

    setLatestInstruction('No instruction available yet.');
    setVoiceCommandStatus('No instruction available yet.');
  }, []);

  const handleExitSession = useCallback(() => {
    cancelSpeech();
    voiceCommandControllerRef.current?.stop();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    const sessionData = endSession();
    const postureTotals = postureQualityRef.current;
    const postureAccuracy = postureTotals.totalFrames > 0
      ? Math.round((postureTotals.goodFrames / postureTotals.totalFrames) * 100)
      : (postureState === 'incorrect' ? 0 : 100);
    let cleanedSessionMetrics = null;
    let stageScoreBreakdown = null;
    let stageDecision = 'Unknown';

    if (enableDecisionEngine) {
      try {
        const decisionConfig = exercise?.decisionEngine || {};
        cleanedSessionMetrics = calculateSessionMetrics(
          sessionAngleSamplesRef.current,
          decisionConfig.sessionCleaning || {}
        );

        stageScoreBreakdown = calculateExplicitStageScore({
          angle: cleanedSessionMetrics?.extension,
          stability: cleanedSessionMetrics?.stability,
          reps: sessionData?.totalReps || 0,
          baselineProfile: baselineProfile || null,
          config: decisionConfig
        });

        stageDecision = decideRecoveryStage(
          stageScoreBreakdown.totalScore,
          decisionConfig.decisionThresholds || {}
        );

        console.log(`📈 Stage decision: ${stageDecision} (${stageScoreBreakdown.totalScore}/100)`);
      } catch (err) {
        console.error('❌ Decision engine computation failed, falling back to default:', err);
      }
    }

    onEndSession?.({
      ...sessionData,
      postureAccuracy,
      setsCompleted: Math.floor((sessionData?.totalReps || 0) / Math.max(1, exercise.targetReps || 1)),
      currentSet: derivedSet,
      baselineProfile: baselineProfile || null,
      sessionMetrics: cleanedSessionMetrics,
      stageScore: stageScoreBreakdown?.totalScore || 0,
      stageDecision,
      stageDecisionBreakdown: stageScoreBreakdown
    });
  }, [baselineProfile, derivedSet, enableDecisionEngine, endSession, exercise, onEndSession, postureState]);

  const handleVoiceCommand = useCallback((command) => {
    if (!command) return;

    if (command === 'start') {
      setVoiceCommandStatus(phase === SESSION_PHASES.EXERCISE
        ? 'Session is already active.'
        : 'Complete calibration using the on-screen flow before starting.');
      return;
    }

    if (command === 'stop') {
      setVoiceCommandStatus('Stopping session');
      handleExitSession();
      return;
    }

    if (command === 'repeat') {
      repeatCurrentInstruction();
      return;
    }

    if (command === 'mute') {
      setVoiceEnabled(false);
      muteVoice();
      setVoiceCommandStatus('Voice muted');
      return;
    }

    if (command === 'unmute') {
      setVoiceEnabled(true);
      unmuteVoice();
      setVoiceCommandStatus('Voice unmuted');
      return;
    }

    if (command === 'next') {
      setVoiceCommandStatus('Next exercise navigation is not available in this screen.');
    }
  }, [handleExitSession, phase, repeatCurrentInstruction]);

  voiceCommandHandlerRef.current = handleVoiceCommand;

  const normalizedLeftAngle = normalizeAngleForExercise(detectedLeftAngle, exercise?.angleMode);
  const normalizedRightAngle = normalizeAngleForExercise(detectedRightAngle, exercise?.angleMode);
  const postureAccurate = evaluatePosture(exercise, activeLeg, normalizedLeftAngle, normalizedRightAngle);

  useEffect(() => {
    if (phase !== SESSION_PHASES.EXERCISE) {
      setPostureState('neutral');
      postureWindowRef.current = [];
      return;
    }

    const movementDeltaThreshold = Number.isFinite(exercise?.posture?.movementDeltaThreshold)
      ? exercise.posture.movementDeltaThreshold
      : 6;
    const recentAngles = recentAnglesRef.current.filter((value) => Number.isFinite(value));
    const movementRange = recentAngles.length > 1
      ? Math.max(...recentAngles) - Math.min(...recentAngles)
      : 0;
    const isMovementActive = movementRange >= movementDeltaThreshold;

    if (!isMovementActive) {
      setPostureState('neutral');
      postureWindowRef.current = [];
      return;
    }

    const postureVotes = postureWindowRef.current;
    if (!postureVotes.length) {
      setPostureState(postureAccurate ? 'correct' : 'incorrect');
      return;
    }

    const correctVotes = postureVotes.filter(Boolean).length;
    const postureRatio = correctVotes / postureVotes.length;
    setPostureState(postureRatio >= 0.65 ? 'correct' : 'incorrect');
  }, [currentAngle, exercise, phase, postureAccurate]);
  useEffect(() => {
    baselineROMRef.current = baselineROM;
  }, [baselineROM]);

  useEffect(() => {
    legSideRef.current = legSide;
  }, [legSide]);

  useEffect(() => {
    leftAngleRef.current = normalizedLeftAngle;
  }, [normalizedLeftAngle]);

  useEffect(() => {
    rightAngleRef.current = normalizedRightAngle;
  }, [normalizedRightAngle]);

  const getPanelStyle = useCallback((key) => {
    const pos = overlayPositions[key];
    if (!pos) return {};

    if (key === 'metrics') {
      return { right: `${Math.max(16, pos.x)}px`, top: `${Math.max(16, pos.y)}px` };
    }
    if (key === 'form') {
      return { left: `${Math.max(8, pos.x)}px`, bottom: `${Math.max(8, pos.y)}px` };
    }
    if (key === 'progress') {
      return { left: `${Math.max(80, pos.x)}px`, right: `${Math.max(24, pos.y)}px`, bottom: '16px' };
    }
    if (key === 'calibration') {
      const hasManualPosition = typeof pos.x === 'number';
      return {
        left: hasManualPosition ? `${Math.round(pos.x)}px` : '50%',
        top: `${Math.round(Math.max(8, pos.y))}px`,
        transform: hasManualPosition
          ? `scale(${calibrationScale})`
          : `translateX(-50%) scale(${calibrationScale})`,
        transformOrigin: 'top left'
      };
    }

    return { left: `${Math.max(8, pos.x)}px`, top: `${Math.max(8, pos.y)}px` };
  }, [calibrationScale, overlayPositions]);

  const startDrag = useCallback((event, key) => {
    if (!containerRef.current) return;

    // Allow buttons/controls inside draggable panels to remain clickable.
    if (event.target?.closest?.('[data-no-drag="true"]')) {
      return;
    }

    event.preventDefault();

    const panelRect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      key,
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = dragStateRef.current;
      if (!drag.key || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - containerRect.left - drag.offsetX;
      const y = event.clientY - containerRect.top - drag.offsetY;

      setOverlayPositions((prev) => {
        if (drag.key === 'metrics') {
          const right = Math.max(8, containerRect.width - (x + 180));
          return { ...prev, metrics: { x: right, y: Math.max(8, y) } };
        }

        if (drag.key === 'form') {
          const bottom = Math.max(8, containerRect.height - (y + 120));
          return { ...prev, form: { x: Math.max(8, x), y: bottom } };
        }

        if (drag.key === 'calibration') {
          const maxX = Math.max(8, containerRect.width - (drag.panelWidth || 360) - 8);
          const maxY = Math.max(8, containerRect.height - (drag.panelHeight || 120) - 8);

          return {
            ...prev,
            calibration: {
              x: Math.max(8, Math.min(maxX, x)),
              y: Math.max(8, Math.min(maxY, y))
            }
          };
        }

        return {
          ...prev,
          [drag.key]: { x: Math.max(8, x), y: Math.max(8, y) }
        };
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = { key: null, offsetX: 0, offsetY: 0, panelWidth: 0, panelHeight: 0 };
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (phase !== SESSION_PHASES.CALIBRATION) return;

    setOverlayPositions((prev) => {
      if (typeof prev.calibration?.x === 'number') return prev;

      const containerRect = containerRef.current.getBoundingClientRect();
      const estimatedPanelWidth = 360;
      const centeredX = Math.max(8, (containerRect.width - estimatedPanelWidth) / 2);

      return {
        ...prev,
        calibration: {
          x: centeredX,
          y: Math.max(8, prev.calibration?.y ?? 16)
        }
      };
    });
  }, [phase]);

  useEffect(() => {
    setLegSide(activeLeg);
    setExerciseContext({
      exerciseId: exercise?.id || null,
      angleMode: exercise?.angleMode || 'inner_knee_angle'
    });
    if (exercise?.targetAngle) {
      setTargetROM(exercise.targetAngle);
    }
  }, [activeLeg, exercise, setExerciseContext, setLegSide, setTargetROM]);

  useEffect(() => {
    if (cameraReady && isInitialized && phase === SESSION_PHASES.SETUP) {
      setPhase(SESSION_PHASES.CALIBRATION);
    }
  }, [cameraReady, isInitialized, phase, setPhase]);

  useEffect(() => {
    if (phase === SESSION_PHASES.EXERCISE) {
      setIsCalibrating(false);
    }
  }, [phase]);

  useEffect(() => {
    if (!voiceEnabled || phase !== SESSION_PHASES.EXERCISE) {
      return;
    }

    const instruction = buildExerciseInstruction({
      exerciseName: exercise?.name,
      postureState,
      currentAngle,
      baselineROM
    });

    if (!instruction) {
      return;
    }

    const spokenInstruction = speakExerciseInstruction({
      exerciseName: exercise?.name,
      postureState,
      currentAngle,
      baselineROM,
      forced: false
    });

    if (spokenInstruction) {
      setLatestInstruction(spokenInstruction);
      setVoiceCommandStatus('Voice guidance active');
    }
  }, [baselineROM, currentAngle, exercise?.name, phase, postureState, voiceEnabled]);

  const toggleVoiceCommands = () => {
    if (voiceCommandControllerRef.current) {
      voiceCommandControllerRef.current.destroy();
      voiceCommandControllerRef.current = null;
      setVoiceCommandsEnabled(false);
      setVoiceListening(false);
      setVoiceCommandStatus('Voice commands off');
      return;
    }

    if (!isVoiceCommandSupported()) {
      setVoiceCommandStatus('Voice commands are not supported in this browser. Try Chrome or Edge on localhost or HTTPS.');
      return;
    }

    const controller = createVoiceCommandController({
      onCommand: (command) => voiceCommandHandlerRef.current?.(command),
      onStatusChange: (status) => {
        setVoiceCommandStatus(status);
        setVoiceListening(status.toLowerCase().includes('listening'));
      },
      onError: (errorName) => {
        setVoiceListening(false);
        if (errorName === 'not-allowed' || errorName === 'service-not-allowed') {
          voiceCommandControllerRef.current?.destroy();
          voiceCommandControllerRef.current = null;
          setVoiceCommandsEnabled(false);
        }
      }
    });

    voiceCommandControllerRef.current = controller;
    setVoiceCommandsEnabled(true);
    controller.start();
  };

  useEffect(() => {
    return () => {
      cancelSpeech();
      voiceCommandControllerRef.current?.destroy();
      voiceCommandControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase === SESSION_PHASES.CALIBRATION) {
      setIsCalibrating(true);
      setCalibrationReps([]);
      calibrationSamplesRef.current = [];
      sessionAngleSamplesRef.current = [];
      recentAnglesRef.current = [];
      postureQualityRef.current = { goodFrames: 0, totalFrames: 0 };
      postureWindowRef.current = [];
      lastPostureGoodAtRef.current = 0;
      calibrationTrackerRef.current = {
        inPeak: false,
        peakAngle: 0,
        peakStartedAt: 0,
        lastCaptureAt: 0
      };
    }
  }, [phase]);

  useEffect(() => {
    if (phase === SESSION_PHASES.EXERCISE && !isCalibrating && !hasStartedSessionRef.current) {
      sessionAngleSamplesRef.current = [];
      postureQualityRef.current = { goodFrames: 0, totalFrames: 0 };
      postureWindowRef.current = [];
      startSession();
      hasStartedSessionRef.current = true;
    }

    if (phase !== SESSION_PHASES.EXERCISE) {
      hasStartedSessionRef.current = false;
    }
  }, [phase, isCalibrating, startSession]);

  useEffect(() => {
    if (phase !== SESSION_PHASES.CALIBRATION || !isFiniteAngle(currentAngle)) {
      return;
    }

    const bilateralVisible = isFiniteAngle(normalizedLeftAngle) || isFiniteAngle(normalizedRightAngle);
    const bothLegsVisibleForCalibration = isFiniteAngle(normalizedLeftAngle) && isFiniteAngle(normalizedRightAngle);
    const maxCalibrationSideDiff = Number.isFinite(exercise?.calibration?.maxCalibrationSideDiff)
      ? exercise.calibration.maxCalibrationSideDiff
      : 20;
    const minCalibrationActiveAngle = Number.isFinite(exercise?.calibration?.minCalibrationActiveAngle)
      ? exercise.calibration.minCalibrationActiveAngle
      : 18;
    const calibrationSideDiff = bothLegsVisibleForCalibration
      ? Math.abs(normalizedLeftAngle - normalizedRightAngle)
      : Number.POSITIVE_INFINITY;
    const bilateralCalibrationGate = activeLeg === 'both'
      ? (
        bothLegsVisibleForCalibration &&
        calibrationSideDiff <= maxCalibrationSideDiff &&
        normalizedLeftAngle >= minCalibrationActiveAngle &&
        normalizedRightAngle >= minCalibrationActiveAngle
      )
      : bilateralVisible;

    const calibrationPostureOk = activeLeg === 'both' ? bilateralCalibrationGate : postureAccurate;
    const calibrationGate = calibrationPostureOk || (performance.now() - lastPostureGoodAtRef.current <= 260);

    if (calibrationGate) {
      calibrationSamplesRef.current.push(currentAngle);
      if (calibrationSamplesRef.current.length > 1200) {
        calibrationSamplesRef.current.shift();
      }
    }

    const config = exercise?.calibration || {};
    const movementPattern = config?.movementPattern || 'increase_then_decrease';
    const peakThreshold = typeof config.peakThreshold === 'number' ? config.peakThreshold : Math.max(20, (exercise?.targetAngle || 90) * 0.35);
    const resetThreshold = typeof config.resetThreshold === 'number' ? config.resetThreshold : Math.max(8, peakThreshold * 0.45);
    const effectiveResetThreshold = resolveResetThreshold(peakThreshold, resetThreshold, config, movementPattern);
    const minPeakHoldTime = typeof config.minPeakHoldTime === 'number' ? config.minPeakHoldTime : 220;
    const minRepInterval = typeof config.minRepInterval === 'number' ? config.minRepInterval : 650;

    const tracker = calibrationTrackerRef.current;
    const now = Date.now();

    if (!tracker.inPeak && currentAngle >= peakThreshold && calibrationGate) {
      tracker.inPeak = true;
      tracker.peakAngle = currentAngle;
      tracker.peakStartedAt = now;
      return;
    }

    if (!tracker.inPeak) {
      return;
    }

    tracker.peakAngle = Math.max(tracker.peakAngle, currentAngle);

    if (currentAngle > effectiveResetThreshold) {
      return;
    }

    const heldLongEnough = now - tracker.peakStartedAt >= minPeakHoldTime;
    const intervalPassed = now - tracker.lastCaptureAt >= minRepInterval;

    if (heldLongEnough && intervalPassed && calibrationGate) {
      tracker.lastCaptureAt = now;

      setCalibrationReps((prev) => {
        if (prev.length >= 3) return prev;
        const next = [...prev, Math.round(tracker.peakAngle)];

        if (next.length === 3) {
          const baselineCleaningConfig = {
            minSamples: Number.isFinite(exercise?.decisionEngine?.baselineCleaning?.minSamples)
              ? exercise.decisionEngine.baselineCleaning.minSamples
              : 30,
            lowerPercentile: Number.isFinite(exercise?.decisionEngine?.baselineCleaning?.lowerPercentile)
              ? exercise.decisionEngine.baselineCleaning.lowerPercentile
              : 10,
            upperPercentile: Number.isFinite(exercise?.decisionEngine?.baselineCleaning?.upperPercentile)
              ? exercise.decisionEngine.baselineCleaning.upperPercentile
              : 90
          };

          const cleanedProfile = buildBaselineProfile(calibrationSamplesRef.current, {
            minSamples: baselineCleaningConfig.minSamples,
            lowerPercentile: baselineCleaningConfig.lowerPercentile,
            upperPercentile: baselineCleaningConfig.upperPercentile
          });

          if (cleanedProfile) {
            const cleanedBaseline = Math.round(cleanedProfile.maxAngle);
            setBaseline(cleanedBaseline, cleanedProfile);
            console.log(`✅ Cleaned baseline profile applied (${cleanedProfile.sampleCount}/${cleanedProfile.rawSampleCount} samples)`);
          } else {
            const avgBaseline = Math.round(next.reduce((sum, angle) => sum + angle, 0) / next.length);
            setBaseline(avgBaseline);
            console.log('ℹ️ Calibration sample size too low for outlier cleaning, using 3-rep average baseline');
          }

          setIsCalibrating(false);
          setPhase(SESSION_PHASES.EXERCISE);
        }

        return next;
      });
    }

    tracker.inPeak = false;
    tracker.peakAngle = 0;
    tracker.peakStartedAt = 0;
  }, [activeLeg, currentAngle, exercise, normalizedLeftAngle, normalizedRightAngle, phase, postureAccurate, setBaseline, setPhase]);

  useEffect(() => {
    let cancelled = false;
    let activeStream = null;

    const startCamera = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available in this browser.');
        }

        setCameraError(null);
        setCameraReady(false);

        const baseConstraints = isMobile ? {
          width: { ideal: 854 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 }
        };

        let preferredDeviceId = null;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((device) => device.kind === 'videoinput');

          if (videoInputs.length === 0) {
            throw Object.assign(new Error('No camera device found'), { name: 'NotFoundError' });
          }

          preferredDeviceId = videoInputs[0]?.deviceId || null;
        } catch (deviceError) {
          // Continue to getUserMedia attempts if enumeration fails due permissions.
          if (deviceError?.name === 'NotFoundError') {
            throw deviceError;
          }
        }

        const attempts = [
          {
            video: {
              ...baseConstraints,
              facingMode: 'user'
            },
            audio: false
          },
          {
            video: {
              ...baseConstraints,
              ...(preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : {})
            },
            audio: false
          },
          {
            video: true,
            audio: false
          }
        ];

        let stream = null;
        let lastError = null;

        for (const constraints of attempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (attemptError) {
            lastError = attemptError;
          }
        }

        if (!stream) {
          throw lastError || new Error('Unable to open camera stream.');
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        activeStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      } catch (err) {
        console.error('Camera error:', err);
        if (!cancelled) {
          setCameraReady(false);
          setCameraError(toCameraErrorMessage(err));
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;

      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isMobile]);

  useEffect(() => {
    if (!cameraReady || !isInitialized || !canvasRef.current || !videoRef.current) return;

    const renderLoop = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video || video.paused || video.ended) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timestamp = performance.now();
      const poseData = await processFrame(video, timestamp);

      if (poseData && poseData.landmarks) {
        const postureColor = postureState === 'neutral'
          ? 'white'
          : postureState === 'correct'
            ? 'green'
            : 'red';

        const leftLegColor = activeLeg === 'left' || activeLeg === 'both' ? postureColor : 'gray';
        const rightLegColor = activeLeg === 'right' || activeLeg === 'both' ? postureColor : 'gray';

        drawLegSkeleton(ctx, poseData.landmarks, {
          leftLegColor,
          rightLegColor,
          leftAngle: leftAngleRef.current,
          rightAngle: rightAngleRef.current,
          lineWidth: 5,
          legSide: legSideRef.current
        });
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeLeg, cameraReady, isInitialized, postureState, processFrame]);

  useEffect(() => {
    const enterFullscreen = async () => {
      if (containerRef.current && !document.fullscreenElement) {
        try {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        } catch (err) {
          console.warn('Could not auto-enter fullscreen:', err);
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const timer = setTimeout(enterFullscreen, 100);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const getFormQuality = () => {
    if (postureState === 'neutral' || !isFiniteAngle(currentAngle)) return 'neutral';
    if (postureState === 'incorrect') return 'poor';
    if (currentAngle >= exercise.targetAngle) return 'excellent';
    if (baselineROM && currentAngle >= baselineROM) return 'good';
    return 'poor';
  };

  const formQuality = getFormQuality();
  const repConfig = exercise?.repDetection || {};
  const calibrationConfig = exercise?.calibration || {};
  const repMovementPattern = repConfig?.movementPattern || 'increase_then_decrease';
  const calibrationMovementPattern = calibrationConfig?.movementPattern || 'increase_then_decrease';
  const repPeakThreshold = Number.isFinite(repConfig.peakThreshold) ? repConfig.peakThreshold : null;
  const repResetThreshold = Number.isFinite(repConfig.resetThreshold) ? repConfig.resetThreshold : null;
  const effectiveRepResetThreshold = Number.isFinite(repPeakThreshold) && Number.isFinite(repResetThreshold)
    ? resolveResetThreshold(repPeakThreshold, repResetThreshold, repConfig, repMovementPattern)
    : repResetThreshold;
  const calibrationPeakThreshold = Number.isFinite(calibrationConfig.peakThreshold) ? calibrationConfig.peakThreshold : null;
  const calibrationResetThreshold = Number.isFinite(calibrationConfig.resetThreshold) ? calibrationConfig.resetThreshold : null;
  const effectiveCalibrationResetThreshold = Number.isFinite(calibrationPeakThreshold) && Number.isFinite(calibrationResetThreshold)
    ? resolveResetThreshold(calibrationPeakThreshold, calibrationResetThreshold, calibrationConfig, calibrationMovementPattern)
    : calibrationResetThreshold;
  const movementDeltaThreshold = Number.isFinite(exercise?.posture?.movementDeltaThreshold)
    ? exercise.posture.movementDeltaThreshold
    : 6;
  const recentDebugAngles = recentAnglesRef.current.filter((value) => Number.isFinite(value));
  const debugMovementRange = recentDebugAngles.length > 1
    ? Math.max(...recentDebugAngles) - Math.min(...recentDebugAngles)
    : 0;
  const debugMovementActive = debugMovementRange >= movementDeltaThreshold;
  const repRequiresBoth = !!exercise?.repDetection?.requireBothLegs;
  const debugMaxRepSideDiff = Number.isFinite(exercise?.repDetection?.maxRepSideDiff)
    ? exercise.repDetection.maxRepSideDiff
    : 16;
  const debugMinActiveAngle = Number.isFinite(exercise?.repDetection?.minActiveAngle)
    ? exercise.repDetection.minActiveAngle
    : 18;
  const debugBothVisible = isFiniteAngle(normalizedLeftAngle) && isFiniteAngle(normalizedRightAngle);
  const debugSideDiff = debugBothVisible ? Math.abs(normalizedLeftAngle - normalizedRightAngle) : Number.POSITIVE_INFINITY;
  const debugBilateralPass = !repRequiresBoth || activeLeg !== 'both'
    ? true
    : (
      debugBothVisible &&
      debugSideDiff <= debugMaxRepSideDiff &&
      normalizedLeftAngle >= debugMinActiveAngle &&
      normalizedRightAngle >= debugMinActiveAngle
    );
  const postureTotals = postureQualityRef.current;
  const livePostureAccuracy = postureTotals.totalFrames > 0
    ? Math.round((postureTotals.goodFrames / postureTotals.totalFrames) * 100)
    : 0;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'scaleX(-1)' }}
      />

      <AnimatePresence>
        {cameraReady && isInitialized && (phase === SESSION_PHASES.CALIBRATION || phase === SESSION_PHASES.EXERCISE) && (
          <>
            {phase === SESSION_PHASES.EXERCISE && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-30 cursor-move touch-none"
                style={getPanelStyle('reps')}
                onPointerDown={(e) => startDrag(e, 'reps')}
              >
                <div className="bg-gradient-to-br from-teal-600/90 to-cyan-700/90 backdrop-blur-md rounded-2xl px-5 py-4 shadow-2xl border border-white/20">
                  <div className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-0.5">Reps</div>
                  <motion.div
                    key={reps}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-white text-5xl font-black leading-none"
                  >
                    {reps}
                  </motion.div>
                  <div className="text-teal-200 text-xs font-medium mt-1">/ {exercise.targetReps * exercise.targetSets} total</div>
                  {exercise.targetSets > 1 && (
                    <div className="text-white/60 text-xs mt-0.5">Set {derivedSet}/{exercise.targetSets}</div>
                  )}
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute z-30 cursor-move touch-none"
              style={getPanelStyle('metrics')}
              onPointerDown={(e) => startDrag(e, 'metrics')}
            >
              <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl w-[190px]">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {exercise.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="text-white font-bold text-xs leading-tight truncate">{exercise.name}</h2>
                    <div className="text-teal-400 text-[10px] font-semibold uppercase">
                      {activeLeg === 'both' ? 'both legs' : `${activeLeg} leg`}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {phase === SESSION_PHASES.CALIBRATION ? (
                    <div className="text-center py-1">
                      <span className="text-yellow-400 text-xs font-bold animate-pulse">AUTO CALIBRATING...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px]">Set</span>
                      <span className="text-white text-xs font-bold">{derivedSet} / {exercise.targetSets}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Target</span>
                    <span className="text-cyan-400 text-xs font-bold">{exercise.targetAngle} deg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Baseline</span>
                    <span className="text-amber-400 text-xs font-bold">{baselineROM || '--'} deg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Current</span>
                    <span className="text-teal-400 text-xs font-bold">{Math.round(currentAngle || 0)} deg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Posture</span>
                    <span className={`text-xs font-bold ${
                      postureState === 'incorrect'
                        ? 'text-red-400'
                        : postureState === 'correct'
                          ? 'text-green-400'
                          : 'text-white'
                    }`}>
                      {postureState === 'incorrect'
                        ? 'Adjust'
                        : postureState === 'correct'
                          ? 'Correct'
                          : 'Neutral'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {phase === SESSION_PHASES.EXERCISE && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute z-30"
                style={{ right: '18px', top: '96px' }}
              >
                <div className="bg-black/80 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-2xl w-[230px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">Voice Guidance</span>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${voiceEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {voiceEnabled ? (voiceListening ? 'Listening' : 'Ready') : 'Muted'}
                    </span>
                  </div>

                  <p className="text-white text-[11px] leading-relaxed min-h-[40px]">{latestInstruction}</p>

                  <div className="mt-3 text-[10px] text-gray-300">{voiceCommandStatus}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (voiceEnabled) {
                          muteVoice();
                          setVoiceEnabled(false);
                          setVoiceCommandStatus('Voice muted');
                        } else {
                          unmuteVoice();
                          setVoiceEnabled(true);
                          setVoiceCommandStatus('Voice enabled');
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 text-white text-[10px] font-medium hover:bg-white/20 transition"
                    >
                      {voiceEnabled ? 'Mute' : 'Unmute'}
                    </button>
                    <button
                      type="button"
                      onClick={repeatCurrentInstruction}
                      className="px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-200 text-[10px] font-medium hover:bg-cyan-500/30 transition"
                    >
                      Repeat
                    </button>
                    <button
                      type="button"
                      onClick={toggleVoiceCommands}
                      className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-200 text-[10px] font-medium hover:bg-purple-500/30 transition"
                    >
                      {voiceCommandsEnabled ? 'Disable' : 'Enable'} Voice Commands
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === SESSION_PHASES.EXERCISE && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-30 cursor-move touch-none"
                style={getPanelStyle('form')}
                onPointerDown={(e) => startDrag(e, 'form')}
              >
                <div className="bg-black/80 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-2xl">
                  <div className="text-white/70 text-[10px] font-semibold mb-2 text-center tracking-widest uppercase">Form</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { key: 'neutral', color: '#FFFFFF', glow: 'rgba(255,255,255,0.8)', label: 'Neutral' },
                      { key: 'excellent', color: '#10B981', glow: 'rgba(16,185,129,0.8)', label: 'Excellent' },
                      { key: 'good', color: '#F59E0B', glow: 'rgba(245,158,11,0.8)', label: 'Good' },
                      { key: 'poor', color: '#EF4444', glow: 'rgba(239,68,68,0.8)', label: 'Needs work' },
                    ].map(({ key, color, glow, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <motion.div
                          animate={{
                            backgroundColor: formQuality === key ? color : '#1F2937',
                            boxShadow: formQuality === key ? `0 0 14px ${glow}` : 'none',
                          }}
                          className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                        />
                        <span className={`text-[10px] font-medium ${formQuality === key ? 'text-white' : 'text-gray-600'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {phase === SESSION_PHASES.EXERCISE && currentAngle && baselineROM && exercise && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-[160px] right-[72px] z-20"
              >
                <div className="bg-black/75 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 shadow-xl">
                  <div className="flex justify-between text-[10px] mb-2">
                    <span className="text-teal-400 font-bold">{Math.round(currentAngle)} deg now</span>
                    <span className="text-gray-400">Base: {baselineROM} deg</span>
                    <span className="text-cyan-400 font-bold">Target: {exercise.targetAngle} deg</span>
                  </div>
                  <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
                      style={{ left: `${Math.min(100, (baselineROM / Math.max(1, exercise.targetAngle)) * 100)}%` }}
                    />
                    <motion.div
                      animate={{ width: `${Math.min(100, (currentAngle / Math.max(1, exercise.targetAngle)) * 100)}%` }}
                      className={`absolute h-full rounded-full ${
                        currentAngle >= exercise.targetAngle
                          ? 'bg-gradient-to-r from-green-500 to-green-400'
                          : currentAngle >= baselineROM
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-400'
                          : 'bg-gradient-to-r from-red-500 to-orange-400'
                      }`}
                      transition={{ duration: 0.15 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {cameraReady && isInitialized && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExitSession}
          className="absolute top-4 right-4 bg-red-500/90 backdrop-blur-md p-3 rounded-full hover:bg-red-600 transition-all z-40 shadow-2xl border-2 border-red-400/30"
          title="End Session"
        >
          <X className="w-5 h-5 text-white" />
        </motion.button>
      )}

      {phase === SESSION_PHASES.CALIBRATION && (
        <div
          className="absolute z-50 select-none origin-top pointer-events-auto"
          style={{ ...getPanelStyle('calibration'), maxWidth: 'calc(100% - 280px)' }}
        >
          <div className="bg-yellow-500/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-2xl pointer-events-auto">
            <div
              className="cursor-move rounded-lg bg-black/15 px-2 py-1 text-[10px] text-white/90 text-center mb-2 touch-none"
              onPointerDown={(e) => startDrag(e, 'calibration')}
            >
              Drag calibration box
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-white font-bold text-base text-center flex-1">
                Calibration ({calibrationReps.length}/3)
              </p>
              <div className="flex items-center gap-1 pointer-events-auto">
                <button
                  data-no-drag="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCalibrationScale((prev) => Math.max(0.8, +(prev - 0.1).toFixed(2)))}
                  className="text-white/90 bg-black/25 px-2 py-0.5 rounded-md text-xs"
                  type="button"
                >
                  A-
                </button>
                <button
                  data-no-drag="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCalibrationScale((prev) => Math.min(1.4, +(prev + 0.1).toFixed(2)))}
                  className="text-white/90 bg-black/25 px-2 py-0.5 rounded-md text-xs"
                  type="button"
                >
                  A+
                </button>
              </div>
            </div>
            <p className="text-white/80 text-xs text-center">Perform 3 smooth reps. Recording is automatic.</p>
            {currentAngle && (
              <p className="text-white font-mono text-3xl text-center mt-1 font-black">{Math.round(currentAngle)} deg</p>
            )}

            <div className="flex gap-2 justify-center mt-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                    calibrationReps[i]
                      ? 'bg-green-500 border-green-600 text-white'
                      : 'bg-white/20 border-white/40 text-white/60'
                  }`}
                >
                  {calibrationReps[i] ? '?' : i + 1}
                </div>
              ))}
            </div>

            <p className="text-white/80 text-[10px] text-center mt-2">
              Drag this box to move it. Use A- / A+ to adjust size.
            </p>
          </div>
        </div>
      )}

      {(!cameraReady || !isInitialized) && !cameraError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        >
          <div className="text-white text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 border-4 border-medical-primary border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-xl font-semibold">
              {!cameraReady ? 'Starting camera...' : 'Loading AI...'}
            </p>
          </div>
        </motion.div>
      )}

      {(cameraError || poseError) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        >
          <div className="bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <h3 className="text-2xl font-bold text-white mb-4">?? Error</h3>
            <p className="text-white/80 mb-6">{cameraError || poseError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white text-red-600 rounded-xl font-semibold hover:bg-gray-100 transition"
            >
              Reload
            </button>
          </div>
        </motion.div>
      )}

      {cameraReady && isInitialized && (
        <div className="absolute left-2 right-2 bottom-2 z-50 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm border border-white/20 rounded-md px-2 py-1 text-[10px] leading-tight font-mono text-white/95 overflow-hidden">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>DBG</span>
              <span>phase:{phase}</span>
              <span>leg:{activeLeg}</span>
              <span>mode:auto</span>
              <span>L:{isFiniteAngle(normalizedLeftAngle) ? normalizedLeftAngle.toFixed(1) : '--'}</span>
              <span>R:{isFiniteAngle(normalizedRightAngle) ? normalizedRightAngle.toFixed(1) : '--'}</span>
              <span>C:{isFiniteAngle(currentAngle) ? currentAngle.toFixed(1) : '--'}</span>
              <span>mv:{debugMovementRange.toFixed(1)}/{movementDeltaThreshold}</span>
              <span>mvOn:{debugMovementActive ? 'Y' : 'N'}</span>
              <span>bothVis:{debugBothVisible ? 'Y' : 'N'}</span>
              <span>dLR:{Number.isFinite(debugSideDiff) ? debugSideDiff.toFixed(1) : '--'}/{debugMaxRepSideDiff}</span>
              <span>bGate:{debugBilateralPass ? 'Y' : 'N'}</span>
              <span>posture:{postureState}</span>
              <span>acc:{livePostureAccuracy}%</span>
              <span>rep:{reps}</span>
              <span>rPk:{repPeakThreshold ?? '--'}</span>
              <span>rRs:{effectiveRepResetThreshold ?? '--'}</span>
              <span>cRep:{calibrationReps.length}/3</span>
              <span>cPk:{calibrationPeakThreshold ?? '--'}</span>
              <span>cRs:{effectiveCalibrationResetThreshold ?? '--'}</span>
              <span>b:{baselineROM ?? '--'}</span>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && null}
    </div>
  );
};

export default ExerciseViewport;
