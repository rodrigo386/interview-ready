import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { AfterScore } from "@/components/landing/AfterScore";
import { WhatIs } from "@/components/landing/WhatIs";
import { UseCases } from "@/components/landing/UseCases";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { PricingChips } from "@/components/landing/PricingChips";
import { Faq } from "@/components/landing/Faq";
import { FeaturedArticles } from "@/components/landing/FeaturedArticles";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SocialProof } from "@/components/landing/SocialProof";
import { ExitIntentPopup } from "@/components/landing/ExitIntentPopup";
import { MobileStickyCta } from "@/components/landing/MobileStickyCta";

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
      <LandingNavbar ctaHref="#analisar" />
      {/* Ordem = funil. O hero é a ferramenta grátis; AfterScore explica o que
          os R$10 destravam enquanto o interesse está no pico; a prova e a
          demonstração vêm em seguida; preço, objeções e CTA fecham.
          FeaturedArticles desceu para depois do CTA final: entre o preço e a
          decisão, um link para o blog manda embora exatamente quem estava
          decidindo. Depois do CTA, ele vira retenção de quem não converteu. */}
      <main className="bg-bg">
        <Hero />
        <AfterScore />
        <SocialProof />
        <HowItWorks />
        <Features />
        <UseCases />
        <WhatIs />
        <PricingChips />
        <Faq />
        <FinalCta />
        <FeaturedArticles />
      </main>
      <LandingFooter />
      {/* Anon-only branch (line above redirects logged-in users to /dashboard) */}
      <ExitIntentPopup />
      <MobileStickyCta />
    </>
  );
}
