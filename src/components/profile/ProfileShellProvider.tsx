"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProfileShellData } from "@/lib/profile/types";

const Ctx = createContext<ProfileShellData | null>(null);

export function ProfileShellProvider({
  data,
  children,
}: {
  data: ProfileShellData;
  children: ReactNode;
}) {
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useProfileShell(): ProfileShellData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProfileShell must be used inside ProfileShellProvider");
  return v;
}
