/**
 * geometry.js
 * Pure mathematical functions for pose landmark calculations
 * Used for knee angle computation in physiotherapy monitoring
 */

/**
 * Calculate the 3D distance between two points
 * @param {Object} point1 - Landmark with x, y, z coordinates
 * @param {Object} point2 - Landmark with x, y, z coordinates
 * @returns {number} Euclidean distance
 */
export const calculateDistance = (point1, point2) => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = (point2.z || 0) - (point1.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Calculate the magnitude (length) of a vector
 * @param {Object} vector - Vector with x, y, z components
 * @returns {number} Vector magnitude
 */
export const vectorMagnitude = (vector) => {
  return Math.sqrt(
    vector.x * vector.x + 
    vector.y * vector.y + 
    (vector.z || 0) * (vector.z || 0)
  );
};

/**
 * Calculate dot product of two 3D vectors
 * @param {Object} v1 - First vector {x, y, z}
 * @param {Object} v2 - Second vector {x, y, z}
 * @returns {number} Dot product
 */
export const dotProduct = (v1, v2) => {
  return (
    v1.x * v2.x + 
    v1.y * v2.y + 
    (v1.z || 0) * (v2.z || 0)
  );
};

/**
 * Create a vector from point1 to point2
 * @param {Object} point1 - Start point {x, y, z}
 * @param {Object} point2 - End point {x, y, z}
 * @returns {Object} Vector {x, y, z}
 */
export const createVector = (point1, point2) => {
  return {
    x: point2.x - point1.x,
    y: point2.y - point1.y,
    z: (point2.z || 0) - (point1.z || 0)
  };
};

/**
 * Calculate angle between three points using 2D dot product (X/Y only).
 * Z is intentionally ignored — depth estimates from MediaPipe are unreliable
 * when only the lower body is visible, and including Z adds significant noise.
 *
 * @param {Object} hip   - Hip landmark (point 23 / 24)
 * @param {Object} knee  - Knee landmark (point 25 / 26) — vertex of the angle
 * @param {Object} ankle - Ankle landmark (point 27 / 28)
 * @returns {number|null} Angle in degrees (0–180), or null if invalid
 *
 * Formula:
 *   cos(θ) = (a · b) / (|a| × |b|)
 *   where a = 2D vector from knee to hip
 *         b = 2D vector from knee to ankle
 */
export const calculateKneeAngle = (hip, knee, ankle) => {
  if (!hip || !knee || !ankle) return null;

  // Use 2D vectors (ignore Z — depth is unreliable for partial-body detection)
  const ax = hip.x - knee.x;
  const ay = hip.y - knee.y;
  const bx = ankle.x - knee.x;
  const by = ankle.y - knee.y;

  // Dot product and magnitudes (2D)
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);

  // Avoid division by zero (landmarks on top of each other)
  if (magA < 1e-6 || magB < 1e-6) return null;

  // Clamp to [-1, 1] to guard against floating-point drift
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));

  const angleDegrees = Math.acos(cosAngle) * (180 / Math.PI);

  // Sanity check: physiologically possible knee angles are 0°–180°
  if (angleDegrees < 0 || angleDegrees > 180) return null;

  return angleDegrees;
};

/**
 * Calculate knee angle in 3D using x/y/z vectors.
 * Useful when movement happens toward/away from camera (front-facing view).
 * @param {Object} hip
 * @param {Object} knee
 * @param {Object} ankle
 * @returns {number|null}
 */
export const calculateKneeAngle3D = (hip, knee, ankle) => {
  if (!hip || !knee || !ankle) return null;

  const a = createVector(knee, hip);
  const b = createVector(knee, ankle);
  const magA = vectorMagnitude(a);
  const magB = vectorMagnitude(b);

  if (magA < 1e-6 || magB < 1e-6) return null;

  const cosAngle = Math.max(-1, Math.min(1, dotProduct(a, b) / (magA * magB)));
  const angleDegrees = Math.acos(cosAngle) * (180 / Math.PI);

  if (angleDegrees < 0 || angleDegrees > 180) return null;
  return angleDegrees;
};

/**
 * Adaptive knee-angle calculation that blends 2D and 3D estimates.
 * - Side view remains mostly 2D-driven.
 * - Front view gets more contribution from 3D depth changes.
 * @param {Object} hip
 * @param {Object} knee
 * @param {Object} ankle
 * @param {'auto'|'2d'|'3d'} mode
 * @returns {number|null}
 */
