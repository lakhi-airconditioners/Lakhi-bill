import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogos } from '../../types';

export interface LakhiLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'responsive';
  variant?: 'full' | 'icon' | 'main' | 'auto';
  themeInvert?: boolean;
}

export const LakhiLogo: React.FC<LakhiLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  themeInvert = false,
}) => {
  // Gracefully read brandLogos from context or local storage
  let brandLogos: BrandLogos = {};
  try {
    const context = useApp();
    if (context && context.brandLogos) {
      brandLogos = context.brandLogos;
    }
  } catch {
    try {
      const saved = localStorage.getItem('lakhi_brand_logos');
      if (saved) brandLogos = JSON.parse(saved);
    } catch {
      brandLogos = {};
    }
  }

  const [customLogoAvailable, setCustomLogoAvailable] = useState<boolean>(false);
  const [img1x1Failed, setImg1x1Failed] = useState<boolean>(false);
  const [imgMainFailed, setImgMainFailed] = useState<boolean>(false);
  const [imgWordmarkFailed, setImgWordmarkFailed] = useState<boolean>(false);

  useEffect(() => {
    // Also check if user replaced static /public/logo.png with a real custom file
    const testImg = new Image();
    testImg.src = '/logo.png';
    testImg.onload = () => {
      if (testImg.naturalWidth > 1 && testImg.naturalHeight > 1) {
        setCustomLogoAvailable(true);
      }
    };
  }, []);

  const heightMap: Record<string, number> = {
    xs: 24,
    sm: 34,
    md: 44,
    lg: 56,
    xl: 72,
    responsive: 40,
  };

  const isResponsive = size === 'responsive';
  const h = heightMap[size] || 44;
  const w = variant === 'icon' ? h : Math.round(h * 3.1);

  // Black vs White for dark mode or inverted headers
  const blackColor = themeInvert ? '#FFFFFF' : '#111827';
  const redColor = '#E01E26';

  // 1. Icon variant (App 1x1 Logo / Icon Badge)
  if (variant === 'icon') {
    const iconSrc = (!img1x1Failed && brandLogos.logo1x1) || (!imgMainFailed && brandLogos.logoMain);
    if (iconSrc) {
      return (
        <div
          style={!isResponsive ? { height: `${h}px`, width: `${h}px` } : undefined}
          className={`shrink-0 flex items-center justify-center overflow-hidden rounded-xl select-none drop-shadow-xs ${
            isResponsive ? 'h-8 w-8 sm:h-9 sm:w-9' : ''
          } ${className}`}
        >
          <img
            src={iconSrc}
            alt="Lakhi 1x1 App Icon"
            onError={() => {
              if (brandLogos.logo1x1 && iconSrc === brandLogos.logo1x1) setImg1x1Failed(true);
              else setImgMainFailed(true);
            }}
            className="w-full h-full object-contain"
          />
        </div>
      );
    }

    // Default SVG Icon (Circular badge with red quarter arc, lightning bolt, and stylized L)
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
        <circle cx="80" cy="80" r="74" fill={blackColor} />
        <path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill={redColor} />
        <circle cx="50" cy="80" r="27" stroke="#FFFFFF" strokeWidth="5.5" fill="none" />
        <path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="#FFFFFF" />
        <path
          d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 2. Main Logo variant (Graphic Emblem / Symbol)
  if (variant === 'main') {
    const mainSrc = (!imgMainFailed && brandLogos.logoMain) || (!img1x1Failed && brandLogos.logo1x1);
    if (mainSrc) {
      return (
        <div
          style={!isResponsive ? { height: `${h}px` } : undefined}
          className={`shrink-0 flex items-center justify-center overflow-hidden rounded-xl select-none drop-shadow-xs ${
            isResponsive ? 'h-8 sm:h-9 md:h-10 w-auto' : ''
          } ${className}`}
        >
          <img
            src={mainSrc}
            alt="Lakhi Main Logo"
            onError={() => setImgMainFailed(true)}
            className="h-full w-auto max-w-full object-contain"
          />
        </div>
      );
    }

    return (
      <svg
        viewBox="0 0 160 160"
        width={!isResponsive ? h : undefined}
        height={!isResponsive ? h : undefined}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-xs ${isResponsive ? 'h-8 sm:h-9 md:h-10 w-auto' : ''} ${className}`}
        aria-label="Lakhi Main Emblem"
      >
        <circle cx="80" cy="80" r="74" fill={blackColor} />
        <path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill={redColor} />
        <circle cx="50" cy="80" r="27" stroke="#FFFFFF" strokeWidth="5.5" fill="none" />
        <path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="#FFFFFF" />
        <path
          d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 3. Auto variant (Mobile: Icon, Desktop: Full with Wordmark)
  if (variant === 'auto') {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        {/* Mobile View: Icon */}
        <div className="sm:hidden">
          <LakhiLogo size={size} variant="icon" themeInvert={themeInvert} />
        </div>
        {/* Desktop View: Full Banner with Wordmark */}
        <div className="hidden sm:block">
          <LakhiLogo size={size} variant="full" themeInvert={themeInvert} />
        </div>
      </div>
    );
  }

  // 4. Full variant (Main Logo with word "Lakhi")
  if (!imgWordmarkFailed && brandLogos.logoWithWordmark) {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <img
          src={brandLogos.logoWithWordmark}
          alt="Lakhi Airconditioners"
          onError={() => setImgWordmarkFailed(true)}
          style={!isResponsive ? { height: `${h}px` } : undefined}
          className={`${
            isResponsive ? 'h-7 sm:h-9 md:h-10' : ''
          } w-auto object-contain select-none drop-shadow-xs`}
        />
      </div>
    );
  }

  // If user only customized the main logo (or 1x1 logo), show it alongside crisp text wordmark
  if ((!imgMainFailed && brandLogos.logoMain) || (!img1x1Failed && brandLogos.logo1x1)) {
    const emblemSrc = (!imgMainFailed && brandLogos.logoMain) || brandLogos.logo1x1;
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <img
          src={emblemSrc}
          alt="Lakhi Logo"
          style={!isResponsive ? { height: `${h}px`, width: `${h}px` } : undefined}
          className={`shrink-0 object-contain rounded-xl drop-shadow-xs ${
            isResponsive ? 'h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10' : ''
          }`}
        />
        <div className="flex flex-col leading-none">
          <span className="font-black text-base sm:text-lg md:text-xl tracking-tight text-slate-900 dark:text-white">
            LAKHI
          </span>
          <span className="font-black text-[9px] sm:text-[10px] md:text-xs tracking-wider text-red-600 dark:text-red-500 italic">
            AIRCONDITIONERS
          </span>
        </div>
      </div>
    );
  }

  // If user placed custom logo in /public/logo.png
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

  // Default Vector SVG Logo with Wordmark
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
          <path d="M 75 7 A 68 68 0 0 1 143 75 L 75 75 Z" fill={redColor} />
          <circle cx="48" cy="75" r="26" stroke="#FFFFFF" strokeWidth="5" fill="none" />
          <path d="M 50 56 L 39 77 L 48 77 L 45 96 L 58 73 L 49 73 Z" fill="#FFFFFF" />
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
