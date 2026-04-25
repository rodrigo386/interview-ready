import { AccountSection } from "@/components/profile/AccountSection";
import { BillingHistoryList } from "@/components/billing/BillingHistoryList";

export default function ProfileAccountPage() {
  return <AccountSection billingHistory={<BillingHistoryList />} />;
}
