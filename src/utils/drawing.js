/**
 * drawing.js
 * Canvas drawing utilities for LEG-ONLY pose visualization
 * 
 * CRITICAL CONSTRAINT: Only render lower body landmarks (23-32)
 * This prevents jitter when upper body is cut off from frame
 */

/**
 * MediaPipe Pose Landmark Indices (Lower Body Only)
 * We ONLY work with these landmarks (indices 23-32):
 * 
 * 23: LEFT_HIP
 * 24: RIGHT_HIP
 * 25: LEFT_KNEE
 * 26: RIGHT_KNEE
 * 27: LEFT_ANKLE
 * 28: RIGHT_ANKLE
 * 29: LEFT_HEEL
 * 30: RIGHT_HEEL
 * 31: LEFT_FOOT_INDEX
 * 32: RIGHT_FOOT_INDEX
 */

export const LOWER_BODY_LANDMARKS = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

/**
 * Define leg-only connections for skeleton drawing
 * Each connection is [startIndex, endIndex]
 */
export const LEG_CONNECTIONS = [
  // Left leg chain
  [LOWER_BODY_LANDMARKS.LEFT_HIP, LOWER_BODY_LANDMARKS.LEFT_KNEE],      // Left thigh
  [LOWER_BODY_LANDMARKS.LEFT_KNEE, LOWER_BODY_LANDMARKS.LEFT_ANKLE],    // Left shin
  [LOWER_BODY_LANDMARKS.LEFT_ANKLE, LOWER_BODY_LANDMARKS.LEFT_HEEL],    // Left foot back
  [LOWER_BODY_LANDMARKS.LEFT_ANKLE, LOWER_BODY_LANDMARKS.LEFT_FOOT_INDEX], // Left foot front
  
  // Right leg chain
  [LOWER_BODY_LANDMARKS.RIGHT_HIP, LOWER_BODY_LANDMARKS.RIGHT_KNEE],    // Right thigh
  [LOWER_BODY_LANDMARKS.RIGHT_KNEE, LOWER_BODY_LANDMARKS.RIGHT_ANKLE],  // Right shin
  [LOWER_BODY_LANDMARKS.RIGHT_ANKLE, LOWER_BODY_LANDMARKS.RIGHT_HEEL],  // Right foot back
  [LOWER_BODY_LANDMARKS.RIGHT_ANKLE, LOWER_BODY_LANDMARKS.RIGHT_FOOT_INDEX], // Right foot front
  
  // Hip connection (for stability reference)
  [LOWER_BODY_LANDMARKS.LEFT_HIP, LOWER_BODY_LANDMARKS.RIGHT_HIP]
];

/**
 * Check if lower body landmarks are visible
 * Returns true if AT LEAST ONE complete leg chain is visible
 * More lenient than checking all landmarks - reduces jitter
 * 
 * @param {Array} landmarks - Full pose landmarks array
 * @param {number} minVisibility - Minimum visibility threshold (default 0.4)
 * @returns {boolean} True if at least one leg is clearly visible
 */
export const areLowerBodyLandmarksVisible = (landmarks, minVisibility = 0.4) => {
  if (!landmarks || landmarks.length < 33) return false;

  // Check if LEFT leg is visible (hip, knee, ankle)
  const leftLegVisible = 
    landmarks[LOWER_BODY_LANDMARKS.LEFT_HIP]?.visibility >= minVisibility &&
    landmarks[LOWER_BODY_LANDMARKS.LEFT_KNEE]?.visibility >= minVisibility &&
    landmarks[LOWER_BODY_LANDMARKS.LEFT_ANKLE]?.visibility >= minVisibility;

  // Check if RIGHT leg is visible (hip, knee, ankle)
  const rightLegVisible = 
    landmarks[LOWER_BODY_LANDMARKS.RIGHT_HIP]?.visibility >= minVisibility &&
    landmarks[LOWER_BODY_LANDMARKS.RIGHT_KNEE]?.visibility >= minVisibility &&
    landmarks[LOWER_BODY_LANDMARKS.RIGHT_ANKLE]?.visibility >= minVisibility;

  // Return true if AT LEAST ONE leg is fully visible
  return leftLegVisible || rightLegVisible;
};

