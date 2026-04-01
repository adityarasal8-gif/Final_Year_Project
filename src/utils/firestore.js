/**
 * firestore.js
 * Firestore database operations
 * Handles patient sessions, user profile, and therapist data
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const SESSION_CACHE_KEY = 'physio_session_cache_v1';
const MAX_QUERY_LIMIT = 100;

const clampQueryLimit = (value, fallback = MAX_QUERY_LIMIT) => {
  const candidate = Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, Math.min(MAX_QUERY_LIMIT, candidate));
};

const canUseLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const toDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateToMs = (value) => toDate(value)?.getTime() || 0;

const sortSessions = (sessions, order = 'desc') => {
  const factor = order === 'asc' ? 1 : -1;
  return [...sessions].sort((a, b) => factor * (dateToMs(a.createdAt) - dateToMs(b.createdAt)));
};

const readSessionCache = () => {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to read local session cache:', error);
    return {};
  }
};

const writeSessionCache = (cache) => {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to write local session cache:', error);
  }
};

const normalizeCachedSession = (userId, sessionData, forcedId = null) => {
  const createdAtDate = toDate(sessionData?.createdAt) || new Date();
  return {
    ...sessionData,
    id: forcedId || sessionData?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    createdAt: createdAtDate.toISOString()
  };
};

const cacheSessionLocal = (userId, sessionData, forcedId = null) => {
  if (!userId) return null;

  const cache = readSessionCache();
  const normalized = normalizeCachedSession(userId, sessionData, forcedId);
  const existing = Array.isArray(cache[userId]) ? cache[userId] : [];

  cache[userId] = [normalized, ...existing.filter((s) => s?.id !== normalized.id)].slice(0, 500);
  writeSessionCache(cache);
  return normalized.id;
};

const getLocalSessions = (userId) => {
  if (!userId) return [];
  const cache = readSessionCache();
  return Array.isArray(cache[userId]) ? cache[userId] : [];
};

const mergeSessionsById = (primary, secondary) => {
  const merged = new Map();

  [...primary, ...secondary].forEach((session) => {
    if (!session?.id || merged.has(session.id)) return;
    merged.set(session.id, session);
  });

  return Array.from(merged.values());
};

const filterByDays = (sessions, days) => {
  if (!days || days <= 0) return sessions;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return sessions.filter((session) => dateToMs(session.createdAt) >= cutoff);
};

const fetchSessionsByOwnerField = async (ownerField, ownerId, limitCount = MAX_QUERY_LIMIT) => {
  const q = query(
    collection(db, 'sessions'),
    where(ownerField, '==', ownerId),
    limit(clampQueryLimit(limitCount))
  );

  const querySnapshot = await getDocs(q);
  const sessions = [];

  querySnapshot.forEach((doc) => {
    sessions.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return sessions;
};

// Guard to check if Firebase is configured
const isFirebaseConfigured = () => {
  if (!db) {
    console.warn('⚠️ Firebase not configured. Database operations will not work until you add your Firebase credentials to .env');
    return false;
  }
  return true;
};

/**
 * User Operations
 */

/**
 * Create or update user profile
 * @param {string} uid - User ID
 * @param {Object} userData - User data
 */
export const saveUserProfile = async (uid, userData) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    await setDoc(doc(db, 'users', uid), {
      ...userData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving user profile:', error);
    return { success: false, error };
  }
};

/**
 * Get user profile
 * @param {string} uid - User ID
 */
export const getUserProfile = async (uid) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return { success: false, error };
  }
};

/**
 * Session Operations
 */

/**
 * Save exercise session
 * @param {string} userId - User ID
 * @param {Object} sessionData - Session data
 */
export const saveSession = async (userId, sessionData) => {
  if (!isFirebaseConfigured()) {
    const localId = cacheSessionLocal(userId, sessionData);
    return { success: true, sessionId: localId, source: 'local' };
  }
  
  try {
    const sessionRef = await addDoc(collection(db, 'sessions'), {
      userId,
      ...sessionData,
      createdAt: serverTimestamp()
    });

    cacheSessionLocal(userId, sessionData, sessionRef.id);
    
    return { success: true, sessionId: sessionRef.id };
  } catch (error) {
    console.error('Error saving session:', error);
    const localId = cacheSessionLocal(userId, sessionData);
    return { success: true, sessionId: localId, source: 'local', warning: error };
  }
};

