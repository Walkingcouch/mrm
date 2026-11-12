// In-app PDF rendering (brief §4). iOS WKWebView renders PDFs natively with
// zoom and multipage scrolling. Android WebView cannot, so it uses the pdf.js
// viewer hosted on the admin website (/pdf-viewer), which only loads files
// from this project's storage. No external PDF app is launched.
import React from 'react';
import { Platform } from 'react-native';
import { PDF_VIEWER_URL, SAMPLE_MODE } from '@/lib/api';
import { InAppWeb } from './InAppWeb';
import { Notice } from './ui';

export function PdfView({ fileUrl }: { fileUrl: string }) {
  if (Platform.OS === 'ios') {
    return <InAppWeb url={fileUrl} />;
  }
  if (!PDF_VIEWER_URL) {
    // Sample-content test builds only: the project's own viewer is part of the
    // backend set-up, so show the live app's PDFs through Google's viewer meanwhile.
    if (SAMPLE_MODE) return <InAppWeb url={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`} />;
    return <Notice title="Document viewer not configured" />;
  }
  const viewer = `${PDF_VIEWER_URL}?file=${encodeURIComponent(fileUrl)}`;
  return <InAppWeb url={viewer} setBuiltInZoomControls={false} />;
}
