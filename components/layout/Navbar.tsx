'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Globe, LogIn, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/layout/LanguageProvider';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.issueMap'), href: '/issues' },
    { name: t('nav.fileComplaint'), href: '/complaints/file' },
    { name: t('nav.chatAssistant'), href: '/chat' },
    { name: t('nav.stats'), href: '/stats' },
    { name: t('nav.trackComplaint'), href: '/complaints/track' },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-sm border-b border-slate-200 py-3' : 'bg-white border-b border-slate-200 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                NyayaSetu
              </span>
              <span className="text-[10px] font-medium tracking-wide uppercase text-slate-500">
                Civic Services Prototype for Delhi
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-indigo-700 ${
                  pathname === link.href 
                    ? 'text-indigo-700'
                    : 'text-slate-600'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all border-slate-200 text-slate-700 hover:bg-slate-50`}
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'en' ? 'हिं' : 'EN'}
            </button>
            
            <Link
              href="/login"
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}
            >
              <LogIn className="w-4 h-4" />
              {t('nav.login')}
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className={`p-2 rounded-md border border-slate-200 text-slate-700 transition-colors`}
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-md transition-colors text-slate-900`}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white shadow-xl border-b border-gray-100 py-4 px-4 flex flex-col gap-4">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`p-3 rounded-xl text-sm font-medium ${
                  pathname === link.href ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              {t('nav.officerLogin')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
