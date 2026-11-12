import type { NextConfig } from 'next';

// Every admin page is per-user and permission-dependent, so pages render on
// request (no Cache Components / prerendered shells).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/((?!pdf-viewer).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
      {
        // The PDF viewer is loaded by the mobile apps' web views.
        source: '/pdf-viewer/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
      {
        // pdf.js itself (~1.5 MB) changes only with a viewer upgrade: let phones
        // keep it for a day and reuse it for a week while re-checking.
        source: '/pdf-viewer/lib/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;
