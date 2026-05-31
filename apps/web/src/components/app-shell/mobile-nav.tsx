'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NavLinks, SidebarBrand } from './sidebar';

/**
 * Mobile-only navigation: a hamburger button (rendered inline in the topbar)
 * that toggles a left slide-in drawer overlay with a backdrop. The same NAV
 * links from the desktop sidebar are reused via <NavLinks />.
 *
 * Visible only below the `md` breakpoint (`md:hidden`); on desktop the static
 * <Sidebar /> handles navigation instead.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Close the drawer on route change (covers any nav that bypasses link onClick).
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="p-2 -ml-2 hover:bg-neutral-100"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden={!open}
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed inset-y-0 left-0 z-[70] flex w-[240px] max-w-[80vw] flex-col bg-[var(--color-ink)] text-white transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <SidebarBrand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="p-1 text-neutral-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
        <div className="border-t border-white/10 px-5 py-4 font-mono text-[10px] text-neutral-500">
          v2.0.0 · 2026
        </div>
      </aside>
    </div>
  );
}
