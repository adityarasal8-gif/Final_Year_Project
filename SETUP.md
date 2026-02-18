# 🚀 Phisi Project - Quick Setup Guide

## Step 1: Install Dependencies

```powershell
npm install
```

This will install:
- React 18.2
- Vite build tool
- Tailwind CSS
- MediaPipe Tasks Vision
- Firebase
- PWA plugin

## Step 2: Run Development Server

```powershell
npm run dev
```

The app will start at `http://localhost:3000`

## Step 3: Test the Application

### First Time Setup:
1. **Allow camera access** when prompted
2. **Select leg side** (left or right)
3. **Start calibration** to set baseline ROM
4. **Perform max knee flexion** and click "Set Baseline"

### Exercise Session:
1. Click "Start Exercise Session"
2. Perform knee flexions
3. Watch real-time feedback:
   - 🟢 Green = Good progress
   - 🔴 Red = Below baseline
4. Reps counted automatically

## Architecture Overview

### Core Components

#### 1. **geometry.js** - Math Engine
```javascript
// Calculates knee angle using Law of Cosines
calculateKneeAngle(hip, knee, ankle) 
// Computes improvement percentage
calculateImprovement(currentAngle, baselineROM, targetROM)
```

#### 2. **usePoseEstimation.js** - MediaPipe Hook
```javascript
const {
  processFrame,        // Process video frame
  currentAngle,        // Current knee angle
  isInitialized,       // MediaPipe ready
  drawLandmarks        // Draw skeleton
} = usePoseEstimation({ legSide: 'left' });
```

#### 3. **SessionContext.jsx** - State Management
```javascript
const {
  baselineROM,         // Baseline angle from Day 1
  reps,                // Rep counter
  improvement,         // Progress percentage
  setBaseline,         // Set baseline from calibration
  updateAngle          // Update current angle
} = useSession();
```

#### 4. **Viewport.jsx** - Camera Component
- Displays webcam feed
- Overlays pose skeleton
- Shows real-time stats
- Handles visual feedback

## Key Concepts

### Adaptive Baseline Logic
```
Improvement % = (CurrentAngle - BaselineROM) / (TargetAngle - BaselineROM) × 100

Example:
- Baseline: 90° (Day 1 max flexion)
- Target: 135° (full flexion)
- Current: 110°
- Improvement = (110 - 90) / (135 - 90) × 100 = 44%
```

### Rep Detection
```
Rep = Flexion Phase → Extension Phase

Flexion: angle >= (baseline + 10°)
Extension: angle <= 60°
```

### Landmark Indices (MediaPipe)
```
LEFT LEG:          RIGHT LEG:
23: Hip            24: Hip
25: Knee           26: Knee  
27: Ankle          28: Ankle
```

## Customization Guide

### 1. Adjust Target ROM
[src/context/SessionContext.jsx](src/context/SessionContext.jsx)
```javascript
const [targetROM, setTargetROM] = useState(135); // Change to your target
```

### 2. Modify Angle Smoothing
[src/hooks/usePoseEstimation.js](src/hooks/usePoseEstimation.js)
```javascript
smoothAngle(kneeAngle, previousAngle, 0.3); // 0.1-0.5 range
```

### 3. Change Rep Thresholds
[src/context/SessionContext.jsx](src/context/SessionContext.jsx)
```javascript
const flexionThreshold = baselineROM + 10;  // More sensitive: +5
const extensionThreshold = 60;               // Stricter: 45
```

### 4. Adjust MediaPipe Confidence
[src/hooks/usePoseEstimation.js](src/hooks/usePoseEstimation.js)
```javascript
minPoseDetectionConfidence: 0.5,  // Lower = more detections
minTrackingConfidence: 0.5,       // Higher = more stable
```

## Performance Tips

### Optimize FPS
1. Use "VIDEO" mode (already configured)
2. Track single person only ✓
3. Disable segmentation masks ✓
4. Use GPU acceleration ✓

### Reduce Jitter
1. Increase smoothing factor (0.3 → 0.5)
2. Apply moving average filter
3. Increase confidence thresholds

### Better Detection
1. Ensure good lighting
2. Stand 6-8 feet from camera
3. Wear contrasting clothing
4. Clear background

## Deployment

### Build for Production
```powershell
npm run build
```

### Deploy to Vercel
```powershell
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### PWA Installation
Once deployed:
1. Visit your app URL
2. Click "Install" in browser
3. App works offline with cached models

## Troubleshooting

### Camera Issues
- ✅ Check browser permissions (Settings → Privacy)
- ✅ Use HTTPS (localhost OK for dev)
- ✅ Try Chrome/Edge (best compatibility)

### Slow Performance
- ✅ Close other tabs/apps
- ✅ Reduce camera resolution (edit Viewport.jsx)
- ✅ Check GPU acceleration enabled

### Angle Calculation Wrong
- ✅ Ensure full body visible
- ✅ Check landmark visibility in console
- ✅ Adjust minVisibility threshold

### Reps Not Counting
- ✅ Verify baseline is set
- ✅ Check flexion/extension thresholds
- ✅ Ensure full range of motion

## Next Steps

### Firebase Integration (Optional)
1. Create Firebase project
2. Add config to `src/firebase.js`
3. Implement Firestore storage for session history
4. Add authentication

### Features to Add
- [ ] Exercise history charts
- [ ] PDF report generation
- [ ] Multiple exercise types
- [ ] Social sharing
- [ ] Therapist dashboard

## Support

For issues or questions:
1. Check console for errors (F12)
2. Review landmark visibility scores
3. Test with different lighting/positions

---

**Built with:**
- ⚛️ React 18
- 🎨 Tailwind CSS
- 🤖 MediaPipe Vision
- ⚡ Vite
- 📱 PWA

Happy coding! 🦵💪
