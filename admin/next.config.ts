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
    ];
  },
};

export default nextConfig;
