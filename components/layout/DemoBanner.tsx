'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle as AlertTriangleIcon, X as XIcon, ExternalLink as ExternalLinkIcon } from 'lucide-react';

export default function DemoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show if we're in development OR an explicit demo mode flag is set
    const isDemo = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    const isDismissed = localStorage.getItem('nyayasetu_demo_dismissed') === 'true';
    
    if (isDemo && !isDismissed) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('nyayasetu_demo_dismissed', 'true');
  };

  return (
    <div className="bg-indigo-600 top-0 left-0 w-full z-[100] text-white overflow-hidden shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
        <div className="flex w-0 flex-1 flex-wrap items-center">
          <span className="flex items-center justify-center rounded-lg bg-indigo-800 p-1">
             <AlertTriangleIcon className="w-4 h-4 text-white" />
          </span>
          <p className="ml-3 truncate font-medium text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-bold">NyayaSetu Demo — Not an official government portal.</span>
            <span className="opacity-90">Officer login: officer@nyayasetu.in / Officer@123</span>
          </p>
        </div>
        <div className="order-3 mt-2 flex w-full flex-shrink-0 sm:order-2 sm:mt-0 sm:w-auto items-center gap-3">
          <a
            href="https://github.com/Aarav241020/Nyayasetu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-md border border-transparent bg-white px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            Learn more <ExternalLinkIcon className="w-3 h-3 ml-1" />
          </a>
        </div>
        <div className="order-2 flex flex-shrink-0 sm:order-3 sm:ml-2">
          <button
            type="button"
            className="-mr-1 flex rounded-md p-1 hover:bg-indigo-500 focus:outline-none"
            onClick={handleDismiss}
          >
            <span className="sr-only">Dismiss</span>
            <XIcon className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
