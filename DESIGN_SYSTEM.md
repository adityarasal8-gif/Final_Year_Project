# 🎨 Medical Design System - Phisi PWA

## Overview
This document describes the professional medical-grade design system for the Knee Physiotherapy PWA. Built with **Tailwind CSS**, **Framer Motion**, and **Lucide React** icons.

---

## 🎯 Design Philosophy

> **"Clean, Accessible, Trustworthy Medical Aesthetic"**

We balance clinical professionalism with modern interactivity to create a healthcare experience that patients trust and therapists rely on.

---

## 🎨 Color Palette

### Medical Colors
```javascript
// Primary - Healing & Trust
'medical-primary': '#0D9488' // Teal-600

// Secondary - Technology & AI
'medical-secondary': '#4F46E5' // Indigo-600

// Feedback Colors
'medical-success': '#10B981' // Soft Green
'medical-error': '#EF4444' // Soft Red
'medical-warning': '#F59E0B' // Amber

// Background
'medical-background': '#F8FAFC' // Slate-50 (Clinical Clean)
'medical-surface': '#FFFFFF' // Pure White

// Text
'medical-text-primary': '#0F172A' // Slate-900
'medical-text-secondary': '#64748B' // Slate-500
```

### Usage Examples
```jsx
// Primary action button
<button className="bg-medical-primary text-white hover:bg-teal-700">
  Start Session
</button>

// Success indicator
<div className="text-medical-success bg-green-50">
  Goal achieved! 🎉
</div>

// Clinical background
<div className="bg-medical-background">
  <div className="bg-medical-surface rounded-2xl shadow-medical">
    Content here
  </div>
</div>
```

---

## 📝 Typography

### Font Stack
```javascript
fontFamily: {
  sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif']
}
```

### Scale
- **Hero Heading**: `text-5xl lg:text-7xl` (48px → 72px)
- **Section Title**: `text-4xl lg:text-5xl` (36px → 48px)
- **Card Title**: `text-2xl` (24px)
- **Body Text**: `text-base` (16px)
- **Caption**: `text-sm` (14px)
- **Label**: `text-xs` (12px)

### Weight Hierarchy
- **Extra Bold**: `font-bold` - Headlines, CTAs
- **Semibold**: `font-semibold` - Subheadings
- **Medium**: `font-medium` - Labels, buttons
- **Normal**: `font-normal` - Body text

---

## 🎬 Animations

### Framer Motion Variants

#### Fade In Up
```jsx
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

<motion.div
  initial="hidden"
  animate="visible"
  variants={fadeInUp}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
```

#### Stagger Container
```jsx
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

<motion.div variants={staggerContainer}>
  <motion.div variants={fadeInUp}>Child 1</motion.div>
  <motion.div variants={fadeInUp}>Child 2</motion.div>
  <motion.div variants={fadeInUp}>Child 3</motion.div>
</motion.div>
```

#### Scale In
```jsx
const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};
```

#### Pulse (for CTAs)
```jsx
<motion.button
  animate={{
    scale: [1, 1.05, 1],
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut"
  }}
>
  Primary Action
</motion.button>
```

### Tailwind Custom Animations
```javascript
// In tailwind.config.js
animation: {
  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  'fade-in': 'fadeIn 0.5s ease-in-out',
  'slide-up': 'slideUp 0.5s ease-out',
  'scale-in': 'scaleIn 0.3s ease-out',
}
```

---

## 🧩 Component Library

### 1. **LandingPageNew.jsx** - High-Converting Marketing Page

#### Hero Section
- Gradient background with animated blobs
- Split layout: Content left, Visual right
- Animated skeleton visualization
- Floating stats cards
- Scroll indicator

#### How It Works
- 3-step process cards
- Scroll-triggered animations
- Color-coded by step (Teal, Indigo, Green)
- Hover effects with `hover:-translate-y-2`

#### Trust Signals
- Grayscale badge marquee
- HIPAA, clinic count, patient count
- Low opacity for subtlety

#### Interactive Demo
- Hover-to-reveal angle detection
- SVG leg visualization
- Real-time angle indicator

**Key Features:**
- ✅ Framer Motion scroll animations
- ✅ Responsive hero with mobile breakpoints
- ✅ Animated background gradients
- ✅ Professional SaaS conversion flow

---

### 2. **PatientDashboard.jsx** - Mobile-First Patient Hub

