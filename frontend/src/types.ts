export interface StaffMember {
  name: string;
  username: string;
  password: string;
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
