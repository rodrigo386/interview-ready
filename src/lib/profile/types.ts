export type UploadedCvRow = {
  id: string;
  file_name: string;
  display_name: string | null;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export type AiRewriteRow = {
  id: string;            // prep_session id
  company_name: string;
  job_title: string;
  cv_rewrite_status: string;
  updated_at: string;
};

export type UnifiedCv =
  | {
      origin: "upload";
      id: string;
      displayName: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      createdAt: string;
    }
  | {
      origin: "ai";
      prepSessionId: string;
      companyName: string;
      jobTitle: string;
      updatedAt: string;
    };

export type ProfileShellData = {
  id: string;
  email: string;
  fullName: string | null;
  preferredLanguage: "en" | "pt-br" | "es";
  tier: "free" | "pro" | "team";
  prepsUsedThisMonth: number;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  resolvedAvatarUrl: string;
  asaasCustomerId: string | null;
  subscriptionStatus: "active" | "overdue" | "canceled" | "expired" | "none";
  subscriptionRenewsAt: string | null;
  prepCredits: number;
  prepsResetAt: string;
};
