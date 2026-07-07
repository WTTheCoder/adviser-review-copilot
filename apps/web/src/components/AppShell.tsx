import type { ReactNode } from "react";

type AppShellProps = {
  navigation?: ReactNode;
  children: ReactNode;
};

export const AppShell = ({ navigation = null, children }: AppShellProps) => (
  <main className="app-shell">
    {navigation}
    <div className="app-main">{children}</div>
  </main>
);