#### Top Card (Streak & Goal)
```jsx
// Gradient header with streak flame
<div className="bg-gradient-to-br from-medical-primary to-teal-600">
  <div className="bg-white/10 backdrop-blur-md">
    🔥 7 Day Streak
    Progress bar with gradient fill
  </div>
</div>
```

#### Quick Stats Grid
```jsx
<div className="grid grid-cols-3 gap-4">
  <div className="bg-white rounded-2xl p-4 shadow-md">
    <Calendar />
    <div className="text-2xl font-bold">42</div>
    <div className="text-xs text-gray-500">Sessions</div>
  </div>
  // Repeat for Progress and Milestones
</div>
```

#### Recovery Curve Chart
- Recharts AreaChart with gradient fill
- 7-day view (last 7 days)
- Target line (dashed)
- Custom tooltip styling

#### Floating Action Button
- Massive thumb-friendly size (`px-12 py-6`)
- Pulsing shadow animation
- Gradient background
- Fixed position `bottom-24`

#### Bottom Navigation Bar
```jsx
<nav className="fixed bottom-0 bg-white border-t">
  <button className={activeTab === 'home' ? 'text-medical-primary' : 'text-gray-400'}>
    <Home />
    <span>Home</span>
  </button>
  // History, Profile tabs
</nav>
```

**Key Features:**
- ✅ Mobile-first layout (max-w-lg)
- ✅ Bottom tab navigation (iOS/Android style)
- ✅ Motivating streak indicator with flame icon
- ✅ Recharts integration for progress visualization
- ✅ Thumb-reachable action button

---

### 3. **ExerciseViewport.jsx** - Minimalist Immersive Mode

#### Traffic Light Indicator
```jsx
<div className="absolute top-6 right-6 flex flex-col gap-2">
  {/* Green */}
  <motion.div
    animate={{
      backgroundColor: formQuality === 'excellent' ? '#10B981' : '#1F2937',
      boxShadow: formQuality === 'excellent' 
        ? '0 0 20px rgba(16, 185, 129, 0.6)' 
        : 'none'
    }}
    className="w-5 h-5 rounded-full"
  />
  {/* Yellow, Red */}
</div>
```

**Form Quality Logic:**
- 🟢 Green: Angle ≥ 135° (Excellent form)
- 🟡 Yellow: Angle ≥ Baseline (Good form)
- 🔴 Red: Angle < Baseline (Poor form)

#### Large Rep Counter
```jsx
<motion.div
  key={reps}
  initial={{ scale: 1.5, opacity: 0 }}
  animate={{ scale: 1, opacity: 0.2 }}
  className="text-[200px] font-bold text-white"
>
  {reps}
</motion.div>
```
- 200px font size
- 20% opacity (non-distracting)
- Animates on rep change

#### Press & Hold to End
```jsx
<motion.button
  onMouseDown={handlePressStart}
  onMouseUp={handlePressEnd}
  onTouchStart={handlePressStart}
  onTouchEnd={handlePressEnd}
>
  Press & Hold to End
  {/* Circular progress indicator */}
  <svg className="absolute inset-0">
    <circle strokeDashoffset={2πr(1 - progress/100)} />
  </svg>
</motion.button>
```
- Prevents accidental taps
- 100% progress = ends session
- Visual feedback with stroke animation

**Key Features:**
- ✅ Distraction-free UI (no header/footer)
- ✅ Real-time form feedback (traffic light)
- ✅ Unobtrusive rep counter
- ✅ Safe session ending (hold for 1 second)
- ✅ Fullscreen toggle (top-left)

---

## 📱 Responsive Breakpoints

```javascript
// Tailwind default breakpoints
sm: '640px'   // Mobile landscape
md: '768px'   // Tablet
lg: '1024px'  // Laptop
xl: '1280px'  // Desktop
2xl: '1536px' // Large desktop
```

### Mobile-First Strategy
```jsx
// Default: Mobile
<div className="px-4 py-6">
  
// Tablet and up
<div className="md:px-6 md:py-8">

// Desktop
<div className="lg:px-12 lg:py-12">
```

---

## 🎯 Key UI Patterns

### 1. Glassmorphism Cards
```jsx
<div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl">
  Content with frosted glass effect
</div>
```

### 2. Medical Shadows
```jsx
// Subtle teal glow
<div className="shadow-medical hover:shadow-medical-lg">
  Card
</div>

// CSS:
shadow-medical: '0 4px 6px -1px rgba(13, 148, 136, 0.1)'
shadow-medical-lg: '0 10px 15px -3px rgba(13, 148, 136, 0.1)'
```

