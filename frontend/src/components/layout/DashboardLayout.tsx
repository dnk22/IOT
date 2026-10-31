import type { PropsWithChildren, ReactNode } from 'react';

interface DashboardLayoutProps extends PropsWithChildren {
  sidebar: ReactNode;
}

export function DashboardLayout({ children, sidebar }: DashboardLayoutProps) {
  return (
    <main className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="min-w-0 space-y-4 lg:col-span-8">{children}</div>
      <aside className="min-w-0 space-y-4 lg:col-span-4">{sidebar}</aside>
    </main>
  );
}
