import { DaySummary, HistoryDay, FeatureFlags, ProductItem, ChequeItem, CustomerCredit, StaffMember } from './types';

export const branding = {
  company_name: "Royal Bath Hub",
  legal_name: "Royal Bath Hub (Pvt) Ltd",
  tagline: "Tiles, Sanitaryware & Luxury Bathroom Fittings — Thihariya",
  currency: "LKR",
  currency_symbol: "Rs",
  phone: "+94 77 799 9219",
  address: "Kandy Road, Thihariya, Sri Lanka",
  support_contact: {
    name: "Ajmal Khan (Owner Desk)",
    phone: "+94 77 799 9219",
    email: "support@bathhub.lk"
  }
};

export const defaultFeatureFlags: FeatureFlags = {
  pos_billing: true,
  inv_barcode_labels: true,
  staff_commission_display: true,
  ai_assistant_chat: true,
  room_visualizer: true
};

export const currentDay: DaySummary = {
  date: "2026-06-09",
  total_sale: 142500,
  expenses: 32100,
  net_profit: 46800,
  cash_in_hand: 58700,
  cash_expected: 58700,
  invoices: 28,
  expense_entries: 6
};

export const last7Days: HistoryDay[] = [
  { date: "09 Jun", sale: 142500, expenses: 32100, net_profit: 46800, status: "FULL" },
  { date: "08 Jun", sale: 118400, expenses: 24500, net_profit: 32000, status: "PENDING" },
  { date: "07 Jun", sale: 95000, expenses: 18200, net_profit: 26500, status: "FULL" },
  { date: "06 Jun", sale: 168000, expenses: 41000, net_profit: 54200, status: "FULL" },
  { date: "05 Jun", sale: 84000, expenses: 21000, net_profit: 19800, status: "PARTIAL" },
  { date: "04 Jun", sale: 152000, expenses: 35000, net_profit: 48900, status: "FULL" },
  { date: "03 Jun", sale: 104500, expenses: 28000, net_profit: 31200, status: "FULL" }
];

export const initialStaffList: StaffMember[] = [
  { name: "Ajmal Khan", username: "ajmal", role: "owner", salesMonth: 1250000, commissionEarned: 25000 },
  { name: "Fahim Mohamed", username: "fahim", role: "staff", salesMonth: 820000, commissionEarned: 16400 },
  { name: "Ansaf Razak", username: "ansaf", role: "staff", salesMonth: 640000, commissionEarned: 12800 },
  { name: "Nushra Careem", username: "nushra", role: "staff", salesMonth: 490000, commissionEarned: 9800 }
];

