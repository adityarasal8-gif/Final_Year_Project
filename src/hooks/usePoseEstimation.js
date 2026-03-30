/**
 * usePoseEstimation.js
 * Custom React hook for MediaPipe Pose Landmarker integration
 * 
 * KEY FEATURE: Filters and returns ONLY lower body landmarks (23-32)
 * This ensures stability when upper body is out of frame
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { calculateKneeAngle, smoothAngle, validateLegLandmarks, smoothLandmarks } from '../utils/geometry';
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
  const initializePoseLandmarker = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load MediaPipe Vision tasks
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create PoseLandmarker with optimized settings for lower body only
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO', // VIDEO mode for high FPS (detector-tracker logic)
        numPoses: 1, // Track single person for better performance
        minPoseDetectionConfidence: minDetectionConfidence,
        minPosePresenceConfidence: minPresenceConfidence,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false // Disable for better performance
      });

      poseLandmarkerRef.current = poseLandmarker;
      setIsInitialized(true);
      setIsLoading(false);

      console.log('✅ MediaPipe PoseLandmarker initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize PoseLandmarker:', err);
      setError(err.message);
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
      if (!areLowerBodyLandmarksVisible(poseLandmarks, 0.3)) {
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
      let leftKneeAngle = null;
      if (
        leftLegValid &&
        leftHip.visibility  > 0.35 &&
        leftKnee.visibility > 0.35 &&
        leftAnkle.visibility > 0.35
      ) {
        leftKneeAngle = calculateKneeAngle(leftHip, leftKnee, leftAnkle);
        if (leftKneeAngle !== null && enableSmoothing) {
          leftKneeAngle = smoothAngle(leftKneeAngle, leftAngleSmoothRef.current, 0.35);
          leftAngleSmoothRef.current = leftKneeAngle;
        }
        if (leftKneeAngle !== null) {
          leftKneeAngle = Math.round(leftKneeAngle * 10) / 10;
          setLeftAngle(leftKneeAngle);
        }
      }

      // Calculate right knee angle
      let rightKneeAngle = null;
      if (
        rightLegValid &&
        rightHip.visibility  > 0.35 &&
        rightKnee.visibility > 0.35 &&
        rightAnkle.visibility > 0.35
      ) {
        rightKneeAngle = calculateKneeAngle(rightHip, rightKnee, rightAnkle);
        if (rightKneeAngle !== null && enableSmoothing) {
          rightKneeAngle = smoothAngle(rightKneeAngle, rightAngleSmoothRef.current, 0.35);
          rightAngleSmoothRef.current = rightKneeAngle;
        }
        if (rightKneeAngle !== null) {
          rightKneeAngle = Math.round(rightKneeAngle * 10) / 10;
          setRightAngle(rightKneeAngle);
        }
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
        const primaryAngle = legSide === 'left' ? leftKneeAngle : 
                           legSide === 'right' ? rightKneeAngle :
                           leftKneeAngle; // Default to left for 'both'
        if (primaryAngle !== null) {
          onAngleUpdate(primaryAngle, {
            leftAngle: leftKneeAngle,
            rightAngle: rightKneeAngle
          });
        }
      }

      isProcessingRef.current = false;

      const output = {
        leftAngle: leftKneeAngle,
        rightAngle: rightKneeAngle,
        landmarks: smoothed,         // smoothed positions for the canvas overlay
        lowerBodyLandmarks: lowerBody,
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle
      };

      if (leftKneeAngle !== null || rightKneeAngle !== null) {
        lastValidPoseRef.current = output;
        lastValidTimestampRef.current = timestamp;
      }

      return output;

    } catch (err) {
      console.error('❌ Frame processing error:', err);
      isProcessingRef.current = false;
      return null;
    }
  }, [legSide, enableSmoothing, onAngleUpdate, onPoseDetected]);

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
    initializePoseLandmarker();

    return () => {
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
    currentAngle: legSide === 'left' ? leftAngle : rightAngle, // For backward compatibility
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
