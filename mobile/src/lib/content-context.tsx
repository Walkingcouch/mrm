import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadContent, publicFileUrl, type ContentSnapshot, type Section } from './api';
import { syncCache } from './pdf-cache';

/** Every PDF in the menu, in menu order (sections first, then position). */
function menuPdfUrls(s: ContentSnapshot): string[] {
  return s.entries
    .filter((e) => e.kind === 'pdf' && e.file_path)
    .sort((a, b) => a.position - b.position)
    .map((e) => publicFileUrl('content', e.file_path!));
}

// Fallback menu so navigation renders before the first fetch (and offline on
// first launch). Labels/order match the agreed initial menu.
const FALLBACK: Section[] = [
  ['home', 'Home', 'home'], ['flight', 'Flight Tracker', 'web'], ['timetables', 'Timetables', 'list'],
  ['weather', 'Weather', 'weather'], ['messages', 'Employee Messages', 'messages'], ['village', 'MRM Village', 'list'],
  ['wellbeing', 'Wellbeing', 'list'], ['hr', 'HR & Payroll', 'list'], ['memorandum', 'Memorandum', 'list'],
  ['report', 'Report & Fix It', 'web'], ['call', 'Call Us', 'list'], ['find', 'Find Us', 'list'], ['settings', 'Settings', 'settings'],
].map(([key, label, t], i) => ({
  id: key, key, label, position: (i + 1) * 10, section_type: t as Section['section_type'],
  sort_mode: key === 'memorandum' ? 'newest_first' : 'manual', url: null, widget_html: null,
}));

interface Ctx {
  snapshot: ContentSnapshot | null;
  sections: Section[];
  error: boolean;
  loading: boolean;
  refresh(): Promise<void>;
}

const ContentContext = createContext<Ctx | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (inflight.current) return inflight.current;
    setLoading(true);
    inflight.current = loadContent()
      .then((s) => {
        setSnapshot(s); setError(s.fromCache);
        // Preload documents once the menu is on screen. Only a fresh menu can
        // say what is no longer needed, so an offline (cached) menu skips this.
        if (!s.fromCache) setTimeout(() => { syncCache(menuPdfUrls(s)); }, 3000);
      })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); inflight.current = null; });
    return inflight.current;
  }, []);

  useEffect(() => {
    refresh();
    // Content (not messages) refreshes silently when the app returns to the
    // foreground so replaced documents/links appear without a reinstall.
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const sections = (snapshot?.sections.length ? snapshot.sections : FALLBACK)
    .slice().sort((a, b) => a.position - b.position);

  return <ContentContext.Provider value={{ snapshot, sections, error, loading, refresh }}>{children}</ContentContext.Provider>;
}

export function useContent(): Ctx {
  const c = useContext(ContentContext);
  if (!c) throw new Error('useContent outside ContentProvider');
  return c;
}
