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
  if (!baselineROM || !currentAngle) return 0;
  
  const improvement = ((currentAngle - baselineROM) / (targetROM - baselineROM)) * 100;
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

  // Anatomical order: hip above knee, knee above ankle
  if (hip.y >= knee.y) return false;
  if (knee.y >= ankle.y) return false;

  // Minimum inter-joint distance (3 % of normalised frame height)
  if ((knee.y - hip.y) < 0.03) return false;
  if ((ankle.y - knee.y) < 0.03) return false;

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
