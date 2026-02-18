/**
 * Signup.jsx (Medical Design System)
 * User registration with medical color palette
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { 
  saveUserProfile, 
  validateTherapistCode, 
  linkPatientToTherapist,
  createTherapistProfile 
} from '../utils/firestore';
import { User, Mail, Lock, UserPlus, Stethoscope, Sparkles, CheckCircle } from 'lucide-react';

const Signup = ({ userType, onSuccess, onBack, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    therapistCode: ''
  });
  const [patientType, setPatientType] = useState('independent'); // 'independent' or 'with_therapist'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // If Firebase is not configured, simulate demo signup
      if (!auth) {
        console.warn('Firebase not configured. Using demo mode.');
        const demoUser = {
          uid: `demo-${userType}-${Date.now()}`,
          email: formData.email,
          role: userType,
          displayName: formData.name,
          isDemo: true
        };
        onSuccess(demoUser);
        return;
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: formData.name
      });

      // For therapists, create profile with unique code
      if (userType === 'therapist') {
        const result = await createTherapistProfile(userCredential.user.uid, {
          name: formData.name,
          email: formData.email,
          role: userType
        });
        
        if (!result.success) {
          throw new Error('Failed to generate therapist code');
        }

        // Include therapist code in user object
        const user = {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          role: userType,
          displayName: formData.name,
          therapistCode: result.code
        };

        onSuccess(user);
        return;
      } else {
        // For patients, validate and link to therapist if code provided
        const profileData = {
          name: formData.name,
          email: formData.email,
          role: userType,
          patientType,
          hasTherapist: patientType === 'with_therapist',
          createdAt: new Date().toISOString()
        };

        if (patientType === 'with_therapist' && formData.therapistCode) {
          // Validate therapist code
          const validation = await validateTherapistCode(formData.therapistCode);
          if (!validation.success) {
            setError('Invalid therapist code. Please check and try again.');
            setLoading(false);
            return;
          }
          
          // Link patient to therapist
          await linkPatientToTherapist(
            userCredential.user.uid,
            validation.therapist.id,
            formData.therapistCode.toUpperCase()
          );
        } else {
          await saveUserProfile(userCredential.user.uid, profileData);
        }
      }

      const user = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        role: userType,
        displayName: formData.name,
        patientType: userType === 'patient' ? patientType : undefined,
        hasTherapist: userType === 'patient' ? patientType === 'with_therapist' : undefined
      };

      onSuccess(user);
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
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
      
      // For therapists, create profile with unique code
      if (userType === 'therapist') {
        const therapistResult = await createTherapistProfile(result.user.uid, {
          name: result.user.displayName,
          email: result.user.email,
          role: userType,
          photoURL: result.user.photoURL
        });
        
        if (!therapistResult.success) {
          throw new Error('Failed to generate therapist code');
        }

        // Include therapist code in user object
        const user = {
          uid: result.user.uid,
          email: result.user.email,
          role: userType,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          therapistCode: therapistResult.code
        };

        onSuccess(user);
        return;
      } else {
        // For patients, validate and link to therapist if code provided
        const profileData = {
          name: result.user.displayName,
          email: result.user.email,
          role: userType,
          photoURL: result.user.photoURL,
          patientType,
          hasTherapist: patientType === 'with_therapist',
          createdAt: new Date().toISOString()
        };

        if (patientType === 'with_therapist' && formData.therapistCode) {
          // Validate therapist code
          const validation = await validateTherapistCode(formData.therapistCode);
          if (!validation.success) {
            setError('Invalid therapist code. Please check and try again.');
            setLoading(false);
            return;
          }
          
          // Link patient to therapist
          await linkPatientToTherapist(
            result.user.uid,
            validation.therapist.id,
            formData.therapistCode.toUpperCase()
          );
        } else {
          await saveUserProfile(result.user.uid, profileData);
        }
      }

      const user = {
        uid: result.user.uid,
        email: result.user.email,
        role: userType,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        patientType: userType === 'patient' ? patientType : undefined,
        hasTherapist: userType === 'patient' ? patientType === 'with_therapist' : undefined
      };
      
      onSuccess(user);
    } catch (err) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email using a different sign-in method.');
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
      displayName: formData.name || `Demo ${userType}`,
      isDemo: true,
      patientType: userType === 'patient' ? patientType : undefined,
      hasTherapist: userType === 'patient' ? patientType === 'with_therapist' : undefined
    };
    onSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-secondary via-indigo-600 to-medical-primary flex items-center justify-center px-4 py-8">
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

        {/* Signup Card */}
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
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-medical-secondary to-indigo-600 rounded-2xl mb-6 shadow-lg"
            >
              {userType === 'patient' ? (
                <User className="w-10 h-10 text-white" />
              ) : (
                <Stethoscope className="w-10 h-10 text-white" />
              )}
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Create Account
            </h2>
            <p className="text-gray-600">
              Join as {userType === 'patient' ? 'Patient' : 'Therapist'} • Start recovery today
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

          {/* Patient Type Selection (Only for Patients) */}
          {userType === 'patient' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                How would you like to use Physio?
              </label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setPatientType('independent')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    patientType === 'independent'
                      ? 'border-medical-primary bg-teal-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      patientType === 'independent'
                        ? 'border-medical-primary bg-medical-primary'
                        : 'border-gray-300'
                    }`}>
                      {patientType === 'independent' && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Practice Independently</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Exercise on your own without therapist supervision
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPatientType('with_therapist')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    patientType === 'with_therapist'
                      ? 'border-medical-primary bg-teal-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      patientType === 'with_therapist'
                        ? 'border-medical-primary bg-medical-primary'
                        : 'border-gray-300'
                    }`}>
                      {patientType === 'with_therapist' && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Connect with Therapist</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Get guided care from your physiotherapist
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
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
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5 ml-1">Minimum 6 characters</p>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <CheckCircle className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Therapist Code Input (Only for patients with therapist) */}
            {userType === 'patient' && patientType === 'with_therapist' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label htmlFor="therapistCode" className="block text-sm font-semibold text-gray-700 mb-2">
                  Therapist Code (Optional)
                </label>
                <div className="relative">
                  <Stethoscope className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="therapistCode"
                    name="therapistCode"
                    type="text"
                    value={formData.therapistCode}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                    placeholder="Enter your therapist's code"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-1">
                  Get this code from your therapist to connect your accounts
                </p>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-medical-secondary to-indigo-600 hover:from-indigo-600 hover:to-medical-secondary text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
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
            {loading ? 'Signing in...' : 'Sign up with Google'}
          </motion.button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or</span>
            </div>
          </div>

          {/* Demo Mode Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleDemoMode}
            className="w-full px-6 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg border-2 border-amber-400/30 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Skip & Try Demo
          </motion.button>
          <p className="text-xs text-gray-500 text-center mt-3">
            Explore features without signing up
          </p>

          {/* Sign In Link */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-medical-secondary hover:text-indigo-700 font-semibold transition"
              >
                Sign In
              </button>
            </p>
          </div>
        </motion.div>

        {/* Privacy Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center text-sm text-white/80 space-y-1"
        >
          <p>🔒 HIPAA compliant • Your data is secure</p>
          <p>By signing up, you agree to our Terms of Service</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;