/**
 * Check if a specific leg is visible
 * @param {Array} landmarks - Full pose landmarks array
 * @param {string} legSide - 'left' | 'right'
 * @param {number} minVisibility - Minimum visibility threshold
 * @returns {boolean} True if specified leg is visible
 */
export const isLegVisible = (landmarks, legSide, minVisibility = 0.4) => {
  if (!landmarks || landmarks.length < 33) return false;

  if (legSide === 'left' || legSide === 'both') {
    const leftVisible = 
      landmarks[LOWER_BODY_LANDMARKS.LEFT_HIP]?.visibility >= minVisibility &&
      landmarks[LOWER_BODY_LANDMARKS.LEFT_KNEE]?.visibility >= minVisibility &&
      landmarks[LOWER_BODY_LANDMARKS.LEFT_ANKLE]?.visibility >= minVisibility;
    if (leftVisible) return true;
  }

  if (legSide === 'right' || legSide === 'both') {
    const rightVisible = 
      landmarks[LOWER_BODY_LANDMARKS.RIGHT_HIP]?.visibility >= minVisibility &&
      landmarks[LOWER_BODY_LANDMARKS.RIGHT_KNEE]?.visibility >= minVisibility &&
      landmarks[LOWER_BODY_LANDMARKS.RIGHT_ANKLE]?.visibility >= minVisibility;
    if (rightVisible) return true;
  }

  return false;
};

/**
 * Extract ONLY lower body landmarks from full pose
 * @param {Array} landmarks - Full 33-landmark array
 * @returns {Array} Landmarks 23-32 only
 */
export const extractLowerBodyLandmarks = (landmarks) => {
  if (!landmarks || landmarks.length < 33) return null;
  return landmarks.slice(23, 33); // Indices 23-32 (10 landmarks)
};

/**
 * Draw leg skeleton on canvas with color-coded feedback
 * IMPROVED: Works even when upper body is not visible, reduced jitter
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} landmarks - Full pose landmarks
 * @param {Object} feedbackState - State for visual feedback
 * @param {string} feedbackState.leftLegColor - Color for left leg ('green'|'red'|'yellow')
 * @param {string} feedbackState.rightLegColor - Color for right leg
 * @param {number} feedbackState.leftAngle - Left knee angle (optional)
 * @param {number} feedbackState.rightAngle - Right knee angle (optional)
 * @param {string} feedbackState.legSide - Which leg to track ('left'|'right'|'both')
 */
