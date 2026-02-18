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
  const holdTimerRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [calibrationReps, setCalibrationReps] = useState([]);
  const [isCalibrating, setIsCalibrating] = useState(true);

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
    setLegSide
  } = useSession();

  // Memoize angle update callback
  const handleAngleUpdate = useCallback((primaryAngle, angles) => {
    updateAngle(primaryAngle);
    detectRep(primaryAngle);
  }, [updateAngle, detectRep]);

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

  // Initialize exercise and set leg side from selectedLeg prop
  useEffect(() => {
    if (selectedLeg) {
      setLegSide(selectedLeg);
      console.log('Exercise loaded:', exercise.name, 'Leg:', selectedLeg);
    }
  }, [exercise, selectedLeg, setLegSide]);

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
        const leftLegColor = getLegColor(detectedLeftAngle, baselineROM, 135);
        const rightLegColor = getLegColor(detectedRightAngle, baselineROM, 135);

        drawLegSkeleton(ctx, poseData.landmarks, {
          leftLegColor,
          rightLegColor,
          leftAngle: detectedLeftAngle,
          rightAngle: detectedRightAngle,
          lineWidth: 5,
          legSide
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
    detectedLeftAngle,
    detectedRightAngle,
    baselineROM,
    legSide
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
   * Press & Hold to End
   */
  const handlePressStart = () => {
    setIsHolding(true);
    let progress = 0;
    
    holdTimerRef.current = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        const sessionData = endSession();
        onEndSession?.(sessionData);
      }
    }, 20);
  };

  const handlePressEnd = () => {
    setIsHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
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
            {/* Prominent Reps Counter (Top Left Corner) - Only show during EXERCISE phase */}
            {phase === SESSION_PHASES.EXERCISE && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-6 left-6 z-30"
              >
                <div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-2xl p-6 shadow-2xl border-2 border-white/20">
                  <div className="text-center">
                    <div className="text-white/80 text-sm font-medium mb-1">REPS</div>
                    <motion.div
                      key={reps}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                      className="text-white text-6xl font-black leading-none"
                    >
                      {reps}
                    </motion.div>
                    <div className="text-teal-200 text-xs font-medium mt-1">/ {exercise.targetReps * exercise.targetSets}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Exercise Info Panel (Top Right Corner) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-6 right-6 z-30"
            >
              <div className="bg-black/80 backdrop-blur-md rounded-2xl p-5 border border-white/10 shadow-2xl min-w-[220px]">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                    {exercise.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-bold text-sm leading-tight">{exercise.name}</h2>
                    <div className="text-teal-400 text-xs font-semibold">{selectedLeg.toUpperCase()} LEG</div>
                  </div>
                </div>
                
                {/* Exercise Metrics */}
                <div className="space-y-2.5">
                  {phase === SESSION_PHASES.CALIBRATION ? (
                    <div className="flex items-center justify-center py-2">
                      <span className="text-yellow-400 text-sm font-bold animate-pulse">📏 CALIBRATING</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs font-medium">Set:</span>
                      <span className="text-white text-sm font-bold">{currentSet} / {exercise.targetSets}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Target:</span>
                    <span className="text-cyan-400 text-sm font-bold">{exercise.targetAngle}°</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Baseline:</span>
                    <span className="text-amber-400 text-sm font-bold">{baselineROM || '--'}°</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs font-medium">Current:</span>
                    <span className="text-teal-400 text-sm font-bold">{Math.round(currentAngle || 0)}°</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Traffic Light Indicator (Bottom Left Corner) - Only during EXERCISE */}
            {phase === SESSION_PHASES.EXERCISE && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute bottom-6 left-6 z-30"
              >
                <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                  <div className="text-white text-xs font-semibold mb-3 text-center">FORM</div>
                <div className="flex flex-col gap-3">
                  {/* Green */}
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        backgroundColor: formQuality === 'excellent' ? '#10B981' : '#1F2937',
                        boxShadow: formQuality === 'excellent' 
                          ? '0 0 20px rgba(16, 185, 129, 0.8)' 
                          : 'none'
                      }}
                      className="w-6 h-6 rounded-full border-2 border-white/30"
                    />
                    <span className={`text-xs font-medium ${formQuality === 'excellent' ? 'text-green-400' : 'text-gray-500'}`}>
                      Excellent
                    </span>
                  </div>
                  {/* Yellow */}
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        backgroundColor: formQuality === 'good' ? '#F59E0B' : '#1F2937',
                        boxShadow: formQuality === 'good' 
                          ? '0 0 20px rgba(245, 158, 11, 0.8)' 
                          : 'none'
                      }}
                      className="w-6 h-6 rounded-full border-2 border-white/30"
                    />
                    <span className={`text-xs font-medium ${formQuality === 'good' ? 'text-amber-400' : 'text-gray-500'}`}>
                      Good
                    </span>
                  </div>
                  {/* Red */}
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        backgroundColor: formQuality === 'poor' ? '#EF4444' : '#1F2937',
                        boxShadow: formQuality === 'poor' 
                          ? '0 0 20px rgba(239, 68, 68, 0.8)' 
                          : 'none'
                      }}
                      className="w-6 h-6 rounded-full border-2 border-white/30"
                    />
                    <span className={`text-xs font-medium ${formQuality === 'poor' ? 'text-red-400' : 'text-gray-500'}`}>
                      Keep Going
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
            )}

            {/* Angle Progress Bar (Bottom Center) - Only during EXERCISE */}
            {phase === SESSION_PHASES.EXERCISE && currentAngle && baselineROM && exercise && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-24 left-1/2 transform -translate-x-1/2 w-[90%] max-w-2xl z-20"
              >
                <div className="bg-black/70 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                  <div className="flex justify-between text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-400 animate-pulse"></div>
                      <span className="text-teal-400 font-bold">{Math.round(currentAngle)}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      <span className="text-gray-400 font-medium">Baseline: {baselineROM}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                      <span className="text-cyan-400 font-bold">Target: {exercise.targetAngle}°</span>
                    </div>
                  </div>
                  <div className="relative h-5 bg-gray-800 rounded-full overflow-hidden">
                    {/* Baseline marker */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white/70 z-10"
                      style={{ left: `${(baselineROM / exercise.targetAngle) * 100}%` }}
                    />
                    {/* Current angle progress */}
                    <motion.div
                      animate={{
                        width: `${Math.min(100, (currentAngle / exercise.targetAngle) * 100)}%`
                      }}
                      className={`absolute h-full ${
                        currentAngle >= exercise.targetAngle
                          ? 'bg-gradient-to-r from-green-500 to-green-600'
                          : currentAngle >= baselineROM
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-600'
                          : 'bg-gradient-to-r from-red-500 to-orange-600'
                      }`}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Exit Button - Always visible during calibration and exercise */}
      {cameraReady && isInitialized && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onEndSession}
          className="absolute bottom-6 right-6 bg-red-500/90 backdrop-blur-md p-4 rounded-full hover:bg-red-600 transition-all z-30 group shadow-2xl border-2 border-red-400/30"
          title="Exit Session"
        >
          <X className="w-6 h-6 text-white" />
        </motion.button>
      )}

      {/* Calibration Mode Indicator with Complete Button */}
      {phase === SESSION_PHASES.CALIBRATION && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30"
        >
          <div className="bg-yellow-500/90 backdrop-blur-sm px-8 py-4 rounded-2xl shadow-2xl">
            <p className="text-white font-bold text-xl text-center">
              📏 Calibration ({calibrationReps.length}/3)
            </p>
            <p className="text-white/90 text-sm text-center mt-1">
              Perform 3 test reps at maximum range
            </p>
            {currentAngle && (
              <p className="text-white font-mono text-4xl text-center mt-2">
                {Math.round(currentAngle)}°
              </p>
            )}
            
            {/* Calibration rep indicators */}
            <div className="flex gap-3 justify-center mt-4">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold ${
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
              className="mt-4 w-full bg-white text-yellow-600 px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              whileHover={{ scale: currentAngle > 60 ? 1.05 : 1 }}
              whileTap={{ scale: currentAngle > 60 ? 0.95 : 1 }}
            >
              <Check className="w-5 h-5" />
              Record Rep {calibrationReps.length + 1}
            </motion.button>
            {(!currentAngle || currentAngle <= 60) && (
              <p className="text-white/70 text-xs text-center mt-2">
                Bend more to record calibration rep (min 60°)
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Press & Hold to End Button (Bottom Center) */}
      {phase === SESSION_PHASES.EXERCISE && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
        >
          <div className="relative">
            <motion.button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              className="relative bg-red-500/80 backdrop-blur-sm text-white px-8 py-4 rounded-full font-bold text-lg shadow-2xl hover:bg-red-600/80 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">
                {isHolding ? 'Hold to End...' : 'Press & Hold to End'}
              </span>
              
              {/* Progress circle */}
              {isHolding && (
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - holdProgress / 100)}
                    className="transition-all duration-75"
                  />
                </svg>
              )}
            </motion.button>
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
