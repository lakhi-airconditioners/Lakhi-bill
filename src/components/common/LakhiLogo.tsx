import React, { useState, useEffect } from 'react';

interface LakhiLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'responsive';
  variant?: 'full' | 'icon' | 'auto';
  themeInvert?: boolean;
}

export const LakhiLogo: React.FC<LakhiLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  themeInvert = false,
}) => {
  const [customLogoAvailable, setCustomLogoAvailable] = useState<boolean>(false);

  useEffect(() => {
    // Check if the user has replaced the blank temp /public/logo.png with their logo
    const testImg = new Image();
    testImg.src = '/logo.png';
    testImg.onload = () => {
      // If image is larger than the 1x1 blank placeholder, use it!
      if (testImg.naturalWidth > 1 && testImg.naturalHeight > 1) {
        setCustomLogoAvailable(true);
      }
    };
  }, []);

  const heightMap = {
    sm: 34,
    md: 44,
    lg: 56,
    xl: 72,
    responsive: 40,
  };

  const isResponsive = size === 'responsive';
  const h = heightMap[size];
  const w = variant === 'icon' ? h : Math.round(h * 3.1);

  // If user placed custom logo in /public/logo.png, display it directly
  if (customLogoAvailable) {
    return (
      <img
        src="/logo.png"
        alt="Lakhi Airconditioners"
        style={!isResponsive ? { height: `${h}px` } : undefined}
        className={`${
          isResponsive ? 'h-7 sm:h-9 md:h-10' : ''
        } w-auto object-contain select-none drop-shadow-xs ${className}`}
      />
    );
  }

  // Black vs White for dark mode or inverted headers
  const blackColor = themeInvert ? '#FFFFFF' : '#111827';
  const redColor = '#E01E26';

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 160 160"
        width={!isResponsive ? h : undefined}
        height={!isResponsive ? h : undefined}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-xs ${isResponsive ? 'h-8 w-8 sm:h-9 sm:w-9' : ''} ${className}`}
        aria-label="Lakhi Airconditioners Icon"
      >
        {/* Outer Circular Base */}
        <circle cx="80" cy="80" r="74" fill={blackColor} />

        {/* Red Quarter Arc (Top Right) */}
        <path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill={redColor} />

        {/* White Inner Lightning Circle */}
        <circle cx="50" cy="80" r="27" stroke="#FFFFFF" strokeWidth="5.5" fill="none" />

        {/* Lightning Bolt */}
        <path
          d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z"
          fill="#FFFFFF"
        />

        {/* Stylized L cutout */}
        <path
          d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // If variant is 'auto', render compact icon on mobile (<sm) and full logo on sm+
  if (variant === 'auto') {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        {/* Mobile Icon Only (< sm) */}
        <svg
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="sm:hidden h-8 w-8 shrink-0 drop-shadow-xs"
          aria-label="Lakhi Airconditioners Icon"
        >
          <circle cx="80" cy="80" r="74" fill={blackColor} />
          <path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill={redColor} />
          <circle cx="50" cy="80" r="27" stroke="#FFFFFF" strokeWidth="5.5" fill="none" />
          <path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="#FFFFFF" />
          <path d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z" fill="#FFFFFF" />
        </svg>

        {/* Desktop / Tablet Full Logo (>= sm) */}
        <svg
          viewBox="0 0 465 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="hidden sm:block h-8 md:h-10 w-auto shrink-0 drop-shadow-xs"
          aria-label="Lakhi Airconditioners Logo"
        >
          <g id="lakhi-badge">
            <circle cx="75" cy="75" r="70" fill={blackColor} />
            <path d="M 75 7 A 68 68 0 0 1 143 75 L 75 75 Z" fill={redColor} />
            <circle cx="48" cy="75" r="26" stroke="#FFFFFF" strokeWidth="5" fill="none" />
            <path d="M 50 56 L 39 77 L 48 77 L 45 96 L 58 73 L 49 73 Z" fill="#FFFFFF" />
            <path d="M 72 20 L 93 20 L 93 110 C 93 121 102 129 116 129 L 134 129 L 134 143 L 112 143 C 86 143 72 127 72 106 Z" fill="#FFFFFF" />
          </g>
          <g id="text-LAKHI" fill={blackColor}>
            <path d="M 165 42 H 184 V 90 H 215 V 106 H 165 Z" />
            <path d="M 236 42 L 219 106 H 236 L 241 87 H 261 L 266 106 H 284 L 267 42 H 236 Z M 245 73 L 251 51 L 257 73 H 245 Z" />
            <polygon points="251,48 244,71 258,71" fill={redColor} />
            <path d="M 292 42 H 310 V 69 L 332 42 H 355 L 326 76 L 358 106 H 334 L 310 82 V 106 H 292 Z" />
            <path d="M 364 42 H 382 V 66 H 406 V 42 H 424 V 106 H 406 V 82 H 382 V 106 H 364 Z" />
            <path d="M 432 42 H 450 V 106 H 432 Z" />
          </g>
          <text
            x="165"
            y="134"
            fill={redColor}
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="22"
            letterSpacing="1.8"
          >
            AIRCONDITIONERS
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 465 150"
        width={!isResponsive ? w : undefined}
        height={!isResponsive ? h : undefined}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-xs ${isResponsive ? 'h-7 sm:h-9 md:h-10 w-auto' : ''}`}
        aria-label="Lakhi Airconditioners Logo"
      >
        {/* Left Circular Badge Frame with L */}
        <g id="lakhi-badge">
          <circle cx="75" cy="75" r="70" fill={blackColor} />
          <path
            d="M 75 7 A 68 68 0 0 1 143 75 L 75 75 Z"
            fill={redColor}
          />
          <circle cx="48" cy="75" r="26" stroke="#FFFFFF" strokeWidth="5" fill="none" />
          <path
            d="M 50 56 L 39 77 L 48 77 L 45 96 L 58 73 L 49 73 Z"
            fill="#FFFFFF"
          />
          <path
            d="M 72 20 L 93 20 L 93 110 C 93 121 102 129 116 129 L 134 129 L 134 143 L 112 143 C 86 143 72 127 72 106 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* Wordmark: LAKHI */}
        <g id="text-LAKHI" fill={blackColor}>
          <path d="M 165 42 H 184 V 90 H 215 V 106 H 165 Z" />
          <path d="M 236 42 L 219 106 H 236 L 241 87 H 261 L 266 106 H 284 L 267 42 H 236 Z M 245 73 L 251 51 L 257 73 H 245 Z" />
          <polygon points="251,48 244,71 258,71" fill={redColor} />
          <path d="M 292 42 H 310 V 69 L 332 42 H 355 L 326 76 L 358 106 H 334 L 310 82 V 106 H 292 Z" />
          <path d="M 364 42 H 382 V 66 H 406 V 42 H 424 V 106 H 406 V 82 H 382 V 106 H 364 Z" />
          <path d="M 432 42 H 450 V 106 H 432 Z" />
        </g>

        {/* Subtitle: AIRCONDITIONERS in Red Bold Italic */}
        <text
          x="165"
          y="134"
          fill={redColor}
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="22"
          letterSpacing="1.8"
        >
          AIRCONDITIONERS
        </text>
      </svg>
    </div>
  );
};
