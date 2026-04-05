/**
 * usePoseEstimation.js
 * Custom React hook for MediaPipe Pose Landmarker integration
 * 
 * KEY FEATURE: Filters and returns ONLY lower body landmarks (23-32)
 * This ensures stability when upper body is out of frame
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { calculateAdaptiveKneeAngle, smoothAngle, validateLegLandmarks, smoothLandmarks } from '../utils/geometry';
import { areLowerBodyLandmarksVisible } from '../utils/drawing';

/**
 * MediaPipe Pose Landmark Indices (Lower Body Only)
 */
const POSE_LANDMARKS = {
  LEFT_HIP: 23,
  LEFT_KNEE: 25,
  LEFT_ANKLE: 27,
  RIGHT_HIP: 24,
  RIGHT_KNEE: 26,
  RIGHT_ANKLE: 28
};

const DEFAULT_WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';
const FALLBACK_WASM_ROOT = 'https://unpkg.com/@mediapipe/tasks-vision@0.10.8/wasm';
const DEFAULT_MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MIN_JOINT_VISIBILITY = 0.22;

const calculateLegRaiseAngle = (hip, knee) => {
  if (!hip || !knee) return null;

  const horizontalDistance = Math.abs((knee.x || 0) - (hip.x || 0));
  const verticalLift = Math.max(0, (hip.y || 0) - (knee.y || 0));

  if (horizontalDistance < 1e-6 && verticalLift < 1e-6) {
    return null;
  }

  const angleRadians = Math.atan2(verticalLift, Math.max(horizontalDistance, 1e-6));
  const angleDegrees = angleRadians * (180 / Math.PI);
  return Math.max(0, Math.min(90, angleDegrees));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetries = async (task, retries = 2, delayMs = 450) => {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1));
      }
    }
  }

  throw lastError;
};

const toPoseInitErrorMessage = (error) => {
  const raw = String(error?.message || error || '').trim();

  if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_INTERNET/i.test(raw)) {
    return 'Failed to load AI model. Check internet/firewall/proxy and retry.';
  }

  if (/WebGL|GPU|context/i.test(raw)) {
    return 'Graphics initialization failed. Try updating browser/GPU driver or retry.';
  }

  return raw || 'Failed to initialize pose engine.';
};

/**
 * usePoseEstimation Hook
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.legSide - 'left' | 'right' | 'both'
 * @param {boolean} options.enableSmoothing - Enable angle smoothing (default: true)
 * @param {Function} options.onAngleUpdate - Callback when angle is calculated
 * @param {Function} options.onPoseDetected - Callback when pose is detected
 * @param {number} options.minDetectionConfidence - Min detection confidence (default: 0.5)
 * @param {number} options.minPresenceConfidence - Min presence confidence (default: 0.5)
 * 
 * @returns {Object} Hook state and methods
 */