export const sampleProducts: ProductItem[] = [
  {
    id: "p1",
    code: "TIL-STN-60",
    name: "Royal Beige Spanish Porcelain Tile",
    category: "Tiles",
    unit: "Sq.Ft",
    cost: 320,
    price: 490,
    stock: 840,
    minStock: 200,
    dimensions: "60cm x 60cm",
    image: "/tiles/stone-beige.webp",
    showOnWebsite: true
  },
  {
    id: "p2",
    code: "TIL-GRY-60",
    name: "Carrara Grey Polished Marble Tile",
    category: "Tiles",
    unit: "Sq.Ft",
    cost: 380,
    price: 580,
    stock: 520,
    minStock: 150,
    dimensions: "60cm x 120cm",
    image: "/tiles/stone-grey.webp",
    showOnWebsite: true
  },
  {
    id: "p3",
    code: "TIL-PNK-30",
    name: "Moroccan Blush Pink Accent Tile",
    category: "Tiles",
    unit: "Sq.Ft",
    cost: 410,
    price: 640,
    stock: 120,
    minStock: 100,
    dimensions: "30cm x 60cm",
    image: "/tiles/stone-pink.webp",
    showOnWebsite: true
  },
  {
    id: "p4",
    code: "SAN-CMD-ECO",
    name: "Ceramic 1-Piece Eco Commode (Dual Flush)",
    category: "Sanitaryware",
    unit: "Unit",
    cost: 26500,
    price: 36500,
    stock: 18,
    minStock: 5,
    showOnWebsite: true
  },
  {
    id: "p5",
    code: "SAN-CMD-LUX",
    name: "Royal Square Rimless Commode Soft-Close",
    category: "Sanitaryware",
    unit: "Unit",
    cost: 39000,
    price: 52900,
    stock: 12,
    minStock: 4,
    showOnWebsite: true
  },
  {
    id: "p6",
    code: "TAP-BSN-BRS",
    name: "Matte Brass Waterfall Basin Mixer Tap",
    category: "Taps & Mixers",
    unit: "Pcs",
    cost: 6500,
    price: 11900,
    stock: 34,
    minStock: 10,
    showOnWebsite: true
  },
  {
    id: "p7",
    code: "SHW-RNF-BLK",
    name: "Matte Black Overhead Thermostatic Rain Shower",
    category: "Taps & Mixers",
    unit: "Set",
    cost: 14500,
    price: 24500,
    stock: 15,
    minStock: 5,
    showOnWebsite: true
  },
  {
    id: "p8",
    code: "ACC-TOW-SET",
    name: "5-Piece Brushed Gold Bathroom Accessory Set",
    category: "Accessories",
    unit: "Set",
    cost: 4800,
    price: 8900,
    stock: 22,
    minStock: 8,
    showOnWebsite: true
  }
];

export const sampleCheques: ChequeItem[] = [
  {
    id: "ch1",
    chequeNumber: "641103",
    bankName: "Commercial Bank",
    type: "INWARD",
    partyName: "Al-Huda Constructions",
    amount: 145000,
    issueDate: "2026-06-01",
    dueDate: "2026-06-12",
    status: "PENDING",
    note: "Tiles for Thihariya Mosque project"
  },
  {
    id: "ch2",
    chequeNumber: "882194",
    bankName: "Hatton National Bank",
    type: "INWARD",
    partyName: "Skyline Developers Kandy",
    amount: 280000,
    issueDate: "2026-05-25",
    dueDate: "2026-06-10",
    status: "PENDING",
    note: "Ceramics package order #892"
  },
  {
    id: "ch3",
    chequeNumber: "391002",
    bankName: "NDB Bank",
    type: "OUTWARD",
    partyName: "Eskema Ceramic (Supplier)",
    amount: 250000,
    issueDate: "2026-06-02",
    dueDate: "2026-06-11",
    status: "PENDING",
    note: "GRN-2026-44 consignment payment"
  },
  {
    id: "ch4",
    chequeNumber: "512998",
    bankName: "Sampath Bank",
    type: "OUTWARD",
    partyName: "RK Trading Co.",
    amount: 185000,
    issueDate: "2026-05-28",
    dueDate: "2026-06-08",
    status: "CLEARED",
    note: "Fittings shipment"
  }
];

export const sampleCustomers: CustomerCredit[] = [
  {
    id: "c1",
    name: "Al-Huda Constructions",
    phone: "0771234567",
    city: "Nittambuwa",
    creditLimit: 500000,
    currentBalance: 245000,
    bucket0_30: 145000,
    bucket31_60: 100000,
    bucket61_90: 0,
    bucket90_plus: 0,
    status: "GOOD"
  },
  {
    id: "c2",
    name: "Skyline Developers",
    phone: "0719876543",
    city: "Kandy Road",
    creditLimit: 750000,
    currentBalance: 420000,
    bucket0_30: 280000,
    bucket31_60: 90000,
    bucket61_90: 50000,
    bucket90_plus: 0,
    status: "ATTENTION"
  },
  {
    id: "c3",
    name: "Perera Interior Designers",
    phone: "0763322110",
    city: "Gampaha",
    creditLimit: 200000,
    currentBalance: 180000,
    bucket0_30: 30000,
    bucket31_60: 40000,
    bucket61_90: 60000,
    bucket90_plus: 50000,
    status: "OVERDUE"
  }
];
