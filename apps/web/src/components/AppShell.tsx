import type { ReactNode } from "react";

type AppShellProps = {
  navigation?: ReactNode;
  children: ReactNode;
};

export const AppShell = ({ navigation = null, children }: AppShellProps) => (
  <main className="min-h-screen bg-stone-50 text-slate-950">
    {navigation}
    {children}
  </main>
);
