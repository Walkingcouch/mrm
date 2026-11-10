// UTC stored; shown in Australia/Darwin (UTC+09:30, no daylight saving).
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function formatDarwin(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 570 * 60_000);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getUTCHours();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${((h + 11) % 12) + 1}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
