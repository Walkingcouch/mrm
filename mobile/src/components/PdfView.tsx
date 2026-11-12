// In-app PDF rendering (brief §4). iOS WKWebView renders PDFs natively with
// zoom and multipage scrolling. Android WebView cannot, so it uses the pdf.js
// viewer hosted on the admin website (/pdf-viewer), which only loads files
// from this project's storage. No external PDF app is launched.
//
// Cached copies (lib/pdf-cache.ts) open instantly and work without signal:
// iOS shows the local file directly; on Android the app hands the cached bytes
// to the viewer, so only the small viewer page itself comes from the network
// (or from the web view's own cache when offline).
import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { WebView } from 'react-native-webview';
type WebViewHandle = React.ComponentRef<typeof WebView>;
import * as Network from 'expo-network';
import { PDF_VIEWER_URL, SAMPLE_MODE } from '@/lib/api';
import { cacheDirUri, cacheOnView, getCached } from '@/lib/pdf-cache';
import { InAppWeb } from './InAppWeb';
import { Loading, Notice } from './ui';

// Bytes cross the native bridge as base64, so very large files load from the URL instead.
const ANDROID_LOCAL_MAX = 15 * 1024 * 1024;

type Local = { uri: string; size: number; file: Awaited<ReturnType<typeof getCached>> };

export function PdfView({ fileUrl }: { fileUrl: string }) {
  const [local, setLocal] = useState<Local | null | undefined>(undefined); // undefined = still checking
  const [offline, setOffline] = useState(false);
  const web = useRef<WebViewHandle>(null);

  useEffect(() => {
    let on = true;
    getCached(fileUrl).then((f) => {
      if (!on) return;
      setLocal(f ? { uri: f.uri, size: f.size, file: f } : null);
      if (!f) cacheOnView(fileUrl); // keep it for next time
    });
    Network.getNetworkStateAsync().then((s) => { if (on) setOffline(s.isConnected === false); }).catch(() => {});
    return () => { on = false; };
  }, [fileUrl]);

  if (local === undefined) return <Loading />;

  if (Platform.OS === 'ios') {
    return local
      ? <InAppWeb key="local" url={local.uri} fileDir={cacheDirUri()} fallbackUrl={fileUrl} />
      : <InAppWeb key="remote" url={fileUrl} />;
  }
  if (!PDF_VIEWER_URL) {
    // Sample-content test builds only: the project's own viewer is part of the
    // backend set-up, so show the live app's PDFs through Google's viewer meanwhile.
    if (SAMPLE_MODE) return <InAppWeb url={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`} />;
    return <Notice title="Document viewer not configured" />;
  }

  const useLocal = !!local && local.size <= ANDROID_LOCAL_MAX;
  const viewer = `${PDF_VIEWER_URL}?file=${encodeURIComponent(fileUrl)}${useLocal ? '&local=1' : ''}`;
  return (
    <InAppWeb
      key={useLocal ? 'local' : 'remote'}
      webRef={web}
      url={viewer}
      setBuiltInZoomControls={false}
      // Offline: use the viewer page from the web view's cache (it rarely changes).
      cacheMode={offline && useLocal ? 'LOAD_CACHE_ELSE_NETWORK' : 'LOAD_DEFAULT'}
      onLoadEnd={useLocal ? () => {
        local!.file!.base64().then((b64) => {
          web.current?.injectJavaScript(`window.__mrmPdfData=${JSON.stringify(b64)};window.__mrmLoadPdf&&window.__mrmLoadPdf();true;`);
        }).catch(() => {}); // the viewer falls back to the URL by itself
      } : undefined}
    />
  );
}
