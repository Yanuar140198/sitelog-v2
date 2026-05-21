import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { CommandPalette } from '@/components/command-palette';
import { AnnouncementBanner } from '@/components/app-shell/announcement-banner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] grid-rows-[56px_1fr]">
      <Sidebar />
      <Topbar />
      <main className="col-start-2 row-start-2 bg-[var(--color-paper)] overflow-auto">
        <AnnouncementBanner />
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
