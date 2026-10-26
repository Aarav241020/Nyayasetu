import { redirect } from 'next/navigation';

// Old tracking links now open the public issue page.
export default function LegacyTrackPage({ params }: { params: { uid: string } }) {
  redirect(`/issues/${params.uid}`);
}
