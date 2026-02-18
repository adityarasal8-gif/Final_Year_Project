/**
 * usePoseEstimation.js
 * Custom React hook for MediaPipe Pose Landmarker integration
 * 
 * KEY FEATURE: Filters and returns ONLY lower body landmarks (23-32)
 * This ensures stability when upper body is out of frame
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { calculateKneeAngle, smoothAngle } from '../utils/geometry';
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
        minPoseDetectionConfidence: 0.3, // Lowered to work without face
        minPosePresenceConfidence: 0.3, // Lowered to work without face
        minTrackingConfidence: 0.3, // Lowered for better leg-only tracking
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
  }, []);

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
        isProcessingRef.current = false;
        return null;
      }

      const poseLandmarks = result.landmarks[0]; // First (and only) person
      setLandmarks(poseLandmarks);

      // CRITICAL: Check if LOWER BODY is visible (not upper body)
      // Very lenient threshold (0.3) to work reliably with only legs visible
      if (!areLowerBodyLandmarksVisible(poseLandmarks, 0.3)) {
        isProcessingRef.current = false;
        return null;
      }

      // Extract only lower body landmarks (23-32)
      const lowerBody = poseLandmarks.slice(23, 33);
      setLowerBodyLandmarks(lowerBody);

      // Calculate angles for both legs
      const leftHip = poseLandmarks[POSE_LANDMARKS.LEFT_HIP];
      const leftKnee = poseLandmarks[POSE_LANDMARKS.LEFT_KNEE];
      const leftAnkle = poseLandmarks[POSE_LANDMARKS.LEFT_ANKLE];

      const rightHip = poseLandmarks[POSE_LANDMARKS.RIGHT_HIP];
      const rightKnee = poseLandmarks[POSE_LANDMARKS.RIGHT_KNEE];
      const rightAnkle = poseLandmarks[POSE_LANDMARKS.RIGHT_ANKLE];

      // Calculate left knee angle - VERY LOW VISIBILITY THRESHOLD for leg-only detection
      let leftKneeAngle = null;
      if (leftHip.visibility > 0.3 && leftKnee.visibility > 0.3 && leftAnkle.visibility > 0.3) {
        leftKneeAngle = calculateKneeAngle(leftHip, leftKnee, leftAnkle);
        if (leftKneeAngle && enableSmoothing) {
          // Increased smoothing factor (0.4 instead of 0.3) to reduce jitter
          leftKneeAngle = smoothAngle(leftKneeAngle, leftAngleSmoothRef.current, 0.4);
          leftAngleSmoothRef.current = leftKneeAngle;
        }
        if (leftKneeAngle) {
          leftKneeAngle = Math.round(leftKneeAngle * 10) / 10;
          setLeftAngle(leftKneeAngle);
        }
      }

      // Calculate right knee angle - VERY LOW VISIBILITY THRESHOLD for leg-only detection
      let rightKneeAngle = null;
      if (rightHip.visibility > 0.3 && rightKnee.visibility > 0.3 && rightAnkle.visibility > 0.3) {
        rightKneeAngle = calculateKneeAngle(rightHip, rightKnee, rightAnkle);
        if (rightKneeAngle && enableSmoothing) {
          // Increased smoothing factor (0.4 instead of 0.3) to reduce jitter
          rightKneeAngle = smoothAngle(rightKneeAngle, rightAngleSmoothRef.current, 0.4);
          rightAngleSmoothRef.current = rightKneeAngle;
        }
        if (rightKneeAngle) {
          rightKneeAngle = Math.round(rightKneeAngle * 10) / 10;
          setRightAngle(rightKneeAngle);
        }
      }

      // Trigger callbacks
      if (onPoseDetected) {
        onPoseDetected({
          landmarks: poseLandmarks,
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

      return {
        leftAngle: leftKneeAngle,
        rightAngle: rightKneeAngle,
        landmarks: poseLandmarks,
        lowerBodyLandmarks: lowerBody,
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle
      };

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
