export type AffiliatePartnerStatus = "pending" | "active" | "suspended";
export type AffiliateCommissionStatus = "pending" | "confirmed" | "paid" | "clawback";

export type AffiliatePartner = {
  id: string;
  user_id: string;
  code: string;
  display_name: string;
  bio: string | null;
  status: AffiliatePartnerStatus;
  commission_rate_pct: number;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

export type AffiliateReferral = {
  profile_id: string;
  partner_id: string;
  attributed_at: string;
  flagged_for_review: boolean;
  flag_reason: string | null;
};

export type AffiliateCommission = {
  id: string;
  partner_id: string;
  payment_id: string;
  amount_cents: number;
  status: AffiliateCommissionStatus;
  confirmed_at: string | null;
  paid_at: string | null;
  paid_via: string | null;
  created_at: string;
};

export type PartnerEarnings = {
  signups_total: number;
  signups_active_paying: number;
  mrr_generated_cents: number;
  total_earned_cents: number;
  pending_cents: number;
  payable_cents: number;
  paid_all_time_cents: number;
};
