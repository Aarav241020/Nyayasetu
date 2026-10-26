'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Loader2, FileSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function TrackSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [uid, setUid] = useState(searchParams.get('uid') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleSearch = useCallback(async (searchUid: string) => {
    const trimmed = searchUid.trim().toUpperCase();
    if (!trimmed) {
      setError(t('complaints.enterId', { defaultValue: 'Please enter a Complaint ID.' }));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/complaints/track/${trimmed}`);
      const data = await res.json();

      if (data.success) {
        router.push(`/issues/${trimmed}`);
      } else {
        setError(data.message || t('complaints.notFound', { defaultValue: 'Complaint not found.' }));
      }
    } catch {
      setError(t('complaints.networkError', { defaultValue: 'Network error. Please try again.' }));
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Auto-search on load if ?uid= is present
  useEffect(() => {
    const paramUid = searchParams.get('uid');
    if (paramUid) {
      setUid(paramUid);
      handleSearch(paramUid);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSearch className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('complaints.trackTitle', { defaultValue: 'Track Your Complaint' })}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('complaints.trackSubtitle', { defaultValue: 'Enter your Complaint ID to check its current status' })}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="track-uid" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('complaints.id', { defaultValue: 'Complaint ID' })}
              </label>
              <input
                id="track-uid"
                type="text"
                value={uid}
                onChange={(e) => { setUid(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(uid); }}
                placeholder={t('complaints.idPlaceholder', { defaultValue: 'e.g. NYC-20260325-00042' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 outline-none
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all
                  text-gray-900 font-mono text-center text-lg tracking-wider placeholder-gray-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button
              onClick={() => handleSearch(uid)}
              disabled={loading || !uid.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                bg-indigo-600 text-white font-medium hover:bg-indigo-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t('complaints.btnTrack', { defaultValue: 'Track Complaint' })}
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          {t('complaints.trackHelp', { defaultValue: 'Your Complaint ID was given when you filed the complaint (format: NYC-XXXXXXXX-XXXXX)' })}
        </p>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    }>
      <TrackSearchContent />
    </Suspense>
  );
}
