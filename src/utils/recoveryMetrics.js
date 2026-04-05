/**
 * recoveryMetrics.js
 * Normalizes persisted session metrics for recovery charts and patient insights.
 */

import { exerciseLibrary } from '../data/exercises';

const DEFAULT_ANGLE_MODE = 'inner_knee_angle';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toAngle = (value) => clamp(toNumber(value, 0), 0, 180);

const normalizeToken = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const EXERCISE_TOKEN_MAP = (() => {
  const map = new Map();

  exerciseLibrary.forEach((exercise) => {
    const idToken = normalizeToken(exercise.id);
    const nameToken = normalizeToken(exercise.name);
    if (idToken) map.set(idToken, exercise);
    if (nameToken) map.set(nameToken, exercise);
  });

  // Legacy/backfill aliases from older persisted records.
  map.set('kneeflexionexercise', map.get('kneeflexion') || null);
  map.set('kneeextensionexercise', map.get('kneeextension') || null);
  map.set('straightlegraiseexercise', map.get('straightlegraise') || null);
  map.set('bodyweightsquat', map.get('bodyweightsquats') || null);

  return map;
})();

const parseSessionDate = (createdAt) => {
  if (createdAt?.toDate) {
    return createdAt.toDate();
  }

  if (typeof createdAt?.seconds === 'number') {
    return new Date(createdAt.seconds * 1000);
  }

  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const toDateLabel = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const toDateKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const getExerciseConfig = (exerciseId) => exerciseLibrary.find((exercise) => exercise.id === exerciseId) || null;

const resolveExerciseFromSession = (session) => {
  const rawId = typeof session?.exerciseId === 'string' ? session.exerciseId.trim() : '';
  const rawName = typeof session?.exerciseName === 'string' ? session.exerciseName.trim() : '';

  let exerciseConfig = rawId ? getExerciseConfig(rawId) : null;

  if (!exerciseConfig) {
    const idToken = normalizeToken(rawId);
    if (idToken && EXERCISE_TOKEN_MAP.has(idToken)) {
      exerciseConfig = EXERCISE_TOKEN_MAP.get(idToken) || null;
    }
  }

  if (!exerciseConfig) {
    const nameToken = normalizeToken(rawName);
    if (nameToken && EXERCISE_TOKEN_MAP.has(nameToken)) {
      exerciseConfig = EXERCISE_TOKEN_MAP.get(nameToken) || null;
    }
  }

  return {
    exerciseConfig,
    exerciseId: exerciseConfig?.id || rawId || 'unknown',
    exerciseName: rawName || exerciseConfig?.name || 'Exercise'
  };
};

const normalizeLegacyFlexionAngle = ({ rawAngle, targetAngle, metricType, allowLegacyInference }) => {
  const direct = toAngle(rawAngle);

  if (!allowLegacyInference) {
    return { value: direct, adjusted: false };
  }

  const offset = metricType === 'baseline' ? 25 : 35;
  const fallbackCutoff = metricType === 'baseline' ? 120 : 130;
  const conversionCutoff = targetAngle > 0
    ? Math.min(175, targetAngle + offset)
    : fallbackCutoff;

  if (direct <= conversionCutoff) {
    return { value: direct, adjusted: false };
  }

  return {
    value: toAngle(180 - direct),
    adjusted: true
  };
};

export const calculateProgressPercent = (maxAngle, baselineROM, targetAngle) => {
  const denominator = targetAngle - baselineROM;
  if (!Number.isFinite(denominator) || denominator <= 1) return null;

  const raw = ((maxAngle - baselineROM) / denominator) * 100;
  return Math.round(clamp(raw, 0, 160));
};

export const calculateMedian = (values = []) => {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;

  const middle = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[middle];
  return (valid[middle - 1] + valid[middle]) / 2;
};

export const mapRecoverySession = (session) => {
  const sessionDate = parseSessionDate(session?.createdAt);
  const resolvedExercise = resolveExerciseFromSession(session);
  const exerciseId = resolvedExercise.exerciseId;
  const exerciseConfig = resolvedExercise.exerciseConfig;

  const explicitAngleMode = typeof session?.angleMode === 'string' && session.angleMode.trim()
    ? session.angleMode.trim()
    : null;
  const angleMode = explicitAngleMode || exerciseConfig?.angleMode || DEFAULT_ANGLE_MODE;

  const targetAngle = toAngle(
    toNumber(session?.targetAngle, toNumber(exerciseConfig?.targetAngle, 0))
  );

  const shouldInferLegacyFlexion = !explicitAngleMode && angleMode === 'flexion_rom';

  const normalizedBaseline = normalizeLegacyFlexionAngle({
    rawAngle: session?.baselineROM,
    targetAngle,
    metricType: 'baseline',
    allowLegacyInference: shouldInferLegacyFlexion
  });

  const normalizedMax = normalizeLegacyFlexionAngle({
    rawAngle: session?.maxAngle,
    targetAngle,
    metricType: 'max',
    allowLegacyInference: shouldInferLegacyFlexion
  });

  const baselineROM = Math.round(normalizedBaseline.value);
  const maxAngle = Math.round(normalizedMax.value);
  const romGainDeg = Math.round(maxAngle - baselineROM);
  const progressPercent = calculateProgressPercent(maxAngle, baselineROM, targetAngle);

  const totalReps = Math.max(0, Math.round(toNumber(session?.totalReps ?? session?.reps, 0)));
  const durationSec = Math.max(0, toNumber(session?.duration, 0));
  const durationMin = durationSec > 0 ? Math.max(1, Math.round(durationSec / 60)) : 0;

  const calibrationAnomaly = angleMode === 'flexion_rom' && targetAngle > 0 && baselineROM > (targetAngle + 20);
  const hasEffortOrSignal = totalReps > 0 || durationSec >= 15 || maxAngle > 0;
  const hasValidAngles = maxAngle > 0 && baselineROM >= 0 && baselineROM <= 175;
  const canComputeProgress = Number.isFinite(progressPercent);

  return {
    id: session?.id,
    exerciseId,
    exerciseName: resolvedExercise.exerciseName,
    angleMode,
    dateLabel: toDateLabel(sessionDate),
    dateKey: toDateKey(sessionDate),
    createdAtMs: sessionDate.getTime(),
    totalReps,
    targetReps: Math.max(0, Math.round(toNumber(session?.targetReps, toNumber(exerciseConfig?.targetReps, 0)))),
    targetSets: Math.max(0, Math.round(toNumber(session?.targetSets, toNumber(exerciseConfig?.targetSets, 0)))),
    sets: Math.max(1, Math.round(toNumber(session?.sets, 1))),
    durationMin,
    maxAngle,
    baselineROM,
    targetAngle: Math.round(targetAngle),
    romGainDeg,
    improvementDeg: romGainDeg,
    improvementPercent: canComputeProgress ? progressPercent : 0,
    hasProgressMetric: canComputeProgress,
    postureAccuracy: Math.round(clamp(toNumber(session?.postureAccuracy, 0), 0, 100)),
    legacyAngleAdjusted: normalizedBaseline.adjusted || normalizedMax.adjusted,
    calibrationAnomaly,
    isChartable: hasEffortOrSignal && hasValidAngles && !calibrationAnomaly
  };
};
