/**
 * ExerciseDemo.jsx
 * Pre-exercise instruction and demo screen
 * Shows exercise details, setup requirements, and camera positioning guide
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// SVG Icons
const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const AlertCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const VideoIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const CameraIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const ArrowLeftIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const PlayIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const ExerciseDemo = ({ exercise, onStart, onBack }) => {
  const [checklist, setChecklist] = useState(
    exercise.setup.map((item, idx) => ({ 
      id: `checkbox-${idx}`,
      text: item.text, 
      checked: item.checked || false 
    }))
  );
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState(exercise.legSide || 'left');
  
  const allChecked = checklist.every(item => item.checked);

  const toggleCheckItem = (index) => {
    setChecklist(prev => 
      prev.map((item, idx) => 
        idx === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleStartExercise = () => {
    onStart(selectedLeg);
  };

  return (
    <div className="min-h-screen bg-medical-background">
      {/* Header */}
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
                {exercise.difficulty} • {exercise.duration}
              </span>
              <h1 className="text-4xl font-bold mb-3">{exercise.name}</h1>
              <p className="text-xl text-teal-50 mb-4">{exercise.description}</p>
              <div className="flex flex-wrap gap-2">
                {exercise.muscleGroups.map(muscle => (
                  <span key={muscle} className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-6xl">💪</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Instructions & Demo */}
          <div className="space-y-6">
            {/* Animation/Video Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                {/* Placeholder for animation/video */}
                <div className="text-center">
                  <VideoIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Exercise Animation</p>
                  <p className="text-sm text-gray-400">Visual guide coming soon</p>
                </div>
                
                {/* Play button overlay */}
                <button
                  onClick={() => setShowVideoModal(true)}
                  className="absolute inset-0 bg-black/20 hover:bg-black/30 transition-colors flex items-center justify-center group"
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayIcon className="w-8 h-8 text-teal-600 ml-1" />
                  </div>
                </button>
              </div>
              
              <button
                onClick={() => setShowVideoModal(true)}
                className="w-full px-4 py-3 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <VideoIcon className="w-5 h-5" />
                Watch Full Demo
              </button>
            </motion.div>

            {/* Step-by-Step Instructions */}
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
                {exercise.instructions.map((instruction, index) => (
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

            {/* Common Mistakes */}
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
                {exercise.commonMistakes.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-red-500 text-xl flex-shrink-0">✗</span>
                    <div>
                      <p className="font-semibold text-amber-900">{item.mistake}</p>
                      <p className="text-sm text-amber-700">✓ {item.correction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Setup & Preparation */}
          <div className="space-y-6">
            {/* Preparation Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-md"
            >
              <h2 className="text-xl font-bold text-medical-text-primary mb-4">
                Preparation Checklist
              </h2>
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
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
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

            {/* Leg Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-gradient-to-br from-cyan-50 to-teal-50 border-2 border-teal-200 rounded-2xl p-6 shadow-md"
            >
              <h2 className="text-xl font-bold text-medical-text-primary mb-4">
                Select Leg to Exercise
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedLeg('left')}
                  className={`p-6 rounded-xl border-3 transition-all transform hover:scale-105 ${
                    selectedLeg === 'left'
                      ? 'bg-teal-600 border-teal-700 text-white shadow-lg'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-teal-400'
                  }`}
                >
                  <div className={`font-bold text-lg ${
                    selectedLeg === 'left' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Left Leg
                  </div>
                  {selectedLeg === 'left' && (
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setSelectedLeg('right')}
                  className={`p-6 rounded-xl border-3 transition-all transform hover:scale-105 ${
                    selectedLeg === 'right'
                      ? 'bg-teal-600 border-teal-700 text-white shadow-lg'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-teal-400'
                  }`}
                >
                  <div className={`font-bold text-lg ${
                    selectedLeg === 'right' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Right Leg
                  </div>
                  {selectedLeg === 'right' && (
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  )}
                </button>
              </div>
              <div className="mt-4 p-3 bg-cyan-100 rounded-lg">
                <p className="text-sm text-cyan-900">
                  <span className="font-semibold">💡 Tip:</span> Make sure the camera can see your entire {selectedLeg} leg from hip to ankle
                </p>
              </div>
            </motion.div>

            {/* Camera Positioning */}
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
                  <span className="font-semibold text-gray-900">{exercise.cameraGuide.distance}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Angle:</span>
                  <span className="font-semibold text-gray-900">{exercise.cameraGuide.angle}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Height:</span>
                  <span className="font-semibold text-gray-900">{exercise.cameraGuide.height}</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    💡 <strong>Tip:</strong> {exercise.cameraGuide.instructions}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Safety Tips */}
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
                {exercise.safetyTips.map((tip, index) => (
                  <li key={index} className="flex gap-2 text-sm text-red-800">
                    <span className="text-red-500">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Target Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl p-6"
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

            {/* Start Button */}
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
              {allChecked ? `Start Exercise - ${selectedLeg.charAt(0).toUpperCase() + selectedLeg.slice(1)} Leg` : 'Complete Checklist First'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Video Modal */}
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
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-4 max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
                <p className="text-white">Full demonstration video will be added here</p>
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
