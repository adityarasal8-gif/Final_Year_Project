/**
 * SessionSummary.jsx
 * Post-exercise summary screen showing performance metrics
 * Displays rep breakdown, quality scores, and progress charts
 */

import React from 'react';
import { motion } from 'framer-motion';

// SVG Icons
const TrophyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="7"/>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
  </svg>
);

const TrendingUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TargetIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const FlameIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="currentColor" d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.23.1-.47.04-.66-.12a.58.58 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5.14.6.41 1.2.71 1.73 1.08 1.73 2.95 2.97 4.96 3.22 2.14.27 4.43-.12 6.07-1.6 1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6-1.12.4-2.24-.16-2.9-.82 1.19-.28 1.9-1.16 2.11-2.05.17-.8-.15-1.46-.28-2.23-.12-.74-.1-1.37.17-2.06.19.38.39.76.63 1.06.77 1 1.98 1.44 2.24 2.8.04.14.06.28.06.43.03.82-.33 1.72-.93 2.27z"/>
  </svg>
);

const StarIcon = ({ className, filled }) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const ShareIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

/**
 * Calculate rep quality score
 */
const calculateRepQuality = (rep, targetAngle, baselineROM) => {
  const angleReached = rep.maxAngle || 0;
  const angleProgress = ((angleReached - baselineROM) / (targetAngle - baselineROM)) * 100;
  
  let score = Math.min(100, Math.max(0, angleProgress));
  
  if (score >= 90) return { grade: 'Perfect', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
  if (score >= 70) return { grade: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
  if (score >= 50) return { grade: 'Fair', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
  return { grade: 'Needs Work', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
};

const SessionSummary = ({ sessionData, exercise, user, onClose, onShareWithTherapist }) => {
  const {
    reps = [],
    totalReps = 0,
    bestAngle = 0,
    duration = 0,
    baselineROM = 0,
    improvement = 0,
    sessionStartTime,
    sessionEndTime
  } = sessionData;

  const targetAngle = exercise?.targetAngle || 145;
  const targetReps = exercise?.targetReps || 15;
  
  // Calculate average quality
  const avgQuality = reps.length > 0
    ? reps.reduce((sum, rep) => {
        const quality = calculateRepQuality(rep, targetAngle, baselineROM);
        return sum + (quality.grade === 'Perfect' ? 100 : quality.grade === 'Good' ? 85 : quality.grade === 'Fair' ? 65 : 40);
      }, 0) / reps.length
    : 0;

  // Calculate completion percentage
  const completionRate = Math.min(100, (totalReps / (targetReps * (exercise?.targetSets || 3))) * 100);
  
  // Duration in minutes
  const durationMinutes = Math.round(duration / 60);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-white overflow-y-auto z-50"
    >
      {/* Celebration Header */}
      <div className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="text-6xl mb-4"
        >
          🎉
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold mb-2"
        >
          {completionRate >= 100 ? 'Excellent Work!' : 'Great Effort!'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-teal-100"
        >
          You completed {totalReps} reps of {exercise?.name}
        </motion.p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 border-2 border-teal-200 shadow-sm"
          >
            <TargetIcon className="w-8 h-8 text-teal-600 mb-3" />
            <div className="text-4xl font-bold text-medical-text-primary mb-1">
              {bestAngle}°
            </div>
            <div className="text-sm text-medical-text-secondary">Best Angle</div>
            {improvement > 0 && (
              <div className="mt-2 text-xs text-green-600 font-semibold flex items-center gap-1">
                <TrendingUpIcon className="w-3 h-3" />
                +{improvement}° from baseline
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl p-6 border-2 border-orange-200 shadow-sm"
          >
            <FlameIcon className="w-8 h-8 text-orange-600 mb-3" />
            <div className="text-4xl font-bold text-medical-text-primary mb-1">
              {totalReps}
            </div>
            <div className="text-sm text-medical-text-secondary">Total Reps</div>
            <div className="mt-2 text-xs text-gray-600">
              Target: {targetReps * (exercise?.targetSets || 3)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl p-6 border-2 border-blue-200 shadow-sm"
          >
            <ClockIcon className="w-8 h-8 text-blue-600 mb-3" />
            <div className="text-4xl font-bold text-medical-text-primary mb-1">
              {durationMinutes}
            </div>
            <div className="text-sm text-medical-text-secondary">Minutes</div>
            <div className="mt-2 text-xs text-gray-600">
              Duration
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-sm"
          >
            <TrophyIcon className="w-8 h-8 text-purple-600 mb-3" />
            <div className="text-4xl font-bold text-medical-text-primary mb-1">
              {Math.round(avgQuality)}%
            </div>
            <div className="text-sm text-medical-text-secondary">Avg Quality</div>
            <div className="mt-2 flex gap-1">
              {[1,2,3,4,5].map(star => (
                <StarIcon
                  key={star}
                  className="w-3 h-3 text-yellow-500"
                  filled={star <= Math.round(avgQuality / 20)}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Completion Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8"
        >
          <div className="flex justify-between mb-3">
            <h2 className="text-lg font-bold text-medical-text-primary">Session Completion</h2>
            <span className="text-2xl font-bold text-teal-600">{Math.round(completionRate)}%</span>
          </div>
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
              className={`absolute h-full rounded-full ${
                completionRate >= 100 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                completionRate >= 80 ? 'bg-gradient-to-r from-teal-500 to-cyan-600' :
                'bg-gradient-to-r from-amber-500 to-orange-600'
              }`}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {completionRate >= 100
              ? '✨ Target achieved! Excellent work!'
              : `${Math.round((targetReps * (exercise?.targetSets || 3)) - totalReps)} more reps to reach target`}
          </p>
        </motion.div>

        {/* Rep-by-Rep Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8"
        >
          <h2 className="text-xl font-bold text-medical-text-primary mb-4">Rep Breakdown</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {reps.map((rep, index) => {
              const quality = calculateRepQuality(rep, targetAngle, baselineROM);
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + (index * 0.05) }}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 ${quality.borderColor} ${quality.bgColor}`}
                >
                  <div className="text-2xl font-bold text-gray-400 w-12">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-900">
                        Angle: {rep.maxAngle || 0}°
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${quality.color} ${quality.bgColor}`}>
                        {quality.grade}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-600 transition-all"
                        style={{ width: `${Math.min(100, ((rep.maxAngle || 0) / targetAngle) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Baseline: {baselineROM}°</span>
                      <span>Target: {targetAngle}°</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="space-y-3"
        >
          {user?.hasTherapist && (
            <button
              onClick={onShareWithTherapist}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-3"
            >
              <ShareIcon className="w-6 h-6" />
              Share with Therapist
            </button>
          )}
          
          <button
            onClick={onClose}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-3"
          >
            <CheckCircleIcon className="w-6 h-6" />
            Back to Dashboard
          </button>
        </motion.div>

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-8 text-center"
        >
          <p className="text-gray-600 italic">
            {completionRate >= 100
              ? '"Excellence is not a destination, it is a continuous journey." Keep up the amazing work!'
              : '"Progress, not perfection." Every rep counts toward your recovery!'}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SessionSummary;
