# 🔥 Firebase Firestore Rules Deployment Guide

## ⚠️ Critical Issue Resolved

**Error**: `FirebaseError: Missing or insufficient permissions`

**Cause**: Firestore security rules were not configured, blocking all database operations.

**Solution**: Deploy the newly created Firestore security rules to your Firebase project.

---

## 📋 Quick Fix (Deploy Rules)

### **Option 1: Firebase Console (Easiest)**

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `phisi-project` (or your project name)
3. **Navigate to Firestore Database**:
   - Click **Firestore Database** in the left sidebar
   - Click the **Rules** tab at the top
4. **Copy and paste the rules**:
   - Open [`firestore.rules`](firestore.rules) in this project
   - Copy the entire contents
   - Paste into the Firebase Console rules editor
5. **Publish**:
   - Click **Publish** button
   - Wait for confirmation (usually 10-30 seconds)

---

### **Option 2: Firebase CLI (Recommended for Production)**

#### **Step 1: Install Firebase CLI**

```powershell
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version
```

#### **Step 2: Login to Firebase**

```powershell
# Login to your Firebase account
firebase login

# This will open a browser window for authentication
```

#### **Step 3: Initialize Firebase (if not already done)**

```powershell
# Navigate to project directory
cd D:\phisi_project

# Initialize Firebase
firebase init

# Select the following options:
# ✓ Firestore: Configure security rules and indexes files
# ✓ Hosting: Configure files for Firebase Hosting
#
# Use existing project: Select your project
# Firestore rules file: firestore.rules (already exists)
# Firestore indexes file: firestore.indexes.json (already exists)
# Hosting public directory: dist
# Configure as single-page app: Yes
# Set up automatic builds: No
# Overwrite files: No (keep existing files)
```

#### **Step 4: Deploy Firestore Rules**

```powershell
# Deploy only Firestore rules (fast)
firebase deploy --only firestore:rules

# Or deploy everything (rules + indexes)
firebase deploy --only firestore

# Output should show:
# ✔  Deploy complete!
```

---

## 🔒 Security Rules Explained

The [`firestore.rules`](firestore.rules) file contains the following access control:

### **Users Collection**

```javascript
// ✅ Users can read/write their own profile
allow read, create, update: if isOwner(userId);

// ✅ Therapists can read their patients' profiles
allow read: if resource.data.therapistId == request.auth.uid;

// ✅ Therapists can update their own profile (linkedPatients array)
allow update: if isTherapist() && request.auth.uid == userId;
```

### **Sessions Collection**

```javascript
// ✅ Users can read/write their own sessions
allow read, create, update: if resource.data.userId == request.auth.uid;

// ✅ Therapists can read their patients' sessions
allow read: if isTherapist() && therapistOwnsPatient(resource.data.userId);
```

### **Query Limits**

```javascript
// Limit query results to prevent excessive reads
allow list: if request.query.limit <= 100;
```

---

## 🧪 Testing After Deployment

After deploying the rules, test the following flows:

### **1. Therapist Dashboard**

```javascript
// Should work without errors:
const patients = await getTherapistPatients(therapistId);
// ✅ Returns list of patients linked to this therapist
```

### **2. Patient Sessions**

```javascript
// Should work without errors:
const sessions = await getUserSessions(patientId);
// ✅ Returns patient's exercise sessions
```

### **3. Patient Registration**

```javascript
// Should work without errors:
await saveUserProfile(userId, profileData);
// ✅ Creates user profile in Firestore
```

---

## 🔍 Verify Rules Are Active

### **Method 1: Firebase Console**

1. Go to **Firestore Database** → **Rules** tab
2. Check the **Last published** timestamp
3. Should show recent date/time after deployment

### **Method 2: Rules Playground**

1. Go to **Firestore Database** → **Rules** tab
2. Click **Rules Playground** button
3. Test queries:

```javascript
// Test: Therapist reading their patient list
Location: /users/{patientUserId}
Auth: Custom auth (therapist UID)
Operation: get
Expected: ✅ Allow
```

