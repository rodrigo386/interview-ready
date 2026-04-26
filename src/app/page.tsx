import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { UseCases } from "@/components/landing/UseCases";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { PricingChips } from "@/components/landing/PricingChips";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default async function LandingPage() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <Hero />
        <UseCases />
        <HowItWorks />
        <Features />
        <PricingChips />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
