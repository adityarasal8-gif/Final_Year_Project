/**
 * AppExample.jsx
 * Example integration showing how to use the new medical UI components
 * 
 * This demonstrates the complete flow:
 * LandingPageNew → PatientDashboard → ExerciseViewport
 */

import React, { useState, useEffect } from 'react';
import { SessionProvider, useSession, SESSION_PHASES } from './context/SessionContext';
import LandingPageNew from './components/LandingPageNew';
import PatientDashboard from './components/PatientDashboard';
import ExerciseViewport from './components/ExerciseViewport';
import TherapistDashboard from './components/TherapistDashboard';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Main App with new medical UI
 */
function AppWithNewUI() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard'); 
  // Views: 'dashboard' | 'exercise' | 'therapist'

  /**
   * Firebase auth listener
   */
  useEffect(() => {
    if (!auth) {
      // Firebase not configured, check localStorage for demo user
      const savedUser = localStorage.getItem('phisi_demo_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          role: 'patient' // Should be fetched from Firestore
        });
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
      localStorage.setItem('phisi_demo_user', JSON.stringify(authenticatedUser));
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
      localStorage.removeItem('phisi_demo_user');
      setCurrentView('dashboard');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  /**
   * Navigation handlers
   */
  const handleStartSession = () => {
    setCurrentView('exercise');
  };

  const handleEndSession = () => {
    setCurrentView('dashboard');
  };

  const handleNavigate = (view) => {
    // Handle bottom nav clicks (Home, History, Profile)
    console.log('Navigate to:', view);
    // In production, you'd route to different dashboard views
  };

  /**
   * Loading screen
   */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-medical-primary to-medical-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🦵</div>
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-xl font-semibold">Loading Phisi...</p>
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
   * Therapist dashboard view
   */
  if (currentView === 'therapist' && user.role === 'therapist') {
    return (
      <div className="min-h-screen bg-medical-background">
        <TherapistDashboard 
          user={user} 
          onBackToPatient={() => setCurrentView('dashboard')}
        />
      </div>
    );
  }

  /**
   * Exercise immersive mode (wrapped in SessionProvider)
   */
  if (currentView === 'exercise') {
    return (
      <SessionProvider>
        <div className="h-screen w-screen bg-black">
          <ExerciseViewport onEndSession={handleEndSession} />
        </div>
      </SessionProvider>
    );
  }

  /**
   * Patient dashboard (main hub)
   */
  return (
    <div className="min-h-screen bg-medical-background">
      {/* Optional: Add a top bar with logout */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🦵</div>
          <div>
            <h1 className="text-lg font-bold text-medical-text-primary">Phisi</h1>
            <p className="text-xs text-medical-text-secondary">
              {user.isDemo && '🚀 Demo Mode • '}
              {user.name || user.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-medical-error hover:text-red-600 font-medium transition"
        >
          Logout
        </button>
      </div>

      {/* Main Dashboard */}
      <SessionProvider>
        <PatientDashboard
          user={user}
          onStartSession={handleStartSession}
          onNavigate={handleNavigate}
        />
      </SessionProvider>
    </div>
  );
}

export default AppWithNewUI;
