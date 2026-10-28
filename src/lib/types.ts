export type Profile = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  whatsapp: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  balance: number;
  total_spent: number;
  affiliate_earnings: number;
  api_key: string;
  referred_by: string | null;
  created_at: string;
};

export type Settings = {
  id: number;
  site_name: string;
  bkash_number: string;
  bkash_account_type: string;
  usd_to_bdt: number;
  min_deposit_usd: number;
  affiliate_rate: number;
  whatsapp: string;
  telegram: string;
  support_email: string;
  notice: string;
};

export type Category = {
  id: string;
  name: string;
  platform: string;
  sort_order: number;
  active: boolean;
};

export type Service = {
  id: number;
  category_id: string;
  name: string;
  description: string;
  type: string;
  rate: number;
  min_qty: number;
  max_qty: number;
  refill: boolean;
  cancel: boolean;
  avg_time: string;
  active: boolean;
  sort_order: number;
};

export type ServiceSource = {
  service_id: number;
  provider_id: string;
  provider_service_id: string;
  provider_rate: number;
};

export type OrderStatus = 'pending' | 'processing' | 'in_progress' | 'completed' | 'partial' | 'canceled';

export type Order = {
  id: number;
  user_id: string;
  service_id: number | null;
  service_name: string;
  link: string;
  quantity: number;
  charge: number;
  cost: number;
  provider_id: string | null;
  provider_order_id: string | null;
  status: OrderStatus;
  start_count: number | null;
  remains: number | null;
  refunded: number;
  refill_status: 'none' | 'requested' | 'sent' | 'failed';
  cancel_requested: boolean;
  provider_error: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  method: 'bkash' | 'stripe' | 'admin' | 'affiliate';
  amount_usd: number;
  amount_bdt: number | null;
  trx_id: string | null;
  sender_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  note: string;
  created_at: string;
};

export type Ticket = {
  id: number;
  user_id: string;
  subject: string;
  order_ref: string;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  updated_at: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: number;
  author_id: string;
  from_admin: boolean;
  message: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: 'update' | 'new_service' | 'price' | 'news';
  published: boolean;
  created_at: string;
};

export type Provider = {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  balance: number | null;
  currency: string;
  active: boolean;
  created_at: string;
};
