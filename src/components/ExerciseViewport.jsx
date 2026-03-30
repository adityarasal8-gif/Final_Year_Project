/**
 * ExerciseViewport.jsx (Minimalist Immersive Mode)
 * Clean exercise screen with minimal distractions
 * Features: Traffic light indicator, large rep counter, press & hold to end
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoseEstimation } from '../hooks/usePoseEstimation';
import { useSession } from '../context/SessionContext';
import { FEEDBACK_STATES, SESSION_PHASES } from '../context/SessionContext';
import {
  drawLegSkeleton,
  areLowerBodyLandmarksVisible
} from '../utils/drawing';
import { Maximize2, Minimize2, X, Check } from 'lucide-react';

/**
 * Minimalist Exercise Viewport for immersive experience
 */
const ExerciseViewport = ({ exercise, selectedLeg, onEndSession }) => {
  // Validate that exercise is provided
  if (!exercise) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">No Exercise Selected</h2>
          <p className="text-gray-400 mb-4">Please select an exercise from the dashboard to begin.</p>
          <button
            onClick={() => onEndSession?.(null)}
            className="bg-medical-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-600 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calibrationReps, setCalibrationReps] = useState([]);
  const [isCalibrating, setIsCalibrating] = useState(true);

  // Draggable overlay panel positions (in px, relative to viewport)
  const [overlayPositions, setOverlayPositions] = useState({
    reps: { x: 16, y: 16 },
    metrics: { x: 0, y: 80 },
    form: { x: 16, y: 0 },
    progress: { x: 0, y: 0 },
    calibration: { x: 0, y: 16 }
  });
  const dragStateRef = useRef({ key: null, offsetX: 0, offsetY: 0 });

  // Refs to avoid render loop re-creation on every angle update
  const baselineROMRef = useRef(null);
  const legSideRef = useRef('left');
  const leftAngleRef = useRef(null);
  const rightAngleRef = useRef(null);

  // Session context
  const {
    phase,
    setPhase,
    legSide,
    updateAngle,
    detectRep,
    feedbackState,
    reps,
    baselineROM,
    setBaseline,
    currentAngle,
    startSession,
    endSession,
    currentSet,
    setLegSide,
    setTargetROM
  } = useSession();

  // Memoize angle update callback
  const handleAngleUpdate = useCallback((primaryAngle, angles) => {
    updateAngle(primaryAngle);
    detectRep(primaryAngle, exercise?.repDetection || null);
  }, [updateAngle, detectRep, exercise]);

  // Pose estimation hook
  const {
    isInitialized,
    isLoading,
    error: poseError,
    processFrame,
    leftAngle: detectedLeftAngle,
    rightAngle: detectedRightAngle
  } = usePoseEstimation({
    legSide: selectedLeg || 'left',
    enableSmoothing: true,
    onAngleUpdate: handleAngleUpdate,
    minDetectionConfidence: 0.5,
    minPresenceConfidence: 0.5
  });

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    baselineROMRef.current = baselineROM;
  }, [baselineROM]);

  useEffect(() => {
    legSideRef.current = legSide;
  }, [legSide]);

  useEffect(() => {
    leftAngleRef.current = detectedLeftAngle;
  }, [detectedLeftAngle]);

  useEffect(() => {
    rightAngleRef.current = detectedRightAngle;
  }, [detectedRightAngle]);

  const getPanelStyle = useCallback((key) => {
    const pos = overlayPositions[key];
    if (!pos) return {};

    // Panels that default from right or bottom are anchored accordingly.
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
      return {
        left: '50%',
        transform: `translateX(-50%) translate(${Math.max(-260, Math.min(260, pos.x))}px, ${Math.max(8, pos.y)}px)`
      };
    }

    return { left: `${Math.max(8, pos.x)}px`, top: `${Math.max(8, pos.y)}px` };
  }, [overlayPositions]);

  const startDrag = useCallback((event, key) => {
    if (!containerRef.current) return;

    const panelRect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      key,
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top
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
          // Store as right/top to preserve right-side anchoring feel.
          const right = Math.max(8, containerRect.width - (x + 180));
          return { ...prev, metrics: { x: right, y: Math.max(8, y) } };
        }

        if (drag.key === 'form') {
          // Store as left/bottom.
          const bottom = Math.max(8, containerRect.height - (y + 120));
          return { ...prev, form: { x: Math.max(8, x), y: bottom } };
        }

        if (drag.key === 'calibration') {
          const centeredX = x - containerRect.width / 2 + 180;
          return {
            ...prev,
            calibration: {
              x: Math.max(-260, Math.min(260, centeredX)),
              y: Math.max(8, y)
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
      dragStateRef.current = { key: null, offsetX: 0, offsetY: 0 };
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Initialize exercise and set leg side from selectedLeg prop
  useEffect(() => {
    if (selectedLeg) {
      setLegSide(selectedLeg);
      console.log('Exercise loaded:', exercise.name, 'Leg:', selectedLeg);
    }
    if (exercise?.targetAngle) {
      setTargetROM(exercise.targetAngle);
    }
  }, [exercise, selectedLeg, setLegSide, setTargetROM]);

  // Set phase to CALIBRATION when camera is ready
  useEffect(() => {
    if (cameraReady && isInitialized && phase === SESSION_PHASES.SETUP) {
      setPhase(SESSION_PHASES.CALIBRATION);
      console.log('📦 Phase set to CALIBRATION');
    }
  }, [cameraReady, isInitialized, phase, setPhase]);

  // Start session timing when entering exercise phase
  useEffect(() => {
    if (phase === SESSION_PHASES.EXERCISE && !isCalibrating) {
      startSession();
    }
  }, [phase, isCalibrating, startSession]);

  /**
   * Initialize webcam
   */
  useEffect(() => {
    const startCamera = async () => {
      try {
        const videoConstraints = isMobile ? {
          width: { ideal: 854 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 }
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 60 }
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError(err.message);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isMobile]);

  /**
   * Canvas rendering loop
   */
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
        const leftLegColor = getLegColor(leftAngleRef.current, baselineROMRef.current, 135);
        const rightLegColor = getLegColor(rightAngleRef.current, baselineROMRef.current, 135);

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
  }, [
    cameraReady,
    isInitialized,
    processFrame,
    // Intentionally exclude rapidly changing values here; they are read from refs.
  ]);

  /**
   * Get leg color (traffic light system)
   */
  const getLegColor = (angle, baseline, target) => {
    if (!angle || !baseline) return 'white';
    if (angle >= target) return 'green';
    if (angle >= baseline) return 'yellow';
    return 'red';
  };

  /**
   * Get form quality for traffic light
   */
  const getFormQuality = () => {
    const currentAngle = legSide === 'left' ? detectedLeftAngle : detectedRightAngle;
    if (!currentAngle || !baselineROM) return 'neutral';
    
    if (currentAngle >= 135) return 'excellent';
    if (currentAngle >= baselineROM) return 'good';
    return 'poor';
  };

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  // Auto-enter fullscreen on mount and handle fullscreen changes
  useEffect(() => {
    const enterFullscreen = async () => {
      if (containerRef.current && !document.fullscreenElement) {
        try {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
          console.log('✅ Auto-entered fullscreen mode');
        } catch (err) {
          console.warn('Could not auto-enter fullscreen:', err);
          // Fullscreen might be blocked by browser policy, continue anyway
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // Auto-enter fullscreen after a short delay to ensure container is ready
    const timer = setTimeout(enterFullscreen, 100);

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /**
   * Exit session handler
   */
  const handleExitSession = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    const sessionData = endSession();
    onEndSession?.(sessionData);
  };

  /**
   * Handle calibration with 3 test reps
   */
  const handleCalibrationRep = useCallback(() => {
    if (currentAngle && currentAngle > 60) {
      const newCalibrationReps = [...calibrationReps, currentAngle];
      setCalibrationReps(newCalibrationReps);
      
      if (newCalibrationReps.length >= 3) {
        // Calculate baseline as average of 3 reps
        const avgBaseline = Math.round(
          newCalibrationReps.reduce((sum, angle) => sum + angle, 0) / newCalibrationReps.length
        );
        setBaseline(avgBaseline);
        setIsCalibrating(false);
        // Transition to EXERCISE phase
        setPhase(SESSION_PHASES.EXERCISE);
        console.log('✅ Calibration complete. Baseline:', avgBaseline, 'from reps:', newCalibrationReps);
        console.log('🏋️ Phase set to EXERCISE');
      }
    }
  }, [currentAngle, calibrationReps, setBaseline, setPhase]);

  const formQuality = getFormQuality();

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Minimalist UI Overlays */}
      <AnimatePresence>
        {cameraReady && isInitialized && (phase === SESSION_PHASES.CALIBRATION || phase === SESSION_PHASES.EXERCISE) && (
          <>
            {/* ── TOP-LEFT: Reps Counter (EXERCISE only) ── */}
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
                    <div className="text-white/60 text-xs mt-0.5">Set {currentSet}/{exercise.targetSets}</div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── RIGHT SIDE: Exercise Info Panel (always visible, below exit button) ── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute z-30 cursor-move touch-none"
              style={getPanelStyle('metrics')}
              onPointerDown={(e) => startDrag(e, 'metrics')}
            >
              <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl w-[180px]">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {exercise.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="text-white font-bold text-xs leading-tight truncate">{exercise.name}</h2>
                    <div className="text-teal-400 text-[10px] font-semibold uppercase">{selectedLeg} leg</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {phase === SESSION_PHASES.CALIBRATION ? (
                    <div className="text-center py-1">
                      <span className="text-yellow-400 text-xs font-bold animate-pulse">CALIBRATING…</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px]">Set</span>
                      <span className="text-white text-xs font-bold">{currentSet} / {exercise.targetSets}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Target</span>
                    <span className="text-cyan-400 text-xs font-bold">{exercise.targetAngle}°</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Baseline</span>
                    <span className="text-amber-400 text-xs font-bold">{baselineROM || '--'}°</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-[10px]">Current</span>
                    <span className="text-teal-400 text-xs font-bold">{Math.round(currentAngle || 0)}°</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── BOTTOM-LEFT: Form Quality (EXERCISE only) ── */}
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
                      { key: 'excellent', color: '#10B981', glow: 'rgba(16,185,129,0.8)', label: 'Excellent' },
                      { key: 'good',      color: '#F59E0B', glow: 'rgba(245,158,11,0.8)',  label: 'Good'      },
                      { key: 'poor',      color: '#EF4444', glow: 'rgba(239,68,68,0.8)',   label: 'Needs work'},
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

            {/* ── BOTTOM CENTER: Angle Progress Bar (EXERCISE only) ── */}
            {phase === SESSION_PHASES.EXERCISE && currentAngle && baselineROM && exercise && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-[160px] right-[72px] z-20"
              >
                <div className="bg-black/75 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 shadow-xl">
                  <div className="flex justify-between text-[10px] mb-2">
                    <span className="text-teal-400 font-bold">{Math.round(currentAngle)}° now</span>
                    <span className="text-gray-400">Base: {baselineROM}°</span>
                    <span className="text-cyan-400 font-bold">Target: {exercise.targetAngle}°</span>
                  </div>
                  <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
                    {/* Baseline marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
                      style={{ left: `${Math.min(100, (baselineROM / exercise.targetAngle) * 100)}%` }}
                    />
                    {/* Progress fill */}
                    <motion.div
                      animate={{ width: `${Math.min(100, (currentAngle / exercise.targetAngle) * 100)}%` }}
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

      {/* ── TOP-RIGHT: Exit Button (always visible, above info panel) ── */}
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

      {/* ── TOP-CENTER: Calibration Panel ── */}
      {phase === SESSION_PHASES.CALIBRATION && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-30 cursor-move touch-none"
          style={{ ...getPanelStyle('calibration'), maxWidth: 'calc(100% - 280px)' }}
          onPointerDown={(e) => startDrag(e, 'calibration')}
        >
          <div className="bg-yellow-500/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-2xl">
            <p className="text-white font-bold text-base text-center">
              Calibration ({calibrationReps.length}/3)
            </p>
            <p className="text-white/80 text-xs text-center">Perform 3 test reps at max range</p>
            {currentAngle && (
              <p className="text-white font-mono text-3xl text-center mt-1 font-black">{Math.round(currentAngle)}°</p>
            )}

            {/* Calibration rep indicators */}
            <div className="flex gap-2 justify-center mt-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                    calibrationReps[i]
                      ? 'bg-green-500 border-green-600 text-white'
                      : 'bg-white/20 border-white/40 text-white/60'
                  }`}
                >
                  {calibrationReps[i] ? '✓' : i + 1}
                </div>
              ))}
            </div>

            <motion.button
              onClick={handleCalibrationRep}
              disabled={!currentAngle || currentAngle <= 60}
              className="mt-3 w-full bg-white text-yellow-600 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              whileHover={{ scale: currentAngle > 60 ? 1.03 : 1 }}
              whileTap={{ scale: currentAngle > 60 ? 0.97 : 1 }}
            >
              <Check className="w-4 h-4" />
              Record Rep {calibrationReps.length + 1}
            </motion.button>
            {(!currentAngle || currentAngle <= 60) && (
              <p className="text-white/70 text-[10px] text-center mt-1">Bend more to record (min 60°)</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {(!cameraReady || !isInitialized) && !cameraError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        >
          <div className="text-white text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-medical-primary border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-xl font-semibold">
              {!cameraReady ? 'Starting camera...' : 'Loading AI...'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {(cameraError || poseError) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        >
          <div className="bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <h3 className="text-2xl font-bold text-white mb-4">⚠️ Error</h3>
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
    </div>
  );
};

export default ExerciseViewport;
