/**
 * PhysioLogo.jsx
 * Modern SVG logo for Physio app
 */

import React from 'react';

const PhysioLogo = ({ className = "w-8 h-8", color = "currentColor" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer circle with pulse effect */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        stroke={color} 
        strokeWidth="3" 
        fill="none"
        opacity="0.2"
      />
      
      {/* Main heartbeat line */}
      <path
        d="M 15 50 L 30 50 L 35 35 L 40 65 L 45 50 L 50 50 L 55 40 L 60 60 L 65 50 L 85 50"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Knee joint indicator - stylized */}
      <g transform="translate(50, 50)">
        {/* Upper leg bone */}
        <line 
          x1="0" 
          y1="-25" 
          x2="0" 
          y2="-5" 
          stroke={color} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
        
        {/* Knee joint circle */}
        <circle 
          cx="0" 
          cy="0" 
          r="7" 
          fill={color}
          opacity="0.9"
        />
        
        {/* Lower leg bone */}
        <line 
          x1="0" 
          y1="5" 
          x2="3" 
          y2="25" 
          stroke={color} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
      </g>
      
      {/* AI dot indicator */}
      <circle 
        cx="75" 
        cy="25" 
        r="5" 
        fill={color}
      >
        <animate 
          attributeName="opacity" 
          values="1;0.3;1" 
          dur="2s" 
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};

export default PhysioLogo;