export const drawLegSkeleton = (ctx, landmarks, feedbackState = {}) => {
  if (!ctx || !landmarks || landmarks.length < 33) return;

  const canvas = ctx.canvas;
  const {
    leftLegColor = 'white',
    rightLegColor = 'white',
    leftAngle = null,
    rightAngle = null,
    lineWidth = 5,
    legSide = 'both'
  } = feedbackState;

  // Check if AT LEAST ONE leg is visible (more lenient)
  const anyLegVisible = areLowerBodyLandmarksVisible(landmarks, 0.4);
  
  if (!anyLegVisible) {
    // Return false to indicate no legs visible
    // Warning will be handled by caller in normal (non-flipped) context
    return false;
  }

  // Define which legs to draw based on legSide parameter
  const shouldDrawLeft = legSide === 'left' || legSide === 'both';
  const shouldDrawRight = legSide === 'right' || legSide === 'both';

  // Draw connections (skeleton lines)
  // A connection is only drawn when BOTH endpoints are:
  //   (a) above the visibility threshold, AND
  //   (b) within the normalised frame bounds (guard against MediaPipe placing
  //       landmarks off-screen when the upper body is not in view).
  const isInBounds = (lm) =>
    lm.x > -0.05 && lm.x < 1.05 && lm.y > -0.05 && lm.y < 1.05;

  LEG_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const startLandmark = landmarks[startIdx];
    const endLandmark = landmarks[endIdx];

    if (!startLandmark || !endLandmark) return;

    // Raised threshold (0.45) + bounds check to avoid jittery / off-screen bones
    if (startLandmark.visibility < 0.45 || endLandmark.visibility < 0.45) return;
    if (!isInBounds(startLandmark) || !isInBounds(endLandmark)) return;

    // Determine if this is left or right leg connection
    const isLeftLeg = (
      startIdx === 23 || endIdx === 23 || // LEFT_HIP
      startIdx === 25 || endIdx === 25 || // LEFT_KNEE
      startIdx === 27 || endIdx === 27 || // LEFT_ANKLE
      startIdx === 29 || endIdx === 29 || // LEFT_HEEL
      startIdx === 31 || endIdx === 31    // LEFT_FOOT_INDEX
    );

    const isRightLeg = (
      startIdx === 24 || endIdx === 24 || // RIGHT_HIP
      startIdx === 26 || endIdx === 26 || // RIGHT_KNEE
      startIdx === 28 || endIdx === 28 || // RIGHT_ANKLE
      startIdx === 30 || endIdx === 30 || // RIGHT_HEEL
      startIdx === 32 || endIdx === 32    // RIGHT_FOOT_INDEX
    );

    // Skip if this leg shouldn't be drawn
    if (isLeftLeg && !shouldDrawLeft) return;
    if (isRightLeg && !shouldDrawRight) return;

    // Convert normalized coordinates to canvas coordinates
    const startX = startLandmark.x * canvas.width;
    const startY = startLandmark.y * canvas.height;
    const endX = endLandmark.x * canvas.width;
    const endY = endLandmark.y * canvas.height;

    // Determine color based on which leg
    let color = '#FFFFFF';
    if (isLeftLeg) {
      color = getColorHex(leftLegColor);
    } else if (isRightLeg) {
      color = getColorHex(rightLegColor);
    }

    // Draw line with glow effect for better visibility
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Draw landmark points (joints)
  Object.values(LOWER_BODY_LANDMARKS).forEach((index) => {
    const landmark = landmarks[index];
    if (!landmark || landmark.visibility < 0.45) return;
    if (!isInBounds(landmark)) return;

    // Determine if this landmark is left or right
    const isLeftLandmark = [23, 25, 27, 29, 31].includes(index);
    const isRightLandmark = [24, 26, 28, 30, 32].includes(index);

    // Skip if this leg shouldn't be drawn
    if (isLeftLandmark && !shouldDrawLeft) return;
    if (isRightLandmark && !shouldDrawRight) return;

    const x = landmark.x * canvas.width;
    const y = landmark.y * canvas.height;

    // Larger, more visible joints
    const jointRadius = [25, 26].includes(index) ? 10 : 7; // Knees larger

    // Draw outer circle with glow (white border)
    ctx.beginPath();
    ctx.arc(x, y, jointRadius + 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw inner circle (colored)
    ctx.beginPath();
    ctx.arc(x, y, jointRadius, 0, 2 * Math.PI);
    
    // Color based on joint type
    if (index === LOWER_BODY_LANDMARKS.LEFT_KNEE) {
      ctx.fillStyle = getColorHex(leftLegColor);
    } else if (index === LOWER_BODY_LANDMARKS.RIGHT_KNEE) {
      ctx.fillStyle = getColorHex(rightLegColor);
    } else {
      ctx.fillStyle = '#4A5568'; // Gray for other joints
    }
    ctx.fill();
  });

  // Draw knee angles if provided
  if (leftAngle !== null) {
    drawKneeAngle(ctx, landmarks, 'left', leftAngle, leftLegColor);
  }
  if (rightAngle !== null) {
    drawKneeAngle(ctx, landmarks, 'right', rightAngle, rightLegColor);
  }
  
  // Return true to indicate successful drawing
  return true;
};

/**
 * Draw knee angle annotation on canvas
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} landmarks - Pose landmarks
 * @param {string} side - 'left' or 'right'
 * @param {number} angle - Knee angle in degrees
 * @param {string} color - Color name
 */
export const drawKneeAngle = (ctx, landmarks, side, angle, color = 'white') => {
  const kneeIndex = side === 'left' 
    ? LOWER_BODY_LANDMARKS.LEFT_KNEE 
    : LOWER_BODY_LANDMARKS.RIGHT_KNEE;

  const knee = landmarks[kneeIndex];
  if (!knee || knee.visibility < 0.5) return;

  const canvas = ctx.canvas;
  const x = knee.x * canvas.width;
  const y = knee.y * canvas.height;

  // Draw angle arc
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, 2 * Math.PI, false);
  ctx.strokeStyle = getColorHex(color);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw angle text (un-mirror to counteract CSS scaleX(-1))
  ctx.save();
  ctx.translate(x, y - 50);
  ctx.scale(-1, 1);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = getColorHex(color);
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(angle)}°`, 0, 0);
  ctx.restore();
};

/**
 * Convert color name to hex
 * @param {string} color - Color name
 * @returns {string} Hex color code
 */
const getColorHex = (color) => {
  const colorMap = {
    'green': '#00FF00',
    'red': '#FF0000',
    'yellow': '#FFD700',
    'white': '#FFFFFF',
    'gray': '#9CA3AF'
  };
  return colorMap[color] || color;
};

/**
 * Draw minimal UI overlay showing only essential stats
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Statistics to display
 */
export const drawStatsOverlay = (ctx, stats = {}) => {
  const canvas = ctx.canvas;
  const {
    leftAngle = null,
    rightAngle = null,
    reps = 0,
    improvement = 0,
    phase = 'exercise'
  } = stats;

  // Save context for un-mirroring
  ctx.save();
  ctx.scale(-1, 1);

  // Draw semi-transparent background for stats (mirrored coordinates)
  const bgX = -210; // Negative X because we're mirrored
  const bgWidth = 200;
  const bgHeight = phase === 'calibration' ? 100 : 150;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(bgX, 10, bgWidth, bgHeight);

  // Text settings
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';

  let yOffset = 35;
  const textX = bgX + 10;

  if (phase === 'calibration') {
    ctx.fillText('📏 CALIBRATION MODE', textX, yOffset);
    yOffset += 25;
    if (leftAngle) {
      ctx.fillText(`Max Angle: ${Math.round(leftAngle)}°`, textX, yOffset);
    }
  } else {
    ctx.fillText(`Angle: ${leftAngle ? Math.round(leftAngle) : '--'}°`, textX, yOffset);
    yOffset += 25;
    ctx.fillText(`Reps: ${reps}`, textX, yOffset);
    yOffset += 25;
    ctx.fillStyle = '#00FF00';
    ctx.fillText(`Progress: ${improvement}%`, textX, yOffset);
  }

  ctx.restore();
};

/**
 * Draw full-screen feedback overlay
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} message - Message to display
 * @param {string} type - 'success' | 'warning' | 'info'
 */
export const drawFeedbackOverlay = (ctx, message, type = 'info') => {
  const canvas = ctx.canvas;
  
  // Save context for un-mirroring
  ctx.save();
  ctx.scale(-1, 1);
  
  // Semi-transparent overlay (mirrored coordinates)
  ctx.fillStyle = type === 'success' 
    ? 'rgba(0, 255, 0, 0.15)' 
    : type === 'warning'
    ? 'rgba(255, 0, 0, 0.15)'
    : 'rgba(255, 215, 0, 0.1)';
  
  ctx.fillRect(-canvas.width, 0, canvas.width, canvas.height);

  // Message text (centered in mirrored coordinates)
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  
  const x = -canvas.width / 2; // Negative because mirrored
  const y = canvas.height / 2;
  
  ctx.strokeText(message, x, y);
  ctx.fillText(message, x, y);
  
  ctx.restore();
};

export default {
  LOWER_BODY_LANDMARKS,
  LEG_CONNECTIONS,
  areLowerBodyLandmarksVisible,
  extractLowerBodyLandmarks,
  drawLegSkeleton,
  drawKneeAngle,
  drawStatsOverlay,
  drawFeedbackOverlay
};
