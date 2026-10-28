import type { OrderStatus } from '@/lib/types';

export const TIERS = [
  { name: 'New', min: 0, discount: 0 },
  { name: 'Bronze', min: 50, discount: 1 },
  { name: 'Silver', min: 100, discount: 2 },
  { name: 'Gold', min: 250, discount: 3 },
  { name: 'Platinum', min: 500, discount: 4 },
  { name: 'Diamond', min: 1000, discount: 5 },
  { name: 'Elite', min: 2000, discount: 6 },
  { name: 'Master', min: 5000, discount: 8 },
];

export function tierFor(spent: number) {
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (spent >= t.min) idx = i;
  });
  return { tier: TIERS[idx], next: TIERS[idx + 1] ?? null, index: idx };
}

export const PLATFORMS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'Telegram',
  'Twitter',
  'Spotify',
  'Threads',
  'LinkedIn',
  'Website Traffic',
  'Other',
];

export function guessPlatform(text: string) {
  const t = text.toLowerCase();
  if (t.includes('instagram') || t.includes(' ig ')) return 'Instagram';
  if (t.includes('tiktok')) return 'TikTok';
  if (t.includes('youtube') || t.includes('yt ')) return 'YouTube';
  if (t.includes('facebook') || t.includes('fb ')) return 'Facebook';
  if (t.includes('telegram')) return 'Telegram';
  if (t.includes('twitter') || t.includes(' x ')) return 'Twitter';
  if (t.includes('spotify')) return 'Spotify';
  if (t.includes('threads')) return 'Threads';
  if (t.includes('linkedin')) return 'LinkedIn';
  if (t.includes('traffic') || t.includes('website')) return 'Website Traffic';
  return 'Other';
}

export const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  processing: { label: 'Processing', tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  in_progress: { label: 'In progress', tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  completed: { label: 'Completed', tone: 'bg-brand-500/10 text-brand-700 dark:text-brand-400' },
  partial: { label: 'Partial', tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  canceled: { label: 'Canceled', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function roundTo(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
