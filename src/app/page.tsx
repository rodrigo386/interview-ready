import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { Comparison } from "@/components/landing/Comparison";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhatYouGet } from "@/components/landing/WhatYouGet";
import { Founder } from "@/components/landing/Founder";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default async function LandingPage() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Unauthenticated state — fall through to landing
    user = null;
  }

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <LandingNavbar />
      <main>
        <Hero />
        <Comparison />
        <HowItWorks />
        <WhatYouGet />
        <Founder />
        <FAQ />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
