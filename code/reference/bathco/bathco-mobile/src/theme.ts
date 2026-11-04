// BATHCO COMMAND mobile — dark navy/teal/gold theme (distinct from generic blue fintech)
export const colors = {
  bg: '#0a1628',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(212,175,55,0.18)',
  navy: '#0a1628',
  teal: '#1b3a4b',
  gold: '#d4af37',
  gold2: '#f0cf5e',
  mint: '#3ddc97',
  coral: '#ff6b6b',
  muted: '#7f93a8',
  text: '#eef3f7',
};

export const gradients = {
  hero: [colors.navy, colors.teal, '#2a4a3a'] as const,
  card: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] as const,
};

// Tier badge colors — must match dashboard.html TIER_BADGE mapping
export const TIER_COLORS: Record<string, string> = {
  FULL: colors.mint,
  CASHFLOW: '#5dade2',
  FOUNDATION: colors.gold,
};

// DATA_INDEX.json (PART 1) status -> calendar cell color
export const DATA_STATUS_COLORS: Record<string, string> = {
  complete: colors.mint,
  partial: colors.gold,
  missing: colors.coral,
  mismatch: colors.coral,
};

export const radius = 16;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