---

## 📊 Database Indexes

The [`firestore.indexes.json`](firestore.indexes.json) file contains composite indexes for efficient queries:

### **Index 1: Sessions by User and Date**
```json
{
  "collectionGroup": "sessions",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose**: Allows therapists to query patient sessions sorted by date

### **Index 2: Users by Therapist and Role**
```json
{
  "collectionGroup": "users",
  "fields": [
    { "fieldPath": "therapistId", "order": "ASCENDING" },
    { "fieldPath": "role", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Allows `getTherapistPatients()` query to find all patients linked to a therapist

### **Index 3: Users by Therapist Code**
```json
{
  "collectionGroup": "users",
  "fields": [
    { "fieldPath": "therapistCode", "order": "ASCENDING" },
    { "fieldPath": "role", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Allows `validateTherapistCode()` to quickly find therapist by code

---

## ⚡ Quick Deploy Commands

```powershell
# Option A: Deploy rules only (fastest)
firebase deploy --only firestore:rules

# Option B: Deploy rules + indexes
firebase deploy --only firestore

# Option C: Deploy everything (rules, indexes, hosting)
firebase deploy

# Option D: Deploy and watch for errors
firebase deploy --only firestore --debug
```

---

## 🐛 Troubleshooting

### **Error: "PERMISSION_DENIED: Missing or insufficient permissions"**

**Cause**: Rules not deployed or incorrect rules

**Solutions**:
1. Deploy rules via Firebase Console (quickest)
2. Check rules are published (look for timestamp)
3. Clear browser cache and reload app
4. Wait 30-60 seconds after deployment

### **Error: "Failed to get document because the client is offline"**

**Cause**: Network issue or Firebase connection

**Solutions**:
1. Check internet connection
2. Verify Firebase config in `.env` file
3. Check Firebase Console project status

### **Error: "Firebase: Error (auth/popup-closed-by-user)"**

**Cause**: Google sign-in popup closed

**Solutions**:
1. Click sign-in button again
2. Allow popups in browser settings
3. Use email/password authentication instead

### **Error: "Index not found"**

**Cause**: Composite index not created

**Solutions**:
1. Deploy indexes: `firebase deploy --only firestore:indexes`
2. Or click the auto-generated index link in the error message
3. Wait 2-5 minutes for index to complete building

---

## 📝 Files Created

| File | Purpose | Status |
|------|---------|--------|
| [`firestore.rules`](firestore.rules) | Security rules for database access | ✅ Created |
| [`firestore.indexes.json`](firestore.indexes.json) | Composite indexes for queries | ✅ Created |
| [`firebase.json`](firebase.json) | Firebase configuration | ✅ Created |
| `FIREBASE_DEPLOYMENT_GUIDE.md` | This guide | ✅ Created |

---

## 🎯 Next Steps

1. **Deploy rules** using Option 1 (Firebase Console) or Option 2 (Firebase CLI)
2. **Wait 30 seconds** for rules to propagate
3. **Refresh your app** (F5 or Ctrl+R)
4. **Test therapist dashboard** - should now load without errors
5. **Test patient connection** - therapist code validation should work

---

## 🔐 Security Best Practices

✅ **Current Implementation**:
- Users can only access their own data
- Therapists can only access their linked patients' data
- All operations require authentication
- Query limits prevent excessive reads
- Write operations are restricted to data owners

⚠️ **Future Enhancements**:
- Add rate limiting for authentication attempts
- Implement field-level validation rules
- Add audit logging for sensitive operations
- Implement data retention policies
- Add backup and recovery procedures

---

## 📞 Support

If you still encounter issues after deployment:

1. Check Firebase Console logs: **Firestore** → **Usage** tab
2. Check browser console for detailed error messages
3. Verify authentication is working: Check if `auth.currentUser` exists
4. Test with demo mode: Should work without Firebase rules

---

**Last Updated**: February 18, 2026  
**Status**: Ready for deployment  
**Priority**: 🔴 Critical - Deploy immediately to fix permission errors
