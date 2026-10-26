'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MapIssue } from '@/components/map/IssuesMap';

const IssuesMap = dynamic(() => import('@/components/map/IssuesMap'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full rounded-xl bg-gray-100 animate-pulse" />,
});

/** Open issues on a map, sized and coloured by priority, so hotspots stand out. */
export default function PriorityHotspots() {
  const [issues, setIssues] = useState<MapIssue[]>([]);
  useEffect(() => {
    fetch('/api/issues?status=open').then((r) => r.json()).then((d) => setIssues(d.issues ?? [])).catch(() => {});
  }, []);
  return <IssuesMap issues={issues} height="h-[420px]" />;
}
