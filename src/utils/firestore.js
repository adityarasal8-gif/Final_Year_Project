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
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

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
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const sessionRef = await addDoc(collection(db, 'sessions'), {
      userId,
      ...sessionData,
      createdAt: serverTimestamp()
    });
    
    return { success: true, sessionId: sessionRef.id };
  } catch (error) {
    console.error('Error saving session:', error);
    return { success: false, error };
  }
};

/**
 * Get user sessions
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of sessions to fetch
 */
export const getUserSessions = async (userId, limitCount = 30) => {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const sessions = [];
    
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, data: sessions };
  } catch (error) {
    console.error('Error getting sessions:', error);
    return { success: false, error };
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
    // Update patient profile
    await updateDoc(doc(db, 'users', patientId), {
      therapistId,
      therapistCode,
      hasTherapist: true,
      patientType: 'with_therapist',
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
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
      // Validate and link to therapist
      const validation = await validateTherapistCode(therapistCode);
      if (!validation.success) {
        return validation;
      }
      
      updates.therapistId = validation.therapist.id;
      updates.therapistCode = therapistCode.toUpperCase();
      updates.linkedAt = serverTimestamp();
      
      // Update therapist's linked patients
      const therapistDoc = await getDoc(doc(db, 'users', validation.therapist.id));
      if (therapistDoc.exists()) {
        const linkedPatients = therapistDoc.data().linkedPatients || [];
        if (!linkedPatients.includes(patientId)) {
          linkedPatients.push(patientId);
          await updateDoc(doc(db, 'users', validation.therapist.id), {
            linkedPatients,
            updatedAt: serverTimestamp()
          });
        }
      }
    } else if (newMode === 'independent') {
      // Remove therapist link
      const patientDoc = await getDoc(doc(db, 'users', patientId));
      if (patientDoc.exists()) {
        const oldTherapistId = patientDoc.data().therapistId;
        if (oldTherapistId) {
          // Remove from therapist's linked patients
          const therapistDoc = await getDoc(doc(db, 'users', oldTherapistId));
          if (therapistDoc.exists()) {
            const linkedPatients = therapistDoc.data().linkedPatients || [];
            const updated = linkedPatients.filter(id => id !== patientId);
            await updateDoc(doc(db, 'users', oldTherapistId), {
              linkedPatients: updated,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
      
      updates.therapistId = null;
      updates.therapistCode = null;
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
    const q = query(
      collection(db, 'users'),
      where('therapistId', '==', therapistId),
      where('role', '==', 'patient')
    );
    
    const querySnapshot = await getDocs(q);
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
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured' };
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', patientId),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const sessions = [];
    
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, data: sessions };
  } catch (error) {
    console.error('Error getting patient history:', error);
    return { success: false, error };
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
