import type { Metadata, Viewport } from 'next';
// Same typeface as the phone app (Montserrat), self-hosted: no third-party font requests.
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'MRM App Admin',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