/**
 * Get user sessions
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of sessions to fetch
 */
export const getUserSessions = async (userId, limitCount = 30) => {
  const effectiveLimit = clampQueryLimit(limitCount, 30);
  const localSessions = getLocalSessions(userId);
  const localFallback = () => ({
    success: true,
    source: 'local',
    data: sortSessions(localSessions, 'desc').slice(0, effectiveLimit)
  });

  if (!isFirebaseConfigured()) return localFallback();
  
  try {
    const [userIdSessions, legacyUidSessions, legacyPatientIdSessions] = await Promise.all([
      fetchSessionsByOwnerField('userId', userId, effectiveLimit),
      fetchSessionsByOwnerField('uid', userId, effectiveLimit),
      fetchSessionsByOwnerField('patientId', userId, effectiveLimit)
    ]);

    const merged = mergeSessionsById(
      [...userIdSessions, ...legacyUidSessions, ...legacyPatientIdSessions],
      localSessions
    );
    return { success: true, data: sortSessions(merged, 'desc').slice(0, effectiveLimit) };
  } catch (error) {
    console.error('Error getting sessions:', error);
    return localFallback();
  }
};

/**
 * Get specific session
 * @param {string} sessionId - Session ID
 */
export const getSession = async (sessionId) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const docRef = doc(db, 'sessions', sessionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
    } else {
      return { success: false, error: 'Session not found' };
    }
  } catch (error) {
    console.error('Error getting session:', error);
    return { success: false, error };
  }
};

/**
 * Update session
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Data to update
 */
export const updateSession = async (sessionId, updates) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating session:', error);
    return { success: false, error };
  }
};

/**
 * Therapist Operations
 */

/**
 * Generate unique therapist code
 * @returns {string} 6-character uppercase code
 */
const generateTherapistCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Create therapist profile with unique code
 * @param {string} therapistId - Therapist user ID
 * @param {Object} therapistData - Therapist data
 */
export const createTherapistProfile = async (therapistId, therapistData) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    let code = generateTherapistCode();
    let codeExists = true;
    
    // Ensure code is unique
    while (codeExists) {
      const q = query(collection(db, 'users'), where('therapistCode', '==', code));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        codeExists = false;
      } else {
        code = generateTherapistCode();
      }
    }
    
    await setDoc(doc(db, 'users', therapistId), {
      ...therapistData,
      therapistCode: code,
      linkedPatients: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return { success: true, code };
  } catch (error) {
    console.error('Error creating therapist profile:', error);
    return { success: false, error };
  }
};

/**
 * Validate therapist code
 * @param {string} code - Therapist code to validate
 */
export const validateTherapistCode = async (code) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const q = query(
      collection(db, 'users'),
      where('therapistCode', '==', code.toUpperCase()),
      where('role', '==', 'therapist')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, error: 'Invalid therapist code' };
    }
    
    const therapistDoc = querySnapshot.docs[0];
    return { 
      success: true, 
      therapist: {
        id: therapistDoc.id,
        ...therapistDoc.data()
      }
    };
  } catch (error) {
    console.error('Error validating therapist code:', error);
    return { success: false, error };
  }
};

/**
 * Link patient to therapist
 * @param {string} patientId - Patient user ID
 * @param {string} therapistId - Therapist user ID
 * @param {string} therapistCode - Therapist code
 */
