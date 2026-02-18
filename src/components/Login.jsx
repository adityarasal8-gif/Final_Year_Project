/**
 * Login.jsx (Medical Design System)
 * Clean, accessible authentication with medical color palette
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getUserProfile } from '../utils/firestore';
import { Mail, Lock, LogIn, Stethoscope, User, Sparkles } from 'lucide-react';

const Login = ({ userType, onSuccess, onBack, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // If Firebase is not configured, simulate demo login
      if (!auth) {
        console.warn('Firebase not configured. Using demo mode.');
        const demoUser = {
          uid: `demo-${userType}-${Date.now()}`,
          email: email || `demo@${userType}.com`,
          role: userType,
          displayName: userType === 'patient' ? 'Demo Patient' : 'Demo Therapist',
          isDemo: true
        };
        onSuccess(demoUser);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user profile from Firestore to get actual role
      const profileResult = await getUserProfile(userCredential.user.uid);
      
      if (!profileResult.success) {
        throw new Error('User profile not found. Please contact support.');
      }
      
      const user = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        role: profileResult.data.role,
        name: profileResult.data.name,
        displayName: profileResult.data.name || userCredential.user.displayName,
        patientType: profileResult.data.patientType,
        hasTherapist: profileResult.data.hasTherapist,
        therapistCode: profileResult.data.therapistCode,
        therapistId: profileResult.data.therapistId
      };
      
      onSuccess(user);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      // If Firebase is not configured, use demo mode
      if (!auth) {
        console.warn('Firebase not configured. Using demo mode.');
        handleDemoMode();
        return;
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      
      // Fetch user profile from Firestore (should exist from signup)
      const profileResult = await getUserProfile(result.user.uid);
      
      if (!profileResult.success) {
        throw new Error('User profile not found. Please sign up first.');
      }

      const user = {
        uid: result.user.uid,
        email: result.user.email,
        role: profileResult.data.role,
        name: profileResult.data.name,
        displayName: profileResult.data.name || result.user.displayName,
        photoURL: result.user.photoURL,
        patientType: profileResult.data.patientType,
        hasTherapist: profileResult.data.hasTherapist,
        therapistCode: profileResult.data.therapistCode,
        therapistId: profileResult.data.therapistId
      };
      
      onSuccess(user);
    } catch (err) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    const demoUser = {
      uid: `demo-${userType}-${Date.now()}`,
      email: `demo@${userType}.com`,
      role: userType,
      displayName: userType === 'patient' ? 'Demo Patient' : 'Demo Therapist',
      isDemo: true,
      patientType: 'independent',
      hasTherapist: false
    };
    onSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary via-teal-600 to-medical-secondary flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Back Button */}
        <motion.button
          whileHover={{ x: -4 }}
          onClick={onBack}
          className="mb-6 flex items-center text-white/90 hover:text-white transition font-medium"
        >
          <span className="mr-2">←</span> Back to Home
        </motion.button>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 md:p-10"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-medical-primary to-teal-600 rounded-2xl mb-6 shadow-lg"
            >
              {userType === 'patient' ? (
                <User className="w-10 h-10 text-white" />
              ) : (
                <Stethoscope className="w-10 h-10 text-white" />
              )}
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in as {userType === 'patient' ? 'Patient' : 'Therapist'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-medical-error/10 border border-medical-error/20 rounded-xl"
            >
              <p className="text-medical-error text-sm">{error}</p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-primary focus:border-transparent transition"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-primary focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-medical-primary to-teal-600 hover:from-teal-600 hover:to-medical-primary text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </motion.button>
          </form>

          {/* Google Sign-In Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full mt-4 px-6 py-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl shadow-md border-2 border-gray-200 hover:border-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </motion.button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Demo Mode Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleDemoMode}
            className="w-full px-6 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg border-2 border-amber-400/30 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Try Demo Mode
          </motion.button>
          <p className="text-xs text-gray-500 text-center mt-3">
            No account needed • Explore instantly
          </p>

          {/* Sign Up Link */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-medical-primary hover:text-teal-700 font-semibold transition"
              >
                Sign Up
              </button>
            </p>
          </div>
        </motion.div>

        {/* Security Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center text-sm text-white/80 space-y-1"
        >
          <p>🔒 Bank-level encryption • HIPAA compliant</p>
          <p>All video processing happens on your device</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
