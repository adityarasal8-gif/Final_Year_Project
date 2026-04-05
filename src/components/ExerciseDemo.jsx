/**
 * ExerciseDemo.jsx
 * Pre-exercise instruction screen with placeholder demo media.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AlertCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const VideoIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const CameraIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const ArrowLeftIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const PlayIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const getYouTubeEmbedData = (urlString) => {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.replace('www.', '');
    let videoId = null;

    if (host === 'youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || null;
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2] || null;
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] || null;
      }
    }

    if (!videoId) return null;

    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    };
  } catch {
    return null;
  }
};

const resolveDemoMedia = (rawUrl) => {
  const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!normalized) return { kind: 'none' };

  const youtubeData = getYouTubeEmbedData(normalized);
  if (youtubeData) {
    return {
      kind: 'youtube',
      url: normalized,
      ...youtubeData
    };
  }

  const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(normalized);
  if (isDirectVideo) {
    return {
      kind: 'direct',
      url: normalized
    };
  }

  return {
    kind: 'external',
    url: normalized
  };
};

const getLegOptions = () => [
  { value: 'left', label: 'Left Leg' },
  { value: 'right', label: 'Right Leg' },
  { value: 'both', label: 'Both Legs' }
];

const ExerciseDemo = ({ exercise, onStart, onBack }) => {
  const setupItems = exercise?.setup || [];
  const instructions = exercise?.instructions || [];
  const commonMistakes = exercise?.commonMistakes || [];
  const safetyTips = exercise?.safetyTips || [];
  const cameraGuide = exercise?.cameraGuide || {};

  const [checklist, setChecklist] = useState(
    setupItems.map((item, idx) => ({
      id: `checkbox-${idx}`,
      text: item.text,
      checked: item.checked || false
    }))
  );
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState(exercise.legSide || 'left');

  const demoMedia = resolveDemoMedia(exercise?.demo?.videoUrl);
  const legOptions = getLegOptions();
  const hasAnyDemoLink = demoMedia.kind !== 'none';

  const allChecked = checklist.every((item) => item.checked);

  const toggleCheckItem = (index) => {
    setChecklist((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, checked: !item.checked } : item))
    );
  };

  const toggleAllChecklist = () => {
    const shouldCheckAll = !allChecked;
    setChecklist((prev) => prev.map((item) => ({ ...item, checked: shouldCheckAll })));
  };

  const handleStartExercise = () => {
    onStart(selectedLeg);
  };

  const handleDemoPreviewClick = () => {
    if (!hasAnyDemoLink) return;

    if (demoMedia.kind === 'external') {
      window.open(demoMedia.url, '_blank', 'noopener,noreferrer');
      return;
    }

    setShowVideoModal(true);
  };

  return (
    <div className="min-h-screen bg-medical-background">
      <div className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white px-6 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium mb-3">
                {exercise.category} - {exercise.difficulty} - {exercise.duration}
              </span>
              <h1 className="text-4xl font-bold mb-3">{exercise.name}</h1>
              <p className="text-xl text-teal-50 mb-4">{exercise.description}</p>
              <div className="flex flex-wrap gap-2">
                {exercise.muscleGroups.map((muscle) => (
                  <span key={muscle} className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-sm font-bold bg-white/20 px-4 py-2 rounded-lg">Ready to Practice</div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <h2 className="text-xl font-bold text-medical-text-primary mb-4">Exercise Demo</h2>
              <motion.button
                type="button"
                whileHover={hasAnyDemoLink ? { scale: 1.01 } : undefined}
                whileTap={hasAnyDemoLink ? { scale: 0.99 } : undefined}
                onClick={handleDemoPreviewClick}
                disabled={!hasAnyDemoLink}
                className={`w-full aspect-video border rounded-xl mb-4 overflow-hidden relative ${
                  hasAnyDemoLink
                    ? 'cursor-pointer border-teal-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500'
                    : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                }`}
              >
                {demoMedia.kind === 'youtube' && (
                  <>
                    <img
                      src={demoMedia.thumbnailUrl}
                      alt={`${exercise.name} demo preview`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                        <PlayIcon className="w-8 h-8 text-teal-700 ml-0.5" />
                      </div>
                    </div>
                  </>
                )}

                {demoMedia.kind === 'direct' && (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center mb-3">
                      <PlayIcon className="w-8 h-8 text-white ml-0.5" />
                    </div>
                    <p className="text-sm font-semibold">Tap to play demo video</p>
                  </div>
                )}

                {demoMedia.kind === 'external' && (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-50 to-teal-50 text-teal-900 flex flex-col items-center justify-center p-4">
                    <VideoIcon className="w-12 h-12 mb-2" />
                    <p className="text-sm font-semibold text-center">Tap to open demo video</p>
                  </div>
                )}

                {demoMedia.kind === 'none' && (
                  <div className="w-full h-full text-gray-500 flex flex-col items-center justify-center p-4">
                    <VideoIcon className="w-14 h-14 mb-2" />
                    <p className="text-sm font-semibold">Demo preview not available yet</p>
                  </div>
                )}
              </motion.button>

              <p className="text-xs text-slate-600 font-medium">
                {hasAnyDemoLink
                  ? 'Tap the demo screen to start the video.'
                  : 'Add exercise.demo.videoUrl in exercises.js to enable this preview.'}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <h2 className="text-xl font-bold text-medical-text-primary mb-4">
                How to Perform
              </h2>
              <div className="space-y-4">
                {instructions.map((instruction, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <p className="text-medical-text-secondary flex-1 pt-1">
                      {instruction}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                <AlertCircleIcon className="w-5 h-5" />
                Common Mistakes to Avoid
              </h3>
              <div className="space-y-3">
                {commonMistakes.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-red-500 text-xl flex-shrink-0">x</span>
                    <div>
                      <p className="font-semibold text-amber-900">{item.mistake}</p>
                      <p className="text-sm text-amber-700">Fix: {item.correction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-medical-text-primary">
                  Preparation Checklist
                </h2>
                <button
                  type="button"
                  onClick={toggleAllChecklist}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
                >
                  {allChecked ? 'Clear All' : 'Check All'}
                </button>
              </div>
              <div className="space-y-3">
                {checklist.map((item, index) => (
                  <label
                    key={item.id}
                    htmlFor={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      item.checked
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={item.id}
                      checked={item.checked}
                      onChange={() => toggleCheckItem(index)}
                      className="sr-only"
                    />
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        item.checked
                          ? 'bg-teal-600 border-teal-600'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {item.checked && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 select-none ${item.checked ? 'text-teal-900 font-medium' : 'text-gray-700'}`}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-gradient-to-br from-cyan-50 to-teal-50 border-2 border-teal-200 rounded-2xl p-6 shadow-md"
            >
              <h2 className="text-xl font-bold text-medical-text-primary mb-4">
                Select Movement Side
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {legOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedLeg(option.value)}
                    className={`p-6 rounded-xl border-2 transition-all transform hover:scale-105 ${
                      selectedLeg === option.value
                        ? 'bg-teal-600 border-teal-700 text-white shadow-lg'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-teal-400'
                    }`}
                  >
                    <div className={`font-bold text-lg ${selectedLeg === option.value ? 'text-white' : 'text-gray-900'}`}>
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 p-3 bg-cyan-100 rounded-lg">
                <p className="text-sm text-cyan-900">
                  <span className="font-semibold">Tip:</span> {selectedLeg === 'both'
                    ? 'Keep both legs fully visible from hip to ankle.'
                    : `Keep the entire ${selectedLeg} leg visible from hip to ankle.`}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <h2 className="text-xl font-bold text-medical-text-primary mb-4 flex items-center gap-2">
                <CameraIcon className="w-6 h-6 text-teal-600" />
                Camera Positioning
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Distance:</span>
                  <span className="font-semibold text-gray-900">{cameraGuide.distance || '2-3 meters'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Angle:</span>
                  <span className="font-semibold text-gray-900">{cameraGuide.angle || 'Side view'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Height:</span>
                  <span className="font-semibold text-gray-900">{cameraGuide.height || 'Knee level'}</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    Tip: {cameraGuide.instructions || 'Keep your full movement visible in frame during all reps.'}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
                <AlertCircleIcon className="w-5 h-5" />
                Safety Guidelines
              </h3>
              <ul className="space-y-2">
                {safetyTips.map((tip, index) => (
                  <li key={index} className="flex gap-2 text-sm text-red-800">
                    <span className="text-red-500">-</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-6"
            >
              <h3 className="font-bold mb-4">Session Target</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-3xl font-bold">{exercise.targetReps}</div>
                  <div className="text-sm text-indigo-200">Reps per set</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{exercise.targetSets}</div>
                  <div className="text-sm text-indigo-200">Total sets</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between">
                  <span className="text-indigo-200">Total Reps:</span>
                  <span className="font-bold">{exercise.targetReps * exercise.targetSets}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-indigo-200">Est. Duration:</span>
                  <span className="font-bold">{exercise.duration}</span>
                </div>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={handleStartExercise}
              disabled={!allChecked}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                allChecked
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <PlayIcon className="w-6 h-6" />
              {allChecked
                ? `Start Exercise - ${selectedLeg === 'both' ? 'Both Legs' : `${selectedLeg.charAt(0).toUpperCase() + selectedLeg.slice(1)} Leg`}`
                : 'Complete Checklist First'}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showVideoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowVideoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {demoMedia.kind === 'youtube' ? (
                <div className="aspect-video bg-black border border-gray-200 rounded-xl overflow-hidden">
                  <iframe
                    title={`${exercise.name} demo video`}
                    src={demoMedia.embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : demoMedia.kind === 'direct' ? (
                <div className="aspect-video bg-black border border-gray-200 rounded-xl overflow-hidden">
                  <video
                    className="w-full h-full"
                    src={demoMedia.url}
                    controls
                    autoPlay
                  />
                </div>
              ) : demoMedia.kind === 'external' ? (
                <div className="aspect-video bg-gray-100 border border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-600 p-6 text-center">
                  <VideoIcon className="w-14 h-14 mb-3" />
                  <p className="font-semibold text-gray-700">External Demo Link</p>
                  <p className="text-sm text-gray-500 mt-1">This link cannot be embedded automatically.</p>
                  <a
                    href={demoMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Open Video Link
                  </a>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 border border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-500">
                  <VideoIcon className="w-16 h-16 mb-3" />
                  <p className="font-semibold text-gray-700">Demo Placeholder</p>
                  <p className="text-sm text-gray-500 mt-1">Add exercise.demo.videoUrl in exercises.js for this exercise.</p>
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                {instructions.slice(0, 3).map((step, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                    <span className="font-semibold">Step {idx + 1}:</span> {step}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                className="mt-4 w-full py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExerciseDemo;
