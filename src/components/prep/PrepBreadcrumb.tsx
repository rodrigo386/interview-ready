"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PrepBreadcrumb({ sessionId }: { sessionId: string }) {
  const pathname = usePathname();
  const isOverview = pathname === `/prep/${sessionId}`;

  if (isOverview) {
    return (
      <Link href="/dashboard" className="text-ink-2 hover:text-ink">
        ← Voltar para seus preps
      </Link>
    );
  }

  return (
    <Link href={`/prep/${sessionId}`} className="text-ink-2 hover:text-ink">
      ← Voltar para visão geral
    </Link>
  );
}
