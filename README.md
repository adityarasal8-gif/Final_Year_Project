# Phisi - Zero-Hardware Knee Physiotherapy Monitoring PWA

A progressive web application for knee physiotherapy monitoring using AI pose detection with MediaPipe.

## 🎯 Features

- **Adaptive Baseline Logic**: Day 1 calibration captures baseline ROM, future sessions track improvement
- **Real-Time Angle Tracking**: Uses MediaPipe Pose Landmarker for accurate knee angle calculation
- **Visual Feedback**: Color-coded skeleton overlay (Green = Good, Red = Warning)
- **Rep Counting**: Automatic rep detection based on flexion/extension cycles
- **Progress Tracking**: Real-time improvement percentage calculation
- **Audio Cues**: Sound feedback for warnings and rep completion
- **PWA**: Works offline with cached MediaPipe models

## 🏗️ Architecture

### Tech Stack
- **Framework**: React.js (Vite)
- **Language**: JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **AI Model**: @mediapipe/tasks-vision (Pose Landmarker)
- **Backend**: Firebase (Firestore + Auth)
- **Deployment**: Vercel

### Core Logic

1. **Phase 1 (Calibration)**: Record baseline ROM on Day 1
2. **Phase 2 (Exercise)**:
   - Detect landmarks: Hip (23), Knee (25), Ankle (27)
   - Calculate knee angle using Law of Cosines
   - Compare: `Improvement % = (CurrentAngle - BaselineROM) / (Target - BaselineROM)`
   - Feedback: Green overlay if CurrentAngle >= Target, Red if below baseline

### File Structure

```
src/
├── hooks/
│   └── usePoseEstimation.js    # MediaPipe integration & frame processing
├── utils/
│   └── geometry.js             # Math functions for angle calculation
├── components/
│   └── Viewport.jsx            # Webcam + Canvas overlay component
├── context/
│   └── SessionContext.jsx      # Global session state management
├── App.jsx                     # Main app orchestration
├── main.jsx                    # React entry point
└── index.css                   # Tailwind styles
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Webcam access
- Modern browser (Chrome, Edge, Safari)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Usage

1. **Setup**: Select which leg needs therapy (left/right)
2. **Calibration**: Perform max knee flexion - this becomes your baseline
3. **Exercise**: Start your session and track real-time progress
4. **Feedback**: 
   - 🟢 Green overlay = Target achieved
   - 🔴 Red overlay = Below baseline (warning)

## 🧮 Core Algorithms

### Knee Angle Calculation
```javascript
// Using Law of Cosines with vectors
const vectorKneeToHip = createVector(knee, hip);
const vectorKneeToAnkle = createVector(knee, ankle);
const dot = dotProduct(vectorKneeToHip, vectorKneeToAnkle);
const angle = Math.acos(dot / (magnitude1 * magnitude2)) * (180 / Math.PI);
```

### Improvement Calculation
```javascript
improvement = ((currentAngle - baselineROM) / (targetROM - baselineROM)) * 100;
```

## 🎨 Customization

### Change Target ROM
Edit [src/context/SessionContext.jsx](src/context/SessionContext.jsx):
```javascript
const [targetROM, setTargetROM] = useState(135); // Default: 135°
```

### Adjust Rep Detection Thresholds
Edit [src/context/SessionContext.jsx](src/context/SessionContext.jsx):
```javascript
const flexionThreshold = baselineROM + 10; // Adjust sensitivity
const extensionThreshold = 60; // Return position
```

### Modify Smoothing Factor
Edit [src/hooks/usePoseEstimation.js](src/hooks/usePoseEstimation.js):
```javascript
kneeAngle = smoothAngle(kneeAngle, previousAngle, 0.3); // 0.3 = smoothing factor
```

## 🔧 Configuration

### MediaPipe Settings
The pose detector uses:
- **Model**: `pose_landmarker_lite` (optimized for performance)
- **Running Mode**: VIDEO (detector-tracker logic for high FPS)
- **Delegate**: GPU acceleration
- **Confidence Thresholds**: 0.5 (adjustable)

### PWA Settings
Caching strategy for MediaPipe models:
- **CacheFirst** for CDN resources
- **1-year expiration** for model files
- **Offline support** via Workbox

## 📱 PWA Installation

Once deployed, users can install the app:
1. Visit the app URL on mobile/desktop
2. Click "Install" or "Add to Home Screen"
3. Use like a native app with offline support

## 🐛 Troubleshooting

### Camera not working
- Check browser permissions
- Ensure HTTPS (required for camera access)
- Try different browser

### Pose detection slow
- Ensure good lighting
- Stand 6-8 feet from camera
- Reduce camera resolution in [Viewport.jsx](src/components/Viewport.jsx)

### Angle calculation issues
- Ensure full body visible in frame
- Check landmark visibility scores
- Adjust `minVisibility` threshold

## 📊 Future Enhancements

- [ ] Firebase integration for cloud sync
- [ ] Historical progress charts
- [ ] Multi-user support
- [ ] Exercise library (different movements)
- [ ] PDF report generation
- [ ] Therapist dashboard

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

- **MediaPipe**: Google's ML solution for pose detection
- **React**: UI framework
- **Tailwind CSS**: Styling framework
- **Vite**: Build tool

---

Built with ❤️ for knee physiotherapy patients
