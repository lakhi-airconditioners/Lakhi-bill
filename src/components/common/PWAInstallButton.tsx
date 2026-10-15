import React, { useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If already running in standalone installed app mode, hide
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    // If browser supports native beforeinstallprompt, trigger it directly
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setIsModalOpen(true);
      }
    } else {
      // Otherwise open the guided browser installation instructions (Chrome, Edge, Safari)
      setIsModalOpen(true);
    }
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center justify-center p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs transition-transform active:scale-95 ${className}`}
          title="Install as Web App (Chrome, Edge, Safari)"
          aria-label="Install as Web App"
        >
          <Download className="w-4 h-4 animate-bounce" />
        </button>
        <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  if (variant === 'full') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-red-600/30 transition-all hover:scale-102 active:scale-98 ${className}`}
          title="Install Lakhi Airconditioners as Web App"
        >
          <Download className="w-4 h-4 animate-bounce" />
          <span>Install Web App (Desktop / Mobile)</span>
        </button>
        <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  // Default 'header' variant
  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold bg-linear-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-xs shadow-red-500/20 transition-all hover:scale-105 active:scale-95 shrink-0 border border-red-500/30 ${className}`}
        title="Download & Install as App in Chrome, Edge, Safari or Android"
        aria-label="Install App"
      >
        <Download className="w-3.5 h-3.5 animate-bounce shrink-0 text-amber-200" />
        <span className="hidden md:inline">Install App</span>
        <span className="md:hidden text-[10px] sm:text-xs">Install</span>
      </button>

      <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