export const calculateAdaptiveKneeAngle = (hip, knee, ankle, mode = 'auto') => {
  const angle2D = calculateKneeAngle(hip, knee, ankle);
  const angle3D = calculateKneeAngle3D(hip, knee, ankle);

  if (mode === '2d') return angle2D;
  if (mode === '3d') return angle3D;

  if (!Number.isFinite(angle2D) && !Number.isFinite(angle3D)) return null;
  if (!Number.isFinite(angle2D)) return angle3D;
  if (!Number.isFinite(angle3D)) return angle2D;

  const depthSpread =
    Math.abs((hip.z || 0) - (knee.z || 0)) +
    Math.abs((ankle.z || 0) - (knee.z || 0));
  const angleDisagreement = Math.abs(angle2D - angle3D);

  // Front-facing squats can have small depth spreads while still being valid.
  // Give 3D more influence earlier and strongly trust it when 2D diverges.
  let threeDWeight = depthSpread > 0.02 ? 0.82 : 0.45;
  if (angleDisagreement > 18) {
    threeDWeight = Math.max(threeDWeight, 0.9);
  }
  const twoDWeight = 1 - threeDWeight;

  return (angle2D * twoDWeight) + (angle3D * threeDWeight);
};

/**
 * Calculate improvement percentage based on adaptive baseline
 * This is the CORE LOGIC for physiotherapy progress tracking
 * 
 * @param {number} currentAngle - Current measured knee angle
 * @param {number} baselineROM - Baseline ROM from Day 1 calibration
 * @param {number} targetROM - Target ROM (typically 135° for full flexion)
 * @returns {number} Improvement percentage (0-100+)
 * 
 * Formula: (CurrentAngle - BaselineROM) / (Target - BaselineROM) × 100
 */
export const calculateImprovement = (currentAngle, baselineROM, targetROM = 135) => {
  if (!baselineROM || !currentAngle || !Number.isFinite(targetROM)) return 0;

  const denominator = targetROM - baselineROM;
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;

  const improvement = ((currentAngle - baselineROM) / denominator) * 100;
  return Math.max(0, Math.round(improvement));
};

/**
 * Determine feedback state based on angle thresholds
 * @param {number} currentAngle - Current measured angle
 * @param {number} baselineROM - Baseline angle
 * @param {number} targetROM - Target angle
 * @returns {string} Feedback state: 'excellent' | 'good' | 'warning' | 'neutral'
 */
export const getFeedbackState = (currentAngle, baselineROM, targetROM = 135) => {
  if (!currentAngle || !baselineROM) return 'neutral';

  if (currentAngle >= targetROM) {
    return 'excellent'; // Green - Target achieved
  } else if (currentAngle >= baselineROM) {
    return 'good'; // Light green - Progress made
  } else {
    return 'warning'; // Red - Below baseline
  }
};

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export const radiansToDegrees = (radians) => {
  return radians * (180 / Math.PI);
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Smooth angle values using exponential moving average
 * Helps reduce jitter in real-time tracking
 * @param {number} newAngle - New angle measurement
 * @param {number} previousAngle - Previous smoothed angle
 * @param {number} smoothingFactor - Smoothing factor (0-1), default 0.3
 * @returns {number} Smoothed angle
 */
export const smoothAngle = (newAngle, previousAngle, smoothingFactor = 0.3) => {
  if (previousAngle === null || previousAngle === undefined) {
    return newAngle;
  }
  return previousAngle + smoothingFactor * (newAngle - previousAngle);
};

/**
 * Compute standard deviation as movement stability metric.
 * Lower is better (more controlled movement).
 * @param {number[]} values
 * @returns {number}
 */
export const calculateStability = (values = []) => {
  const valid = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v));
  if (valid.length === 0) return 0;

  const mean = valid.reduce((sum, v) => sum + v, 0) / valid.length;
  const variance = valid.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / valid.length;
  return Math.sqrt(variance);
};

/**
 * Compute range of motion from a set of angle values.
 * @param {number[]} values
 * @returns {number}
 */
export const calculateROM = (values = []) => {
  const valid = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v));
  if (valid.length === 0) return 0;
  return Math.max(...valid) - Math.min(...valid);
};

/**
 * Validate that hip / knee / ankle landmarks form an anatomically plausible leg.
 * Catches spurious MediaPipe detections when only legs are in frame.
 *
 * Rules (MediaPipe coords: y increases downward, values normalised 0→1):
 *  - hip.y  < knee.y   (hip must appear above the knee)
 *  - knee.y < ankle.y  (knee must appear above the ankle)
 *  - minimum joint spacing of 3 % of frame height (avoids collapsed detections)
 *
 * @param {Object} hip   - Hip landmark  {x, y, visibility}
 * @param {Object} knee  - Knee landmark {x, y, visibility}
 * @param {Object} ankle - Ankle landmark {x, y, visibility}
 * @returns {boolean} True if the landmarks pass all anatomical checks
 */
