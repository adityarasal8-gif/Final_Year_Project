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
 * Calculate angle between three points using Law of Cosines
 * This is the CORE function for knee angle calculation
 * 
 * @param {Object} hip - Hip landmark (point 23)
 * @param {Object} knee - Knee landmark (point 25) - vertex of the angle
 * @param {Object} ankle - Ankle landmark (point 27)
 * @returns {number} Angle in degrees (0-180)
 * 
 * Formula:
 * cos(θ) = (a·b) / (|a| × |b|)
 * where a = vector from knee to hip
 *       b = vector from knee to ankle
 */
export const calculateKneeAngle = (hip, knee, ankle) => {
  // Create vectors from knee to hip and knee to ankle
  const vectorKneeToHip = createVector(knee, hip);
  const vectorKneeToAnkle = createVector(knee, ankle);

  // Calculate dot product
  const dot = dotProduct(vectorKneeToHip, vectorKneeToAnkle);

  // Calculate magnitudes
  const magKneeToHip = vectorMagnitude(vectorKneeToHip);
  const magKneeToAnkle = vectorMagnitude(vectorKneeToAnkle);

  // Avoid division by zero
  if (magKneeToHip === 0 || magKneeToAnkle === 0) {
    return null;
  }

  // Calculate cosine of angle
  const cosAngle = dot / (magKneeToHip * magKneeToAnkle);

  // Clamp to [-1, 1] to handle floating point errors
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));

  // Convert to degrees
  const angleRadians = Math.acos(clampedCos);
  const angleDegrees = angleRadians * (180 / Math.PI);

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
