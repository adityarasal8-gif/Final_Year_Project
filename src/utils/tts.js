/**
 * tts.js
 * Text-to-Speech feedback system for auditory cues
 * Provides voice guidance during exercise sessions
 */

/**
 * TTS Manager Class
 * Handles Text-to-Speech with queue management and throttling
 */
class TTSManager {
  constructor() {
    this.synth = window.speechSynthesis;
    this.isSpeaking = false;
    this.enabled = true;
    this.lastMessage = null;
    this.lastMessageTime = 0;
    this.throttleDelay = 3000; // 3 seconds between same messages
    this.queue = [];
  }

  /**
   * Speak a message with throttling
   * @param {string} message - Message to speak
   * @param {Object} options - Speech options
   */
  speak(message, options = {}) {
    if (!this.enabled || !this.synth) return;

    const {
      priority = 'normal', // 'high' | 'normal' | 'low'
      force = false
    } = options;

    // Throttle repeated messages
    const now = Date.now();
    if (
      !force &&
      message === this.lastMessage &&
      now - this.lastMessageTime < this.throttleDelay
    ) {
      return;
    }

    // Cancel current speech for high priority messages
    if (priority === 'high' && this.isSpeaking) {
      this.synth.cancel();
      this.queue = [];
    }

    this.lastMessage = message;
    this.lastMessageTime = now;

    const utterance = new SpeechSynthesisUtterance(message);
    
    // Configure voice settings
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.processQueue();
    };

    utterance.onerror = (error) => {
      console.error('TTS Error:', error);
      this.isSpeaking = false;
      this.processQueue();
    };

    if (this.isSpeaking && priority !== 'high') {
      this.queue.push(utterance);
    } else {
      this.synth.speak(utterance);
    }
  }

  /**
   * Process queued messages
   */
  processQueue() {
    if (this.queue.length > 0 && !this.isSpeaking) {
      const next = this.queue.shift();
      this.synth.speak(next);
    }
  }

  /**
   * Cancel all speech
   */
  cancel() {
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
  }

  /**
   * Enable/disable TTS
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  /**
   * Check if TTS is available
   */
  isAvailable() {
    return 'speechSynthesis' in window;
  }
}

// Create singleton instance
const ttsManager = new TTSManager();

/**
 * Predefined feedback messages
 */
export const FEEDBACK_MESSAGES = {
  // Calibration
  CALIBRATION_START: 'Calibration mode. Bend your knee as much as you comfortably can.',
  CALIBRATION_COMPLETE: 'Baseline set successfully. You can now start your exercise.',

  // Exercise feedback
  GOOD_REP: 'Good job!',
  EXCELLENT_REP: 'Excellent! Target reached!',
  BELOW_BASELINE: 'Try to bend more.',
  STRAIGHTEN_LEG: 'Straighten your leg.',
  
  // Progress milestones
  REP_5: 'Five reps completed. Keep going!',
  REP_10: 'Ten reps done. Great progress!',
  REP_15: 'Fifteen reps! Almost there!',
  SET_COMPLETE: 'Set complete! Take a rest.',

  // Guidance
  POSITION_LEGS: 'Please position your legs in the camera frame.',
  LEGS_VISIBLE: 'Legs detected. Start your exercise.',
  HOLD_POSITION: 'Hold this position.',

  // Errors
  POSE_LOST: 'Pose tracking lost. Please adjust your position.',
  LOW_VISIBILITY: 'Move closer to the camera for better tracking.'
};

/**
 * Speak a feedback message
 * @param {string} message - Message to speak
 * @param {Object} options - Speech options
 */
export const speakFeedback = (message, options = {}) => {
  ttsManager.speak(message, options);
};

/**
 * Speak calibration feedback
 */
export const speakCalibrationFeedback = (maxAngle) => {
  if (maxAngle) {
    speakFeedback(`Maximum angle detected: ${Math.round(maxAngle)} degrees.`);
  }
};

/**
 * Speak rep completion feedback
 * @param {number} repNumber - Current rep number
 * @param {number} maxAngle - Max angle achieved in rep
 */
export const speakRepFeedback = (repNumber, maxAngle) => {
  // Milestone messages
  if (repNumber === 5) {
    speakFeedback(FEEDBACK_MESSAGES.REP_5, { priority: 'high' });
  } else if (repNumber === 10) {
    speakFeedback(FEEDBACK_MESSAGES.REP_10, { priority: 'high' });
  } else if (repNumber === 15) {
    speakFeedback(FEEDBACK_MESSAGES.REP_15, { priority: 'high' });
  } else if (repNumber % 20 === 0) {
    speakFeedback(`${repNumber} reps completed!`, { priority: 'high' });
  } else {
    // Regular rep feedback
    if (maxAngle > 130) {
      speakFeedback(FEEDBACK_MESSAGES.EXCELLENT_REP);
    } else {
      speakFeedback(FEEDBACK_MESSAGES.GOOD_REP);
    }
  }
};

/**
 * Speak angle feedback (during exercise)
 * @param {number} currentAngle - Current knee angle
 * @param {number} baselineROM - Baseline ROM
 * @param {number} targetROM - Target ROM
 */
export const speakAngleFeedback = (currentAngle, baselineROM, targetROM = 135) => {
  if (currentAngle >= targetROM) {
    speakFeedback(FEEDBACK_MESSAGES.EXCELLENT_REP, { priority: 'low' });
  } else if (currentAngle < baselineROM - 5) {
    speakFeedback(FEEDBACK_MESSAGES.BELOW_BASELINE, { priority: 'normal' });
  }
};

/**
 * Speak guidance message
 * @param {string} messageKey - Key from FEEDBACK_MESSAGES
 * @param {Object} options - Speech options
 */
export const speakGuidance = (messageKey, options = {}) => {
  const message = FEEDBACK_MESSAGES[messageKey];
  if (message) {
    speakFeedback(message, { priority: 'high', ...options });
  }
};

/**
 * Cancel all speech
 */
export const cancelSpeech = () => {
  ttsManager.cancel();
};

/**
 * Enable/disable TTS
 * @param {boolean} enabled - Enable state
 */
export const setTTSEnabled = (enabled) => {
  ttsManager.setEnabled(enabled);
};

/**
 * Check if TTS is available
 * @returns {boolean} True if available
 */
export const isTTSAvailable = () => {
  return ttsManager.isAvailable();
};

export default {
  FEEDBACK_MESSAGES,
  speakFeedback,
  speakCalibrationFeedback,
  speakRepFeedback,
  speakAngleFeedback,
  speakGuidance,
  cancelSpeech,
  setTTSEnabled,
  isTTSAvailable
};