export const validateLegLandmarks = (hip, knee, ankle) => {
  if (!hip || !knee || !ankle) return false;

  const hipToKnee = knee.y - hip.y;
  const kneeToAnkle = ankle.y - knee.y;

  // Allow mild y-order inversions from perspective/deep flexion while still
  // rejecting clearly implausible placements.
  if (hipToKnee < -0.12) return false;
  if (kneeToAnkle < -0.08) return false;

  // Guard against collapsed joints from noisy detections.
  if (Math.abs(hipToKnee) < 0.015) return false;
  if (Math.abs(kneeToAnkle) < 0.015) return false;

  return true;
};

/**
 * Smooth an array of pose landmarks over time using EMA on x, y, z.
 * Visibility is intentionally kept from the *new* frame so that
 * confidence-based show/hide logic always reflects the latest detection.
 *
 * @param {Array}  newLandmarks  - Latest landmark array from MediaPipe
 * @param {Array}  prevLandmarks - Previous smoothed landmark array
 * @param {number} factor        - EMA factor (0 = frozen, 1 = no smoothing); default 0.6
 * @returns {Array} Smoothed landmark array
 */
export const smoothLandmarks = (newLandmarks, prevLandmarks, factor = 0.6) => {
  if (!prevLandmarks || prevLandmarks.length !== newLandmarks.length) {
    return newLandmarks;
  }
  return newLandmarks.map((lm, i) => {
    const prev = prevLandmarks[i];
    if (!prev || !lm) return lm;

    const dx = lm.x - prev.x;
    const dy = lm.y - prev.y;
    const jumpDistance = Math.sqrt(dx * dx + dy * dy);

    // Outlier guard: if a single frame jumps too far, blend far less toward it.
    // This avoids full-skeleton shaking caused by occasional bad detections.
    const dynamicFactor = jumpDistance > 0.18 ? 0.18 : factor;

    return {
      ...lm,
      x: prev.x + dynamicFactor * (lm.x - prev.x),
      y: prev.y + dynamicFactor * (lm.y - prev.y),
      z: (prev.z ?? 0) + dynamicFactor * ((lm.z ?? 0) - (prev.z ?? 0)),
      // visibility stays from the new frame — used for confidence gating
    };
  });
};

/**
 * Calculate percentile using linear interpolation on a sorted numeric array.
 * @param {number[]} sortedValues - Sorted array (ascending)
 * @param {number} percentile - 0..100
 * @returns {number|null}
 */
export const calculatePercentile = (sortedValues, percentile) => {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;

  const p = Math.max(0, Math.min(100, percentile));
  const rank = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return sortedValues[lower];

  const weight = rank - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
};

/**
 * Remove outlier angle samples using percentile clipping.
 * @param {number[]} angleValues - Raw angle stream
 * @param {number} lowerPercentile - Lower clip percentile (default 5)
 * @param {number} upperPercentile - Upper clip percentile (default 95)
 * @returns {{ cleanedAngles: number[], lowerBound: number|null, upperBound: number|null, rawCount: number, cleanedCount: number }}
 */
