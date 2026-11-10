import React from 'react';
import { Notice } from './ui';
import { InAppWeb } from './InAppWeb';

/** Flight Tracker: one fixed, admin-configured URL (FlightAware airport page). */
export function WebSection({ url, title }: { url: string | null; title: string }) {
  if (!url) return <Notice title={`${title} not set up yet`} body="An administrator needs to add the link." />;
  return <InAppWeb url={url} />;
}