export const usePoseEstimation = (options = {}) => {
  const {
    legSide = 'left',
    enableSmoothing = true,
    onAngleUpdate,
    onPoseDetected,
    metricMode = 'inner_knee_angle',
    angleComputationMode = 'auto',
    minDetectionConfidence = 0.5,
    minPresenceConfidence = 0.5
  } = options;

  // MediaPipe instance
  const poseLandmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const isProcessingRef = useRef(false);
  
  // Smoothing state - separate for left and right legs
  const leftAngleSmoothRef = useRef(null);
  const rightAngleSmoothRef = useRef(null);

  // Temporal landmark position smoother (reduces skeleton jitter)
  const smoothedLandmarksRef = useRef(null);
  const lastValidPoseRef = useRef(null);
  const lastValidTimestampRef = useRef(0);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leftAngle, setLeftAngle] = useState(null);
  const [rightAngle, setRightAngle] = useState(null);
  const [landmarks, setLandmarks] = useState(null);
  const [lowerBodyLandmarks, setLowerBodyLandmarks] = useState(null);

  /**
   * Initialize MediaPipe PoseLandmarker
   * This runs once on mount
   */
  const initializePoseLandmarker = useCallback(async (isCancelled = () => false) => {
    try {
      if (isCancelled()) return;

      setIsLoading(true);
      setIsInitialized(false);
      setError(null);

      const configuredWasmRoot = import.meta.env.VITE_MEDIAPIPE_WASM_ROOT;
      const wasmRoots = [...new Set([
        configuredWasmRoot,
        DEFAULT_WASM_ROOT,
        FALLBACK_WASM_ROOT
      ].filter(Boolean))];

      const modelAssetPath =
        import.meta.env.VITE_MEDIAPIPE_MODEL_ASSET_PATH || DEFAULT_MODEL_ASSET_PATH;

      let vision = null;
      let lastError = null;

      // Load MediaPipe Vision tasks
      for (const wasmRoot of wasmRoots) {
        try {
          vision = await withRetries(
            () => FilesetResolver.forVisionTasks(wasmRoot),
            1,
            250
          );
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!vision) {
        throw lastError || new Error('Could not load MediaPipe WASM assets');
      }

      if (isCancelled()) return;

      // Create PoseLandmarker with optimized settings for lower body only
      let poseLandmarker = null;
      let lastCreateError = null;
      let usedDelegate = 'GPU';

      for (const delegate of ['GPU', 'CPU']) {
        try {
          poseLandmarker = await withRetries(
            () => PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath,
                delegate
              },
              runningMode: 'VIDEO', // VIDEO mode for high FPS (detector-tracker logic)
              numPoses: 1, // Track single person for better performance
              minPoseDetectionConfidence: minDetectionConfidence,
              minPosePresenceConfidence: minPresenceConfidence,
              minTrackingConfidence: 0.5,
              outputSegmentationMasks: false // Disable for better performance
            }),
            2,
            500
          );
          usedDelegate = delegate;
          break;
        } catch (error) {
          lastCreateError = error;
        }
      }

      if (!poseLandmarker) {
        throw lastCreateError || new Error('Could not create PoseLandmarker');
      }

      if (isCancelled()) {
        poseLandmarker.close();
        return;
      }

      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }

      poseLandmarkerRef.current = poseLandmarker;
      setIsInitialized(true);
      setIsLoading(false);

      console.log(`✅ MediaPipe PoseLandmarker initialized successfully (${usedDelegate})`);
    } catch (err) {
      if (isCancelled()) return;

      console.error('❌ Failed to initialize PoseLandmarker:', err);
      setError(toPoseInitErrorMessage(err));
      setIsInitialized(false);
      setIsLoading(false);
    }
  }, [minDetectionConfidence, minPresenceConfidence]);

  /**
   * Process a video frame and extract pose landmarks
   * Implements "Detector-Tracker" logic for high FPS
   * 
   * @param {HTMLVideoElement} videoElement - Video element to process
   * @param {number} timestamp - Current timestamp in ms
   * @returns {Object|null} Processed pose data
   */
  const processFrame = useCallback(async (videoElement, timestamp) => {
    if (!poseLandmarkerRef.current || !videoElement) {
      return null;
    }

    // Prevent concurrent processing (important for performance)
    if (isProcessingRef.current) {
      return null;
    }

    // Skip if same frame (VIDEO mode optimization)
    if (timestamp === lastVideoTimeRef.current) {
      return null;
    }

    try {
      isProcessingRef.current = true;
      lastVideoTimeRef.current = timestamp;

      // Detect pose landmarks
      const result = poseLandmarkerRef.current.detectForVideo(
        videoElement,
        timestamp
      );

      // Check if pose detected
      if (!result || !result.landmarks || result.landmarks.length === 0) {
        // Keep showing last valid pose briefly to prevent hard flicker.
        const ageMs = timestamp - lastValidTimestampRef.current;
        if (lastValidPoseRef.current && ageMs < 160) {
          isProcessingRef.current = false;
          return lastValidPoseRef.current;
        }
        isProcessingRef.current = false;
        return null;
      }

      const poseLandmarks = result.landmarks[0]; // First (and only) person

      // --- Landmark position smoothing ---
      // Apply EMA to x/y/z positions to eliminate per-frame jitter from the
      // skeleton overlay.  Visibility is kept from the raw detection so that
      // confidence-based gating still reflects the live signal.
      const smoothed = smoothLandmarks(
        poseLandmarks,
        smoothedLandmarksRef.current,
        0.55 // Slightly faster response while still filtering jitter
      );
      smoothedLandmarksRef.current = smoothed;

      // Expose the smoothed positions to React state (used by canvas drawing)
      setLandmarks(smoothed);

      // Lower-body visibility gate (use raw landmarks for confidence check)
      if (!areLowerBodyLandmarksVisible(poseLandmarks, 0.22)) {
        const ageMs = timestamp - lastValidTimestampRef.current;
        if (lastValidPoseRef.current && ageMs < 160) {
          isProcessingRef.current = false;
          return lastValidPoseRef.current;
        }
        isProcessingRef.current = false;
        return null;
      }

      // Extract only lower body landmarks (23-32) from the smoothed set
      const lowerBody = smoothed.slice(23, 33);
      setLowerBodyLandmarks(lowerBody);

      // --- Angle calculation on smoothed positions ---
      // Raw visibility is used for the per-landmark confidence gate;
      // smoothed x/y positions are used for the actual angle maths.
      const leftHip   = { ...smoothed[POSE_LANDMARKS.LEFT_HIP],   visibility: poseLandmarks[POSE_LANDMARKS.LEFT_HIP].visibility };
      const leftKnee  = { ...smoothed[POSE_LANDMARKS.LEFT_KNEE],  visibility: poseLandmarks[POSE_LANDMARKS.LEFT_KNEE].visibility };
      const leftAnkle = { ...smoothed[POSE_LANDMARKS.LEFT_ANKLE], visibility: poseLandmarks[POSE_LANDMARKS.LEFT_ANKLE].visibility };

      const rightHip   = { ...smoothed[POSE_LANDMARKS.RIGHT_HIP],   visibility: poseLandmarks[POSE_LANDMARKS.RIGHT_HIP].visibility };
      const rightKnee  = { ...smoothed[POSE_LANDMARKS.RIGHT_KNEE],  visibility: poseLandmarks[POSE_LANDMARKS.RIGHT_KNEE].visibility };
      const rightAnkle = { ...smoothed[POSE_LANDMARKS.RIGHT_ANKLE], visibility: poseLandmarks[POSE_LANDMARKS.RIGHT_ANKLE].visibility };

      // Anatomical validation — reject detections where the skeleton geometry
      // violates physical constraints (hip-above-knee-above-ankle rule).
      // This is the primary guard against MediaPipe placing landmarks wrongly
      // when only legs are in frame.
      const leftLegValid  = validateLegLandmarks(leftHip, leftKnee, leftAnkle);
      const rightLegValid = validateLegLandmarks(rightHip, rightKnee, rightAnkle);

      // Calculate left knee angle
      let leftKneeAngleRaw = null;
      if (
        leftLegValid &&
        leftHip.visibility  > MIN_JOINT_VISIBILITY &&
        leftKnee.visibility > MIN_JOINT_VISIBILITY &&
        leftAnkle.visibility > MIN_JOINT_VISIBILITY
      ) {
        leftKneeAngleRaw = calculateAdaptiveKneeAngle(leftHip, leftKnee, leftAnkle, angleComputationMode);
      }

      // Calculate right knee angle
      let rightKneeAngleRaw = null;
      if (
        rightLegValid &&
        rightHip.visibility  > MIN_JOINT_VISIBILITY &&
        rightKnee.visibility > MIN_JOINT_VISIBILITY &&
        rightAnkle.visibility > MIN_JOINT_VISIBILITY
      ) {
        rightKneeAngleRaw = calculateAdaptiveKneeAngle(rightHip, rightKnee, rightAnkle, angleComputationMode);
      }

      let leftMetricAngleRaw = leftKneeAngleRaw;
      let rightMetricAngleRaw = rightKneeAngleRaw;

      if (metricMode === 'leg_raise_angle') {
        leftMetricAngleRaw =
          leftHip.visibility > MIN_JOINT_VISIBILITY && leftKnee.visibility > MIN_JOINT_VISIBILITY
            ? calculateLegRaiseAngle(leftHip, leftKnee)
            : null;
        rightMetricAngleRaw =
          rightHip.visibility > MIN_JOINT_VISIBILITY && rightKnee.visibility > MIN_JOINT_VISIBILITY
            ? calculateLegRaiseAngle(rightHip, rightKnee)
            : null;
      }

      let leftMetricAngle = leftMetricAngleRaw;
      let rightMetricAngle = rightMetricAngleRaw;

      if (leftMetricAngle !== null && enableSmoothing) {
        leftMetricAngle = smoothAngle(leftMetricAngle, leftAngleSmoothRef.current, 0.35);
      }
      if (rightMetricAngle !== null && enableSmoothing) {
        rightMetricAngle = smoothAngle(rightMetricAngle, rightAngleSmoothRef.current, 0.35);
      }

      if (leftMetricAngle !== null) {
        leftMetricAngle = Math.round(leftMetricAngle * 10) / 10;
        leftAngleSmoothRef.current = leftMetricAngle;
        setLeftAngle(leftMetricAngle);
      }

      if (rightMetricAngle !== null) {
        rightMetricAngle = Math.round(rightMetricAngle * 10) / 10;
        rightAngleSmoothRef.current = rightMetricAngle;
        setRightAngle(rightMetricAngle);
      }

      // Trigger callbacks
      if (onPoseDetected) {
        onPoseDetected({
          landmarks: smoothed,
          lowerBodyLandmarks: lowerBody,
          worldLandmarks: result.worldLandmarks?.[0]
        });
      }

      if (onAngleUpdate) {
        let primaryAngle = null;

        if (legSide === 'left') {
          primaryAngle = leftMetricAngle;
        } else if (legSide === 'right') {
          primaryAngle = rightMetricAngle;
        } else {
          const leftValid = Number.isFinite(leftMetricAngle);
          const rightValid = Number.isFinite(rightMetricAngle);

          if (leftValid && rightValid) {
            primaryAngle = (leftMetricAngle + rightMetricAngle) / 2;
          } else if (leftValid) {
            primaryAngle = leftMetricAngle;
          } else if (rightValid) {
            primaryAngle = rightMetricAngle;
          }
        }

        if (primaryAngle !== null) {
          onAngleUpdate(primaryAngle, {
            leftAngle: leftMetricAngle,
            rightAngle: rightMetricAngle
          });
        }
      }

      isProcessingRef.current = false;

      const output = {
        leftAngle: leftMetricAngle,
        rightAngle: rightMetricAngle,
        landmarks: smoothed,         // smoothed positions for the canvas overlay
        lowerBodyLandmarks: lowerBody,
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle
      };

      if (leftMetricAngle !== null || rightMetricAngle !== null) {
        lastValidPoseRef.current = output;
        lastValidTimestampRef.current = timestamp;
      }

      return output;

    } catch (err) {
      console.error('❌ Frame processing error:', err);
      isProcessingRef.current = false;
      return null;
    }
  }, [angleComputationMode, legSide, enableSmoothing, metricMode, onAngleUpdate, onPoseDetected]);

  /**
   * Reset smoothing (useful when starting new session)
   */
  const resetSmoothing = useCallback(() => {
    leftAngleSmoothRef.current = null;
    rightAngleSmoothRef.current = null;
    smoothedLandmarksRef.current = null; // also reset position history
    lastValidPoseRef.current = null;
    lastValidTimestampRef.current = 0;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    initializePoseLandmarker(isCancelled);

    return () => {
      cancelled = true;

      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, [initializePoseLandmarker]);

  return {
    // State
    isInitialized,
    isLoading,
    error,
    leftAngle,
    rightAngle,
    currentAngle: legSide === 'left'
      ? leftAngle
      : legSide === 'right'
        ? rightAngle
        : (Number.isFinite(leftAngle) && Number.isFinite(rightAngle)
          ? (leftAngle + rightAngle) / 2
          : (Number.isFinite(leftAngle) ? leftAngle : rightAngle)),
    landmarks,
    lowerBodyLandmarks,

    // Methods
    processFrame,
    resetSmoothing,

    // MediaPipe instance (for advanced usage)
    poseLandmarker: poseLandmarkerRef.current
  };
};

export default usePoseEstimation;