export const cleanAngleOutliers = (
  angleValues,
  lowerPercentile = 5,
  upperPercentile = 95
) => {
  const valid = (Array.isArray(angleValues) ? angleValues : [])
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 180);

  if (valid.length === 0) {
    return {
      cleanedAngles: [],
      lowerBound: null,
      upperBound: null,
      rawCount: 0,
      cleanedCount: 0
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const lowerBound = calculatePercentile(sorted, lowerPercentile);
  const upperBound = calculatePercentile(sorted, upperPercentile);

  const cleanedAngles = sorted.filter(
    (value) => value >= lowerBound && value <= upperBound
  );

  return {
    cleanedAngles,
    lowerBound,
    upperBound,
    rawCount: valid.length,
    cleanedCount: cleanedAngles.length
  };
};

/**
 * Build baseline profile metrics from a calibration angle stream.
 * Mirrors notebook logic: clean outliers first, then compute max/min/ROM/stability.
 * @param {number[]} angleValues - Calibration angle samples
 * @param {{ minSamples?: number, lowerPercentile?: number, upperPercentile?: number }} options
 * @returns {{
 *   maxAngle: number,
 *   minAngle: number,
 *   rom: number,
 *   stability: number,
 *   sampleCount: number,
 *   rawSampleCount: number,
 *   lowerBound: number,
 *   upperBound: number,
 *   cleaningApplied: boolean
 * }|null}
 */
export const buildBaselineProfile = (angleValues, options = {}) => {
  const {
    minSamples = 30,
    lowerPercentile = 10,
    upperPercentile = 90
  } = options;

  const {
    cleanedAngles,
    lowerBound,
    upperBound,
    rawCount,
    cleanedCount
  } = cleanAngleOutliers(angleValues, lowerPercentile, upperPercentile);

  if (rawCount < minSamples || cleanedCount === 0) {
    return null;
  }

  const maxAngle = Math.max(...cleanedAngles);
  const minAngle = Math.min(...cleanedAngles);
  const rom = maxAngle - minAngle;
  const stability = calculateStability(cleanedAngles);

  return {
    maxAngle: Math.round(maxAngle * 100) / 100,
    minAngle: Math.round(minAngle * 100) / 100,
    rom: Math.round(rom * 100) / 100,
    stability: Math.round(stability * 100) / 100,
    sampleCount: cleanedCount,
    rawSampleCount: rawCount,
    lowerBound: Math.round(lowerBound * 100) / 100,
    upperBound: Math.round(upperBound * 100) / 100,
    cleaningApplied: true
  };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toRounded = (value, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * Build cleaned session-level metrics from an exercise angle stream.
 * Uses the same percentile clipping strategy as baseline cleaning.
 * @param {number[]} angleValues
 * @param {{ lowerPercentile?: number, upperPercentile?: number }} options
 * @returns {{ extension:number, flexion:number, rom:number, stability:number, sampleCount:number, rawSampleCount:number, lowerBound:number, upperBound:number, cleaningApplied:boolean }|null}
 */
export const calculateSessionMetrics = (angleValues, options = {}) => {
  const {
    lowerPercentile = 10,
    upperPercentile = 90
  } = options;

  const {
    cleanedAngles,
    lowerBound,
    upperBound,
    rawCount,
    cleanedCount
  } = cleanAngleOutliers(angleValues, lowerPercentile, upperPercentile);

  if (cleanedCount === 0) return null;

  const extension = Math.max(...cleanedAngles);
  const flexion = Math.min(...cleanedAngles);
  const rom = extension - flexion;
  const stability = calculateStability(cleanedAngles);

  return {
    extension: toRounded(extension),
    flexion: toRounded(flexion),
    rom: toRounded(rom),
    stability: toRounded(stability),
    sampleCount: cleanedCount,
    rawSampleCount: rawCount,
    lowerBound: toRounded(lowerBound),
    upperBound: toRounded(upperBound),
    cleaningApplied: true
  };
};

/**
 * Resolve adaptive scoring ranges using baseline profile when available.
 * Mirrors notebook strategy:
 * - angle range expands around baseline min/max
 * - stability max allows a small margin above baseline stability
 * @param {Object|null} baselineProfile
 * @param {Object} config
 * @returns {{ angleRange:[number, number], stabilityMax:number }}
 */
export const getAdaptiveDecisionRanges = (baselineProfile, config = {}) => {
  const lowerPadding = Number.isFinite(config?.adaptive?.lowerAnglePadding)
    ? config.adaptive.lowerAnglePadding
    : 10;
  const upperPadding = Number.isFinite(config?.adaptive?.upperAnglePadding)
    ? config.adaptive.upperAnglePadding
    : 5;
  const stabilityPadding = Number.isFinite(config?.adaptive?.stabilityPadding)
    ? config.adaptive.stabilityPadding
    : 5;

  const fallbackAngleRange = Array.isArray(config?.fallback?.angleRange) && config.fallback.angleRange.length === 2
    ? [
      clamp(Number(config.fallback.angleRange[0]), 0, 180),
      clamp(Number(config.fallback.angleRange[1]), 0, 180)
    ]
    : [70, 100];

  const fallbackStabilityMax = Number.isFinite(config?.fallback?.stabilityMax)
    ? Math.max(0, config.fallback.stabilityMax)
    : 12;

  if (
    baselineProfile &&
    Number.isFinite(baselineProfile.minAngle) &&
    Number.isFinite(baselineProfile.maxAngle)
  ) {
    const minAngle = clamp(baselineProfile.minAngle - lowerPadding, 0, 180);
    const maxAngle = clamp(baselineProfile.maxAngle + upperPadding, 0, 180);
    const baseStability = Number.isFinite(baselineProfile.stability)
      ? baselineProfile.stability
      : fallbackStabilityMax;

    return {
      angleRange: [Math.min(minAngle, maxAngle), Math.max(minAngle, maxAngle)],
      stabilityMax: Math.max(0, baseStability + stabilityPadding)
    };
  }

  return {
    angleRange: [Math.min(...fallbackAngleRange), Math.max(...fallbackAngleRange)],
    stabilityMax: fallbackStabilityMax
  };
};

/**
 * Explicit stage scoring engine ported from notebook logic.
 * @param {{ angle:number, stability:number, reps:number, baselineProfile?:Object|null, config?:Object }} params
 * @returns {{ totalScore:number, angleScore:number, stabilityScore:number, repsScore:number, ranges:Object, weights:Object }}
 */
export const calculateExplicitStageScore = ({
  angle,
  stability,
  reps = 0,
  baselineProfile = null,
  config = {}
}) => {
  const angleWeight = Number.isFinite(config?.scoring?.weights?.angle) ? config.scoring.weights.angle : 40;
  const stabilityWeight = Number.isFinite(config?.scoring?.weights?.stability) ? config.scoring.weights.stability : 30;
  const repsWeight = Number.isFinite(config?.scoring?.weights?.reps) ? config.scoring.weights.reps : 30;

  const angleTolerance = Number.isFinite(config?.scoring?.angleTolerance)
    ? config.scoring.angleTolerance
    : 10;
  const stabilityTolerance = Number.isFinite(config?.scoring?.stabilityTolerance)
    ? config.scoring.stabilityTolerance
    : 5;
  const repFullThreshold = Number.isFinite(config?.scoring?.repThresholds?.full)
    ? config.scoring.repThresholds.full
    : 8;
  const repPartialThreshold = Number.isFinite(config?.scoring?.repThresholds?.partial)
    ? config.scoring.repThresholds.partial
    : 5;

  const { angleRange, stabilityMax } = getAdaptiveDecisionRanges(baselineProfile, config);
  const [minAngle, maxAngle] = angleRange;

  let angleScore = 0;
  if (Number.isFinite(angle)) {
    if (angle >= minAngle && angle <= maxAngle) {
      angleScore = angleWeight;
    } else if (angle >= (minAngle - angleTolerance) && angle <= (maxAngle + angleTolerance)) {
      angleScore = angleWeight * 0.6;
    } else {
      angleScore = angleWeight * 0.3;
    }
  }

  let stabilityScore = 0;
  if (Number.isFinite(stability)) {
    if (stability <= stabilityMax) {
      stabilityScore = stabilityWeight;
    } else if (stability <= stabilityMax + stabilityTolerance) {
      stabilityScore = stabilityWeight * 0.6;
    } else {
      stabilityScore = stabilityWeight * 0.3;
    }
  }

  let repsScore = 0;
  if (Number.isFinite(reps)) {
    if (reps >= repFullThreshold) {
      repsScore = repsWeight;
    } else if (reps >= repPartialThreshold) {
      repsScore = repsWeight * 0.6;
    } else {
      repsScore = repsWeight * 0.3;
    }
  }

  const totalScore = angleScore + stabilityScore + repsScore;

  return {
    totalScore: toRounded(totalScore),
    angleScore: toRounded(angleScore),
    stabilityScore: toRounded(stabilityScore),
    repsScore: toRounded(repsScore),
    ranges: {
      minAngle: toRounded(minAngle),
      maxAngle: toRounded(maxAngle),
      stabilityMax: toRounded(stabilityMax),
      angleTolerance: toRounded(angleTolerance),
      stabilityTolerance: toRounded(stabilityTolerance)
    },
    weights: {
      angle: toRounded(angleWeight),
      stability: toRounded(stabilityWeight),
      reps: toRounded(repsWeight)
    },
    repThresholds: {
      full: toRounded(repFullThreshold),
      partial: toRounded(repPartialThreshold)
    }
  };
};

/**
 * Map numeric score to explicit stage status.
 * @param {number} score
 * @param {{ ready?:number, progressing?:number }} thresholds
 * @returns {'READY_FOR_NEXT_STAGE'|'PROGRESSING'|'NEEDS_IMPROVEMENT'}
 */
export const decideRecoveryStage = (score, thresholds = {}) => {
  const readyThreshold = Number.isFinite(thresholds?.ready) ? thresholds.ready : 80;
  const progressingThreshold = Number.isFinite(thresholds?.progressing) ? thresholds.progressing : 60;

  if (score >= readyThreshold) return 'READY_FOR_NEXT_STAGE';
  if (score >= progressingThreshold) return 'PROGRESSING';
  return 'NEEDS_IMPROVEMENT';
};
