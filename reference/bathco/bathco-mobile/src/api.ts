// Read-only API client for the existing Express/PostgreSQL dashboard backend.
// Session-cookie auth: /api/login sets a cookie, which fetch stores automatically
// via `credentials: 'include'` on native (React Native's fetch supports cookies
// per-origin out of the box).

// On a phone, "localhost" means the phone itself — point at this PC's LAN IP
// instead so the app can reach the dashboard server over WiFi.
const BASE_URL = 'http://192.168.1.9:3000';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ ok: boolean; user: { id: number; username: string; name: string; role: string } }>(
      '/api/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),
  me: () => request<{ id: number; username: string; name: string; role: string }>('/api/me'),
  homeStats: () => request<HomeStats>('/api/home-stats'),
  recentDays: (limit = 7) => request<DailySummary[]>(`/api/daily-summary?limit=${limit}`),
  dailySummary: (date: string) => request<DailySummary[]>(`/api/daily-summary?date=${date}`),
  staff: () => request<StaffRow[]>('/api/staff'),
  payPeriodSummary: () => request<PayPeriodSummary>('/api/pay-period-summary'),
  dataIndex: () => request<DataIndex>('/DATA_INDEX.json'),
};

export { ApiError };

// ── Types (subset of fields the mobile app uses) ───────────────────────────
export interface HomeStats {
  today: { sale: string; gp: string; np: string; exp: string };
  mtd: { sale: string; gp: string; np: string; exp: string; days: string };
  all_time: { sale: string; gp: string; np: string; days: string };
  unread_alerts: number;
}

export interface DailySummary {
  report_date: string;
  date_str?: string;
  data_tier: 'FULL' | 'CASHFLOW' | 'FOUNDATION';
  total_sale: string;
  gross_profit: string;
  net_profit: string;
  total_expenses: string;
  cash_in_hand: string;
  gp_status: string;
}

export interface StaffRow {
  id: number;
  name: string;
  role: string;
  commission_pct: string;
  total_salary: string;
  total_commission: string;
  total_loans: string;
  outstanding: string;
  active: boolean;
}

export interface PayPeriodSummary {
  from: string;
  to: string;
  total_days: string;
  full_days: string;
  total_sale: string;
  net_profit: string;
}

export type DataDayStatus = 'complete' | 'partial' | 'missing' | 'mismatch';

export interface DataDay {
  transactions_excel: string[];
  expense_photo: string[];
  lasersoft_report: string[];
  status: DataDayStatus;
}

export interface DataIndex {
  generated: string;
  range: { from: string; to: string; total_days: number };
  note: string;
  summary: { complete: number; partial: number; missing: number; mismatch: number };
  days: Record<string, DataDay>;
}
