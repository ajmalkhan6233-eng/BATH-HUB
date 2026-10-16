export interface StaffMember {
  name: string;
  username: string;
  password?: string;
  role?: 'admin' | 'staff' | 'owner';
  salesMonth?: number;
  commissionEarned?: number;
}

export interface SetupPayload {
  company_name: string;
  legal_name: string;
  tagline: string;
  logo_data_url: string | null;
  currency: string;
  currency_symbol: string;
  admin: StaffMember;
  staff: StaffMember[];
}

export interface FeatureFlags {
  pos_billing: boolean;
  inv_barcode_labels: boolean;
  staff_commission_display: boolean;
  ai_assistant_chat: boolean;
  room_visualizer: boolean;
}

export interface DaySummary {
  date: string;
  total_sale: number;
  expenses: number;
  net_profit: number;
  cash_in_hand: number;
  cash_expected: number;
  invoices: number;
  expense_entries: number;
}

export interface HistoryDay {
  date: string;
  sale: number;
  expenses: number;
  net_profit: number;
  status: 'FULL' | 'PENDING' | 'PARTIAL';
}

export interface ProductItem {
  id: string;
  code: string;
  name: string;
  category: 'Tiles' | 'Sanitaryware' | 'Taps & Mixers' | 'Accessories';
  unit: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  dimensions?: string;
  image?: string;
  showOnWebsite?: boolean;
}

export interface ChequeItem {
  id: string;
  chequeNumber: string;
  bankName: string;
  type: 'INWARD' | 'OUTWARD';
  partyName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  clearingDate?: string;
  status: 'PENDING' | 'CLEARED' | 'RETURNED';
  note?: string;
}

export interface CustomerCredit {
  id: string;
  name: string;
  phone: string;
  city: string;
  creditLimit: number;
  currentBalance: number;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90_plus: number;
  status: 'GOOD' | 'ATTENTION' | 'OVERDUE';
}

export interface QuotationItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  customerName: string;
  phone: string;
  date: string;
  validUntil: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED';
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: 'Transport' | 'Staff Lunch' | 'Utility' | 'Packaging' | 'Petty Cash';
  description: string;
  amount: number;
  paidBy: string;
}

export interface LaylaChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestions?: string[];
}
