/**
 * exercises.js
 * Exercise library with detailed information for each exercise
 */

export const exerciseLibrary = [
  {
    id: 'knee-flexion',
    name: 'Knee Flexion',
    category: 'Knee',
    difficulty: 'Beginner',
    duration: '10-12 min',
    targetAngle: 145,
    muscleGroups: ['Hamstrings', 'Calves', 'Glutes'],
    description: 'Improve knee range of motion by bending the knee',
    legSide: 'left', // or 'right' or 'both'
    targetSets: 3,
    targetReps: 15,
    restBetweenSets: 60, // seconds

    // Angle interpretation for this exercise.
    // flexion_rom = 180 - inner knee angle, where higher means deeper bend.
    angleMode: 'flexion_rom',
    
    // Instructions for the exercise
    instructions: [
      'Lie on your back with legs straight and relaxed',
      'Slowly bend your knee, bringing your heel toward your buttocks',
      'Hold the position for 2 seconds at maximum flexion',
      'Slowly return your leg to the starting position',
      'Repeat the movement smoothly and controlled'
    ],
    
    // Setup requirements
    setup: [
      { text: 'Exercise mat or comfortable surface', checked: false },
      { text: 'Camera positioned to capture full leg', checked: false },
      { text: 'Comfortable, non-restrictive clothing', checked: false },
      { text: '2x2 meter clear space', checked: false }
    ],
    
    // Camera positioning
    cameraGuide: {
      distance: '2-3 meters',
      angle: 'Side view',
      height: 'Knee level when lying down',
      instructions: 'Position camera to the side so your full leg is visible from hip to ankle'
    },
    
    // Safety tips
    safetyTips: [
      'Stop if you feel sharp pain',
      'Breathe normally throughout the movement',
      'Move slowly and controlled',
      'Do not force the movement beyond comfortable range'
    ],
    
    // Common mistakes
    commonMistakes: [
      { mistake: 'Moving too fast', correction: 'Perform each rep slowly over 4-5 seconds' },
      { mistake: 'Not holding at max flexion', correction: 'Hold for 2 seconds at the top' },
      { mistake: 'Lifting hip off ground', correction: 'Keep both hips on the mat' }
    ],
    
    // Rep detection parameters
    repDetection: {
      movementPattern: 'increase_then_decrease',
      peakThreshold: 58,
      resetThreshold: 20,
      minPeakHoldTime: 250,
      minRepInterval: 650
    },

    posture: {
      minAngle: 10,
      maxAngle: 150,
      requireSymmetry: false,
      maxSideDiff: 30
    },

    calibration: {
      peakThreshold: 35,
      resetThreshold: 15,
      minPeakHoldTime: 250,
      minRepInterval: 650
    },

    demo: {
      type: 'animation',
      key: 'knee-flexion'
    }
  },
  
  {
    id: 'knee-extension',
    name: 'Knee Extension',
    category: 'Knee',
    difficulty: 'Beginner',
    duration: '10-12 min',
    targetAngle: 180,
    muscleGroups: ['Quadriceps', 'Hip Flexors'],
    description: 'Strengthen knee extension and improve straightening ability',
    legSide: 'left',
    targetSets: 3,
    targetReps: 15,
    restBetweenSets: 60,

    angleMode: 'inner_knee_angle',
    
    instructions: [
      'Sit on a chair with feet flat on the ground',
      'Slowly straighten your knee, lifting your foot off the ground',
      'Hold your leg straight for 3 seconds',
      'Slowly lower your foot back to the ground',
      'Keep your thigh on the chair throughout'
    ],
    
    setup: [
      { text: 'Sturdy chair without wheels', checked: false },
      { text: 'Camera at leg height, side view', checked: false },
      { text: 'Both feet can touch ground when sitting', checked: false },
      { text: 'Clear space in front of chair', checked: false }
    ],
    
    cameraGuide: {
      distance: '2-3 meters',
      angle: 'Side view',
      height: 'Knee level when seated',
      instructions: 'Position camera to the side to capture full leg from hip to ankle'
    },
    
    safetyTips: [
      'Do not lock your knee forcefully',
      'Keep movements smooth and controlled',
      'Hold onto chair for balance if needed',
      'Stop if you feel pain behind the knee'
    ],
    
    commonMistakes: [
      { mistake: 'Lifting leg too high', correction: 'Only straighten knee, do not lift thigh' },
      { mistake: 'Not fully extending', correction: 'Straighten leg completely each rep' },
      { mistake: 'Using momentum', correction: 'Control the movement, do not swing' }
    ],
    
    repDetection: {
      movementPattern: 'increase_then_decrease',
      peakThreshold: 160,
      resetThreshold: 105,
      minPeakHoldTime: 300,
      minRepInterval: 700
    },

    posture: {
      minAngle: 80,
      maxAngle: 180,
      requireSymmetry: false,
      maxSideDiff: 35
    },

    calibration: {
      peakThreshold: 145,
      resetThreshold: 110,
      minPeakHoldTime: 250,
      minRepInterval: 700
    },

    demo: {
      type: 'animation',
      key: 'knee-extension'
    }
  },
  
  {
    id: 'straight-leg-raise',
    name: 'Straight Leg Raise',
    category: 'Hip',
    difficulty: 'Intermediate',
    duration: '8-10 min',
    targetAngle: 60,
    muscleGroups: ['Hip Flexors', 'Quadriceps', 'Core'],
    description: 'Strengthen hip flexors and improve leg control',
    legSide: 'left',
    targetSets: 3,
    targetReps: 12,
    restBetweenSets: 60,

    angleMode: 'inner_knee_angle',
    
    instructions: [
      'Lie on your back with one leg bent and one straight',
      'Tighten the thigh muscle of the straight leg',
      'Lift the straight leg about 30-45 degrees',
      'Hold for 2 seconds at the top',
      'Slowly lower back down without touching the ground'
    ],
    
    setup: [
      { text: 'Exercise mat', checked: false },
      { text: 'Camera at side view, full body visible', checked: false },
      { text: 'Space to extend legs fully', checked: false }
    ],
    
    cameraGuide: {
      distance: '3-4 meters',
      angle: 'Side view',
      height: 'Hip level when lying down',
      instructions: 'Camera should capture from head to feet to track leg angle'
    },
    
    safetyTips: [
      'Keep leg completely straight',
      'Do not arch your lower back',
      'Engage core muscles',
      'Stop if you feel lower back pain'
    ],
    
    commonMistakes: [
      { mistake: 'Arching back', correction: 'Press lower back into mat, engage core' },
      { mistake: 'Bending knee', correction: 'Keep leg completely straight throughout' },
      { mistake: 'Lifting too high', correction: 'Only lift 30-45 degrees, control is key' }
    ],
    
    repDetection: {
      movementPattern: 'increase_then_decrease',
      peakThreshold: 168,
      resetThreshold: 148,
      minPeakHoldTime: 250,
      minRepInterval: 750
    },

    posture: {
      minAngle: 140,
      maxAngle: 180,
      requireSymmetry: false,
      maxSideDiff: 40
    },

    calibration: {
      peakThreshold: 162,
      resetThreshold: 145,
      minPeakHoldTime: 200,
      minRepInterval: 700
    },

    demo: {
      type: 'animation',
      key: 'straight-leg-raise'
    }
  },
  
  {
    id: 'bodyweight-squats',
    name: 'Bodyweight Squats',
    category: 'Lower Body',
    difficulty: 'Beginner',
    duration: '10-12 min',
    targetAngle: 90,
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings', 'Calves', 'Core'],
    description: 'Strengthen lower body and improve functional movement patterns',
    legSide: 'both',
    targetSets: 3,
    targetReps: 15,
    restBetweenSets: 60,

    angleMode: 'flexion_rom',
    
    instructions: [
      'Stand with feet shoulder-width apart, toes slightly pointed out',
      'Keep your chest up and core engaged throughout the movement',
      'Lower your body by bending at the hips and knees simultaneously',
      'Descend until thighs are parallel to the ground (90-degree knee angle)',
      'Push through your heels to return to standing position',
      'Keep your knees aligned with your toes throughout the movement'
    ],
    
    setup: [
      { text: 'Non-slip surface or exercise mat', checked: false },
      { text: 'Camera positioned at side view, 3 meters away', checked: false },
      { text: 'Full body visible (head to feet)', checked: false },
      { text: '2x2 meter clear space around you', checked: false },
      { text: 'Optional: chair behind you for safety', checked: false }
    ],
    
    cameraGuide: {
      distance: '3-4 meters',
      angle: 'Side view (90 degrees to your body)',
      height: 'Hip to chest level',
      instructions: 'Position camera to the side so your full body is visible from head to feet. This allows tracking of knee angle and depth.'
    },
    
    safetyTips: [
      'Keep your knees behind your toes',
      'Do not let knees collapse inward',
      'Keep your back neutral, avoid rounding',
      'Look straight ahead, not down',
      'If you feel knee pain, reduce depth',
      'Place a chair behind you if unsure about balance'
    ],
    
    commonMistakes: [
      { mistake: 'Knees caving inward', correction: 'Push knees outward, keep them aligned with toes' },
      { mistake: 'Heels lifting off ground', correction: 'Keep weight on heels, push through them' },
      { mistake: 'Rounding lower back', correction: 'Keep chest up, engage core, maintain neutral spine' },
      { mistake: 'Not going deep enough', correction: 'Lower until thighs are parallel to ground' },
      { mistake: 'Moving too fast', correction: 'Control the descent, take 2-3 seconds down' }
    ],
    
    repDetection: {
      movementPattern: 'increase_then_decrease',
      peakThreshold: 70,
      resetThreshold: 22,
      minPeakHoldTime: 220,
      minRepInterval: 650
    },

    posture: {
      minAngle: 15,
      maxAngle: 120,
      requireSymmetry: true,
      maxSideDiff: 18
    },

    calibration: {
      peakThreshold: 35,
      resetThreshold: 18,
      minPeakHoldTime: 220,
      minRepInterval: 650
    },

    demo: {
      type: 'animation',
      key: 'bodyweight-squats'
    }
  }
];

/**
 * Get exercise by ID
 */
export const getExerciseById = (id) => {
  return exerciseLibrary.find(ex => ex.id === id);
};

/**
 * Get exercises by category
 */
export const getExercisesByCategory = (category) => {
  return exerciseLibrary.filter(ex => ex.category === category);
};

/**
 * Get exercises by difficulty
 */
export const getExercisesByDifficulty = (difficulty) => {
  return exerciseLibrary.filter(ex => ex.difficulty === difficulty);
};
