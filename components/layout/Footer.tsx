'use client';

import React from 'react';
import Link from 'next/link';
import { Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-900 pt-16 pb-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-12">
          
          {/* Brand Col */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 group mb-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-white leading-tight">NyayaSetu</span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-6">
              Report civic issues, see how urgent they are, and track them until they&apos;re fixed.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{t('footer.quickLinks')}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm text-gray-400 hover:text-white transition-colors">{t('footer.aboutUs')}</Link>
              </li>
              <li>
                <Link href="/chat" className="text-sm text-gray-400 hover:text-white transition-colors">{t('nav.chatAssistant')}</Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{t('footer.services')}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/complaints/file" className="text-sm text-slate-400 hover:text-white transition-colors">{t('nav.fileComplaint')}</Link>
              </li>
              <li>
                <Link href="/complaints/track" className="text-sm text-slate-400 hover:text-white transition-colors">{t('nav.trackComplaint')}</Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">{t('nav.officerLogin')}</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} NyayaSetu Civic Tech Prototype. Built with Next.js, Supabase & Groq.
          </p>
        </div>
      </div>
    </footer>
  );
}
