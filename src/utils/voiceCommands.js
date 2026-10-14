const findRecognitionClass = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const normalizeCommand = (transcript = '') => {
  const normalized = String(transcript).toLowerCase().trim();
  if (!normalized) {
    return '';
  }

  if (normalized.includes('start exercise')) return 'start';
  if (normalized.includes('stop exercise')) return 'stop';
  if (normalized.includes('repeat instruction')) return 'repeat';
  if (normalized.includes('mute voice')) return 'mute';
  if (normalized.includes('unmute voice')) return 'unmute';
  if (normalized.includes('next exercise')) return 'next';
  return '';
};

export const isVoiceCommandSupported = () => !!findRecognitionClass();

export const createVoiceCommandController = ({
  onCommand,
  onStatusChange,
  onError
}) => {
  const RecognitionClass = findRecognitionClass();

  if (!RecognitionClass) {
    return {
      supported: false,
      start: () => {
        onStatusChange?.('Voice commands are not supported in this browser.');
      },
      stop: () => {},
      destroy: () => {}
    };
  }

  const recognition = new RecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let isListening = false;
  let shouldListen = false;

  const updateStatus = (status) => {
    onStatusChange?.(status);
  };

  recognition.onstart = () => {
    isListening = true;
    updateStatus('Listening for voice commands');
  };

  recognition.onresult = (event) => {
    const firstNewResult = Number.isInteger(event.resultIndex) ? event.resultIndex : event.results.length - 1;
    const transcript = Array.from(event.results)
      .slice(firstNewResult)
      .map((result) => result[0]?.transcript || '')
      .join(' ')
      .trim();

    if (!transcript) {
      return;
    }

    const command = normalizeCommand(transcript);
    if (command) {
      updateStatus(`Heard: ${transcript}`);
      onCommand?.(command, transcript);
      return;
    }

    updateStatus(`Heard: ${transcript}`);
  };

  recognition.onerror = (event) => {
    const errorName = event?.error || 'unknown';
    const message = errorName === 'not-allowed'
      ? 'Microphone permission was denied.'
      : errorName === 'no-speech'
        ? 'No voice command detected.'
        : 'Voice command listener encountered an error.';

    isListening = false;
    if (errorName === 'not-allowed' || errorName === 'service-not-allowed') {
      shouldListen = false;
    }
    updateStatus(message);
    onError?.(errorName, message);
  };

  recognition.onend = () => {
    isListening = false;
    if (shouldListen) {
      window.setTimeout(() => {
        if (!shouldListen) return;
        try {
          recognition.start();
        } catch (error) {
          updateStatus('Voice command listener could not restart. Disable and enable it to retry.');
        }
      }, 250);
    }
  };

  return {
    supported: true,
    start: () => {
      try {
        shouldListen = true;
        recognition.start();
      } catch (error) {
        shouldListen = false;
        const message = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. Enable it in the browser to use voice commands.'
          : 'Voice command listening could not be started. Disable and enable it to retry.';

        updateStatus(message);
        onError?.(error?.name || 'microphone-error', message);
      }
    },
    stop: () => {
      shouldListen = false;
      if (isListening) {
        recognition.stop();
      }
      isListening = false;
    },
    destroy: () => {
      shouldListen = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      recognition.stop();
      isListening = false;
    },
    isListening: () => isListening
  };
};
