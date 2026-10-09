export const money = (n: number, cents = false) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0
  });

export const shortDate = (value: string | number | null | undefined) => {
  if (!value) return 'soon';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(`${value}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};
