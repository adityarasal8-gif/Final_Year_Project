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

        // Always save the patient profile first
        await saveUserProfile(userCredential.user.uid, profileData);

        if (patientType === 'with_therapist' && formData.therapistCode) {
          // Validate therapist code
          const validation = await validateTherapistCode(formData.therapistCode);
          if (!validation.success) {
            setError('Invalid therapist code. Please check and try again.');
            setLoading(false);
            return;
          }
          
          // Link patient to therapist (profile already exists, safe to update)
          await linkPatientToTherapist(
            userCredential.user.uid,
            validation.therapist.id,
            formData.therapistCode.toUpperCase()
          );
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

        // Always save the patient profile first
        await saveUserProfile(result.user.uid, profileData);

        if (patientType === 'with_therapist' && formData.therapistCode) {
          // Validate therapist code
          const validation = await validateTherapistCode(formData.therapistCode);
          if (!validation.success) {
            setError('Invalid therapist code. Please check and try again.');
            setLoading(false);
            return;
          }
          
          // Link patient to therapist (profile already exists, safe to update)
          await linkPatientToTherapist(
            result.user.uid,
            validation.therapist.id,
            formData.therapistCode.toUpperCase()
          );
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
    <div className="min-h-screen bg-gradient-to-br from-medical-secondary via-indigo-600 to-medical-primary flex items-center justify-center px-3 sm:px-6 lg:px-20 xl:px-28 2xl:px-32 py-4 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl"
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
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-6 sm:p-8 lg:p-12 xl:px-14 max-h-[calc(100vh-8rem)] overflow-y-auto lg:grid lg:grid-cols-[1fr_1.35fr] lg:gap-12"
        >
          <div className="hidden lg:flex flex-col rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-9 xl:p-10 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
              {userType === 'patient' ? <User className="w-7 h-7" /> : <Stethoscope className="w-7 h-7" />}
            </div>
            <h3 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight">Create Your Account</h3>
            <p className="text-white/85 mt-4 text-sm xl:text-base leading-relaxed max-w-sm">
              Complete setup once, then quickly access your physio workspace on any laptop or mobile device.
            </p>
            <div className="mt-10 space-y-3.5 text-sm xl:text-[15px]">
              <div className="rounded-xl bg-white/15 px-5 py-3.5 border border-white/20">Personalized session experience</div>
              <div className="rounded-xl bg-white/15 px-5 py-3.5 border border-white/20">Patient and therapist modes</div>
              <div className="rounded-xl bg-white/15 px-5 py-3.5 border border-white/20">Fast secure onboarding</div>
            </div>
            <div className="mt-auto pt-10 text-xs xl:text-sm tracking-wide text-white/75">
              Registering as {userType === 'patient' ? 'Patient' : 'Therapist'}
            </div>
          </div>

          <div className="relative flex flex-col min-h-[620px] lg:min-h-[660px]">
            <div className="text-center lg:text-left mb-6 lg:mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="inline-flex lg:hidden items-center justify-center w-16 h-16 bg-gradient-to-br from-medical-secondary to-indigo-600 rounded-2xl mb-4 shadow-lg"
              >
                {userType === 'patient' ? (
                  <User className="w-8 h-8 text-white" />
                ) : (
                  <Stethoscope className="w-8 h-8 text-white" />
                )}
              </motion.div>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 mb-2 lg:mb-3">Create Account</h2>
              <p className="text-gray-600 lg:text-[15px] leading-relaxed">Join as {userType === 'patient' ? 'Patient' : 'Therapist'} and start recovery</p>
            </div>

            <div className="mb-6 lg:mb-8 grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-3">
              <div className="text-xs lg:text-[13px] lg:tracking-wide font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg py-2 lg:py-2.5 text-center">Simple Setup</div>
              <div className="text-xs lg:text-[13px] lg:tracking-wide font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-lg py-2 lg:py-2.5 text-center">Guided Onboarding</div>
              <div className="text-xs lg:text-[13px] lg:tracking-wide font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-lg py-2 lg:py-2.5 text-center">Secure Account</div>
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
                <label className="block text-sm lg:text-[13px] lg:uppercase lg:tracking-[0.06em] font-semibold text-gray-700 mb-3">
                  How would you like to use Physio?
                </label>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                        <p className="font-semibold lg:text-[15px] text-gray-900">Practice Independently</p>
                        <p className="text-sm lg:text-[13px] text-gray-600 mt-1.5 leading-relaxed">
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
                        <p className="font-semibold lg:text-[15px] text-gray-900">Connect with Therapist</p>
                        <p className="text-sm lg:text-[13px] text-gray-600 mt-1.5 leading-relaxed">
                          Get guided care from your physiotherapist
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Signup Form */}
            <form id="signup-form" onSubmit={handleSubmit} className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
              <div className="lg:col-span-1">
                <label htmlFor="name" className="block text-sm lg:text-[13px] lg:uppercase lg:tracking-[0.06em] font-semibold text-gray-700 mb-2">
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
                    className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 lg:text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <label htmlFor="email" className="block text-sm lg:text-[13px] lg:uppercase lg:tracking-[0.06em] font-semibold text-gray-700 mb-2">
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
                    className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 lg:text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <label htmlFor="password" className="block text-sm lg:text-[13px] lg:uppercase lg:tracking-[0.06em] font-semibold text-gray-700 mb-2">
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
                    className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 lg:text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-1">Minimum 6 characters</p>
              </div>

              <div className="lg:col-span-1">
                <label htmlFor="confirmPassword" className="block text-sm lg:text-[13px] lg:uppercase lg:tracking-[0.06em] font-semibold text-gray-700 mb-2">
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
                    className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 lg:text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {userType === 'patient' && patientType === 'with_therapist' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="lg:col-span-2"
                >
                  <label htmlFor="therapistCode" className="block text-sm lg:text-[13px] lg:uppercase lg:tracking-[0.06em] font-semibold text-gray-700 mb-2">
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
                      className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 lg:text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-secondary focus:border-transparent transition"
                      placeholder="Enter your therapist's code"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 ml-1">
                    Get this code from your therapist to connect your accounts
                  </p>
                </motion.div>
              )}
            </form>

            <div className="mt-7 lg:mt-auto sticky bottom-0 -mx-2 px-2 pt-4 lg:pt-5 pb-2 lg:pb-3 bg-gradient-to-t from-white via-white to-white/90 backdrop-blur-sm border-t border-gray-100">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                form="signup-form"
                disabled={loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-medical-secondary to-indigo-600 hover:from-indigo-600 hover:to-medical-secondary text-white font-semibold lg:tracking-[0.01em] rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full mt-3 px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold lg:tracking-[0.01em] rounded-xl shadow-md border-2 border-gray-200 hover:border-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Signing in...' : 'Sign up with Google'}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleDemoMode}
                disabled={loading}
                className="w-full mt-3 px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-semibold lg:tracking-[0.01em] rounded-xl shadow-lg border-2 border-amber-400/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Skip & Try Demo
              </motion.button>

              <p className="text-xs lg:text-sm text-gray-500 text-center mt-3">
                Explore features without signing up
              </p>

              <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                <p className="text-gray-600 lg:text-[15px]">
                  Already have an account?{' '}
                  <button
                    onClick={onSwitchToLogin}
                    className="text-medical-secondary hover:text-indigo-700 font-semibold transition"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Privacy Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-7 text-center text-sm lg:text-[15px] leading-relaxed text-white/80 space-y-1"
        >
          <p>🔒 HIPAA compliant • Your data is secure</p>
          <p>By signing up, you agree to our Terms of Service</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;
