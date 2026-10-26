import type { MetadataRoute } from 'next';

// Lets phones "Add to home screen" so reporting is one tap away.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NyayaSetu: civic issue tracker',
    short_name: 'NyayaSetu',
    description: 'Report civic issues, see their priority, and track them until they are fixed.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4338ca',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