export const linkPatientToTherapist = async (patientId, therapistId, therapistCode) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    // Use setDoc with merge:true so it works whether the doc exists or not
    await setDoc(doc(db, 'users', patientId), {
      therapistId,
      therapistCode,
      hasTherapist: true,
      patientType: 'with_therapist',
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update therapist's linked patients list
    const therapistDoc = await getDoc(doc(db, 'users', therapistId));
    if (therapistDoc.exists()) {
      const linkedPatients = therapistDoc.data().linkedPatients || [];
      if (!linkedPatients.includes(patientId)) {
        linkedPatients.push(patientId);
        await updateDoc(doc(db, 'users', therapistId), {
          linkedPatients,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error linking patient to therapist:', error);
    return { success: false, error };
  }
};

/**
 * Switch patient mode (independent <-> with_therapist)
 * @param {string} patientId - Patient user ID
 * @param {string} newMode - 'independent' or 'with_therapist'
 * @param {string} therapistCode - Optional therapist code for switching to with_therapist
 */
export const switchPatientMode = async (patientId, newMode, therapistCode = null) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const updates = {
      patientType: newMode,
      hasTherapist: newMode === 'with_therapist',
      updatedAt: serverTimestamp()
    };
    
    if (newMode === 'with_therapist' && therapistCode) {
      // Validate therapist code and get therapist ID
      const validation = await validateTherapistCode(therapistCode);
      if (!validation.success) {
        return validation;
      }
      
      updates.therapistId = validation.therapist.id;
      updates.therapistCode = therapistCode.toUpperCase();
      updates.linkedAt = serverTimestamp();
      // Note: therapist's linkedPatients is not updated here because the patient
      // does not have write permission on the therapist's document.
      // The therapist dashboard queries patients by therapistId directly.
    } else if (newMode === 'independent') {
      updates.therapistId = null;
      updates.therapistCode = null;
      updates.hasTherapist = false;
    }
    
    await updateDoc(doc(db, 'users', patientId), updates);
    return { success: true };
  } catch (error) {
    console.error('Error switching patient mode:', error);
    return { success: false, error };
  }
};

/**
 * Get all patients for a therapist
 * @param {string} therapistId - Therapist ID
 */
export const getTherapistPatients = async (therapistId) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const strictQuery = query(
      collection(db, 'users'),
      where('therapistId', '==', therapistId),
      where('role', '==', 'patient'),
      limit(MAX_QUERY_LIMIT)
    );

    let querySnapshot = await getDocs(strictQuery);

    // Backward compatibility for older profiles that may not include the role field.
    if (querySnapshot.empty) {
      const fallbackQuery = query(
        collection(db, 'users'),
        where('therapistId', '==', therapistId),
        limit(MAX_QUERY_LIMIT)
      );
      querySnapshot = await getDocs(fallbackQuery);
    }

    const patients = [];
    
    querySnapshot.forEach((doc) => {
      patients.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, data: patients };
  } catch (error) {
    console.error('Error getting patients:', error);
    return { success: false, error };
  }
};

/**
 * Get patient sessions for therapist dashboard
 * @param {string} patientId - Patient ID
 * @param {number} days - Number of days to fetch
 */
export const getPatientSessionHistory = async (patientId, days = 30) => {
  const effectiveLimit = MAX_QUERY_LIMIT;
  const localSessions = getLocalSessions(patientId);
  const localFallback = () => ({
    success: true,
    source: 'local',
    data: sortSessions(filterByDays(localSessions, days), 'asc')
  });

  if (!isFirebaseConfigured()) return localFallback();
  
  try {
    const [userIdSessions, legacyUidSessions, legacyPatientIdSessions] = await Promise.all([
      fetchSessionsByOwnerField('userId', patientId, effectiveLimit),
      fetchSessionsByOwnerField('uid', patientId, effectiveLimit),
      fetchSessionsByOwnerField('patientId', patientId, effectiveLimit)
    ]);

    const merged = mergeSessionsById(
      [...userIdSessions, ...legacyUidSessions, ...legacyPatientIdSessions],
      localSessions
    );
    return { success: true, data: sortSessions(filterByDays(merged, days), 'asc') };
  } catch (error) {
    console.error('Error getting patient history:', error);
    return localFallback();
  }
};

/**
 * Calculate compliance score
 * @param {string} patientId - Patient ID
 * @param {number} assignedSessions - Number of assigned sessions per week
 */
export const calculateComplianceScore = async (patientId, assignedSessions = 5) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    // Get sessions from last 7 days
    const result = await getPatientSessionHistory(patientId, 7);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    const completedSessions = result.data.length;
    const complianceScore = Math.round((completedSessions / assignedSessions) * 100);
    
    return {
      success: true,
      data: {
        completedSessions,
        assignedSessions,
        complianceScore: Math.min(complianceScore, 100) // Cap at 100%
      }
    };
  } catch (error) {
    console.error('Error calculating compliance:', error);
    return { success: false, error };
  }
};

export default {
  saveUserProfile,
  getUserProfile,
  saveSession,
  getUserSessions,
  getSession,
  updateSession,
  createTherapistProfile,
  validateTherapistCode,
  linkPatientToTherapist,
  switchPatientMode,
  getTherapistPatients,
  getPatientSessionHistory,
  calculateComplianceScore
};
