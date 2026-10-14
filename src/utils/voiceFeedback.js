import { speakFeedback, setTTSEnabled, cancelSpeech, isTTSAvailable } from './tts';

const normalizeExerciseName = (name = '') => String(name).toLowerCase();

const createInstructionSet = (exerciseName = '') => {
  const normalizedName = normalizeExerciseName(exerciseName);

  if (normalizedName.includes('straight leg raise')) {
    return {
      incorrect: 'Keep your knee straight while lifting.',
      correct: 'Lower your leg slowly and keep control.',
      neutral: 'Lift with a slow controlled motion.'
    };
  }

  if (normalizedName.includes('bodyweight squat') || normalizedName.includes('mini squat') || normalizedName.includes('standing knee bend')) {
    return {
      incorrect: 'Keep your knees aligned and your movement controlled.',
      correct: 'Return to the standing position slowly.',
      neutral: 'Keep your posture tall and move with control.'
    };
  }

  if (normalizedName.includes('knee extension')) {
    return {
      incorrect: 'Keep your knee straight and controlled.',
      correct: 'Hold the straightened position steadily.',
      neutral: 'Straighten the knee gently and smoothly.'
    };
  }

  return {
    incorrect: 'Bend your knee slowly and keep the motion controlled.',
    correct: 'Hold the position steadily and maintain control.',
    neutral: 'Move slowly and keep your knee aligned.'
  };
};

export const buildExerciseInstruction = ({
  exerciseName = '',
  postureState = 'neutral',
  currentAngle = null,
  baselineROM = null
} = {}) => {
  const instructionSet = createInstructionSet(exerciseName);
  const exerciseState = postureState === 'correct' ? 'correct' : postureState === 'incorrect' ? 'incorrect' : 'neutral';

  if (exerciseState === 'incorrect') {
    return instructionSet.incorrect;
  }

  if (exerciseState === 'correct') {
    return instructionSet.correct;
  }

  if (typeof currentAngle === 'number' && typeof baselineROM === 'number' && currentAngle < baselineROM - 5) {
    return instructionSet.incorrect;
  }

  return instructionSet.neutral;
};

const voiceState = {
  lastInstruction: '',
  lastSpokenAt: 0
};

export const speakExerciseInstruction = ({
  exerciseName,
  postureState,
  currentAngle,
  baselineROM,
  forced = false,
  cooldownMs = 5000
} = {}) => {
  const message = buildExerciseInstruction({ exerciseName, postureState, currentAngle, baselineROM });
  if (!message) {
    return null;
  }

  const now = Date.now();
  if (!forced && message === voiceState.lastInstruction && now - voiceState.lastSpokenAt < cooldownMs) {
    return null;
  }

  voiceState.lastInstruction = message;
  voiceState.lastSpokenAt = now;
  speakFeedback(message, { priority: 'high', force: forced });
  return message;
};

export const repeatLastInstruction = () => {
  if (!voiceState.lastInstruction) {
    return null;
  }

  speakFeedback(voiceState.lastInstruction, { priority: 'high', force: true });
  return voiceState.lastInstruction;
};

export const muteVoice = () => {
  setTTSEnabled(false);
  cancelSpeech();
};

export const unmuteVoice = () => {
  setTTSEnabled(true);
};

export const isVoiceSupportAvailable = () => isTTSAvailable();

export const getLatestVoiceInstruction = () => voiceState.lastInstruction;
