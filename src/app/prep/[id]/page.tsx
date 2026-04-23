import type { Metadata } from "next";
import { Tela1Visual } from "@/components/prep/Tela1Visual";

export const metadata: Metadata = {
  title: "Prep — PrepaVaga",
};

export default async function PrepHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Tela1Visual sessionId={id} />;
}
