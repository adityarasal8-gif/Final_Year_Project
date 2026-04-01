/**
 * App.jsx
 * Main application component with Medical Design System UI
 * Flow: LandingPageNew → PatientDashboard → ExerciseViewport
 */

import React, { useState, useEffect } from 'react';
import { SessionProvider } from './context/SessionContext';
import LandingPageNew from './components/LandingPageNew';
import PatientDashboard from './components/PatientDashboard';
import ExerciseViewport from './components/ExerciseViewport';
import TherapistDashboard from './components/TherapistDashboard';
import SessionSummary from './components/SessionSummary';
import PhysioLogo from './components/PhysioLogo';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile, saveSession } from './utils/firestore';

/**
 * Main App Component
 */
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [selectedLeg, setSelectedLeg] = useState('left');
  const [sessionData, setSessionData] = useState(null);
  // Views: 'dashboard' | 'exercise' | 'therapist' | 'summary'

  /**
   * Firebase auth listener
   */
  useEffect(() => {
    if (!auth) {
      // Firebase not configured, check localStorage for demo user
      const savedUser = localStorage.getItem('physio_demo_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user profile from Firestore to get actual role
        const profileResult = await getUserProfile(firebaseUser.uid);
        
        if (profileResult.success) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: profileResult.data.name || firebaseUser.displayName,
            role: profileResult.data.role,
            patientType: profileResult.data.patientType,
            hasTherapist: profileResult.data.hasTherapist,
            therapistCode: profileResult.data.therapistCode,
            therapistId: profileResult.data.therapistId
          });
          
          // Route based on role
          if (profileResult.data.role === 'therapist') {
            setCurrentView('therapist');
          } else {
            setCurrentView('dashboard');
          }
        } else {
          // Profile not found, sign out
          console.error('User profile not found in Firestore');
          await auth.signOut();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Handle authentication success
   */
  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    
    // Save demo user to localStorage
    if (authenticatedUser.isDemo) {
      localStorage.setItem('physio_demo_user', JSON.stringify(authenticatedUser));
    }

    // Route based on role
    if (authenticatedUser.role === 'therapist') {
      setCurrentView('therapist');
    } else {
      setCurrentView('dashboard');
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      if (auth && !user?.isDemo) {
        await auth.signOut();
      }
      setUser(null);
      localStorage.removeItem('physio_demo_user');
      setCurrentView('dashboard');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  /**
   * Navigation handlers
   */
  const handleStartSession = (exercise, leg) => {
    setSelectedExercise(exercise);
    setSelectedLeg(leg || 'left');
    setCurrentView('exercise');
  };

  const handleEndSession = async (completedSessionData) => {
    setSessionData(completedSessionData);
    setCurrentView('summary');

    // Save session to Firestore
    if (user && !user.isDemo && completedSessionData) {
      try {
        const firestoreData = {
          exerciseId: selectedExercise?.id || 'unknown',
          exerciseName: selectedExercise?.name || 'Unknown Exercise',
          legSide: selectedLeg,
          totalReps: completedSessionData.totalReps || 0,
          reps: completedSessionData.totalReps || 0,
          sets: completedSessionData.setsCompleted || completedSessionData.currentSet || 1,
          targetReps: selectedExercise?.targetReps || 0,
          targetSets: selectedExercise?.targetSets || 0,
          targetAngle: selectedExercise?.targetAngle || 0,
          maxAngle: completedSessionData.bestAngle || 0,
          baselineROM: completedSessionData.baselineROM || 0,
          improvement: completedSessionData.improvement || 0,
          postureAccuracy: completedSessionData.postureAccuracy || 0,
          duration: completedSessionData.duration || 0,
          therapistId: user.therapistId || null,
        };
        const result = await saveSession(user.uid, firestoreData);
        if (result.success) {
          console.log('✅ Session saved to Firestore:', result.sessionId);
        } else {
          console.error('❌ Failed to save session:', result.error);
        }
      } catch (err) {
        console.error('❌ Error saving session:', err);
      }
    }
  };

  const handleNavigate = (view) => {
    // Handle bottom nav clicks (Home, History, Profile)
    console.log('Navigate to:', view);
    // In production, you'd route to different dashboard views
  };

  const handleCloseSummary = () => {
    setCurrentView('dashboard');
    setSessionData(null);
    setSelectedExercise(null);
    setSelectedLeg('left');
  };

  const handleShareWithTherapist = async () => {
    // TODO: Implement sharing session data with therapist
    console.log('Sharing session data:', sessionData);
    alert('Session shared with your therapist!');
  };

  /**
   * Loading screen
   */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-medical-primary to-medical-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-xl font-semibold">Loading Physio...</p>
        </div>
      </div>
    );
  }

  /**
   * Show landing page if not authenticated
   */
  if (!user) {
    return <LandingPageNew onAuthSuccess={handleAuthSuccess} />;
  }

  /**
   * Therapist dashboard view - Role-based guard
   */
  if (currentView === 'therapist') {
    // Security: Only allow therapists to access therapist dashboard
    if (user.role !== 'therapist') {
      setCurrentView('dashboard');
      return null;
    }
    
    return (
      <div className="min-h-screen bg-medical-background">
        <TherapistDashboard 
          user={user} 
          onLogout={handleLogout}
        />
      </div>
    );
  }

  /**
   * Exercise immersive mode (wrapped in SessionProvider)
   * Security: Only allow patients to access exercise mode
   */
  if (currentView === 'exercise') {
    // Role-based guard: Therapists cannot start exercise sessions
    if (user.role === 'therapist') {
      setCurrentView('therapist');
      return null;
    }
    
    return (
      <SessionProvider>
        <div className="h-screen w-screen bg-black">
          <ExerciseViewport 
            exercise={selectedExercise}
            selectedLeg={selectedLeg}
            onEndSession={handleEndSession} 
          />
        </div>
      </SessionProvider>
    );
  }

  /**
   * Session Summary view
   */
  if (currentView === 'summary') {
    return (
      <SessionSummary
        sessionData={sessionData}
        exercise={selectedExercise}
        user={user}
        onClose={handleCloseSummary}
        onShareWithTherapist={handleShareWithTherapist}
      />
    );
  }

  /**
   * Patient dashboard (main hub)
   * Security: Only patients can access patient dashboard
   */
  return (
    <div className="min-h-screen bg-medical-background">
      {/* Top bar is now rendered inside PatientDashboard */}
      <SessionProvider>
        <PatientDashboard
          user={user}
          onStartSession={handleStartSession}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </SessionProvider>
    </div>
  );
}

export default App;