### 3. Gradient Backgrounds
```jsx
// Hero gradient
<div className="bg-gradient-to-br from-medical-primary via-teal-500 to-medical-secondary">

// Card gradient
<div className="bg-gradient-to-br from-teal-50 to-teal-100">
```

### 4. Icon + Text Combos
```jsx
<div className="flex items-center gap-3">
  <div className="bg-medical-primary/10 rounded-full p-3">
    <Icon className="w-6 h-6 text-medical-primary" />
  </div>
  <div>
    <div className="font-bold">Metric</div>
    <div className="text-sm text-gray-500">Label</div>
  </div>
</div>
```

---

## 🚀 PWA Features

### Install Prompt
```jsx
<motion.div
  initial={{ y: 100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  className="fixed bottom-20 left-4 right-4 bg-white rounded-xl shadow-2xl p-4"
>
  <div className="flex items-center justify-between">
    <div>
      <p className="font-bold">Install Phisi App</p>
      <p className="text-sm text-gray-500">Access offline anytime</p>
    </div>
    <button className="bg-medical-primary text-white px-4 py-2 rounded-lg">
      Install
    </button>
  </div>
</motion.div>
```

### Offline Skeleton Loaders
```jsx
<div className="animate-pulse">
  <div className="h-24 bg-gray-200 rounded-2xl mb-4" />
  <div className="h-48 bg-gray-200 rounded-2xl mb-4" />
  <div className="h-32 bg-gray-200 rounded-2xl" />
</div>
```

---

## ✅ Accessibility Checklist

- [ ] All buttons have `aria-label` or visible text
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] Keyboard navigation (Tab, Enter, Space)
- [ ] Focus visible states (`focus:ring-2 focus:ring-medical-primary`)
- [ ] ARIA roles for custom components
- [ ] Screen reader announcements for dynamic content

---

## 🎨 Design Tokens (CSS Variables)

```css
:root {
  --medical-primary: #0D9488;
  --medical-secondary: #4F46E5;
  --medical-success: #10B981;
  --medical-error: #EF4444;
  --medical-background: #F8FAFC;
  --medical-surface: #FFFFFF;
  
  --spacing-unit: 4px; /* Base 4px grid */
  --border-radius-sm: 0.5rem; /* 8px */
  --border-radius-md: 1rem; /* 16px */
  --border-radius-lg: 1.5rem; /* 24px */
  --border-radius-xl: 2rem; /* 32px */
  
  --shadow-medical: 0 4px 6px -1px rgba(13, 148, 136, 0.1);
  --shadow-medical-lg: 0 10px 15px -3px rgba(13, 148, 136, 0.1);
}
```

---

## 📦 Component Integration Example

```jsx
// App.jsx
import LandingPageNew from './components/LandingPageNew';
import PatientDashboard from './components/PatientDashboard';
import ExerciseViewport from './components/ExerciseViewport';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); // 'landing' | 'dashboard' | 'exercise'

  if (!user) {
    return <LandingPageNew onAuthSuccess={setUser} />;
  }

  if (view === 'dashboard') {
    return (
      <PatientDashboard
        user={user}
        onStartSession={() => setView('exercise')}
      />
    );
  }

  if (view === 'exercise') {
    return (
      <ExerciseViewport
        onEndSession={() => setView('dashboard')}
      />
    );
  }
}
```

---

## 🔧 Development Setup

### Install Dependencies
```bash
npm install framer-motion lucide-react recharts
```

### Tailwind Config
Already configured in `tailwind.config.js` with medical colors and animations.

### Import Components
```jsx
import { LandingPageNew } from './components/LandingPageNew';
import { PatientDashboard } from './components/PatientDashboard';
import { ExerciseViewport } from './components/ExerciseViewport';
```

---

## 🎯 Key Takeaways

1. **Trust First**: Medical colors (teal, indigo) convey healing and technology
2. **Motion Matters**: Framer Motion adds polish without distraction
3. **Mobile Priority**: Bottom nav, thumb-friendly buttons, responsive charts
4. **Immersive Exercise**: Minimal UI during workouts, traffic light feedback
5. **Data Visualization**: Recharts for progress tracking with medical styling

---

## 📚 Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Framer Motion API](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- [Recharts Examples](https://recharts.org/en-US/examples)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)

---

**Built with ❤️ for better patient outcomes**
