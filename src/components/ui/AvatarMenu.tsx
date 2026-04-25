"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

export function AvatarMenu({
  email,
  avatarUrl,
  logoutAction,
}: {
  email: string;
  avatarUrl: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Menu do usuário"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-full ring-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <Avatar src={avatarUrl} alt="Sua foto de perfil" size={32} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border bg-bg shadow-prep"
        >
          <p className="truncate px-3 py-2 text-xs text-text-tertiary">{email}</p>
          <hr className="border-border" />
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-text-primary hover:bg-line"
          >
            Meu perfil
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-line"
            >
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
