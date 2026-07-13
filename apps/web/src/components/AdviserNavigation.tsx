import type { AdviserView } from "../domain/adviserViews.js";

type NavigationItem = {
  id: AdviserView;
  label: string;
};

type AdviserNavigationProps = {
  activeView: AdviserView;
  onChange: (view: AdviserView) => void;
};

const navigationItems: readonly NavigationItem[] = [
  { id: "dashboard", label: "Overview" },
  { id: "my-actions", label: "My Actions" },
  { id: "client-reviews", label: "Client Reviews" }
];

const isNavigationItemActive = (activeView: AdviserView, itemId: AdviserView) =>
  activeView === itemId ||
  (itemId === "client-reviews" && activeView === "client-review");

export const AdviserNavigation = ({
  activeView,
  onChange
}: AdviserNavigationProps) => (
  <aside className="app-sidebar">
    <div className="flex h-full flex-col px-4 py-4">
      <div>
        <div>
          <div className="text-base font-semibold">Adviser Review Copilot</div>
          <div className="mt-1 text-xs font-medium text-[var(--sidebar-muted)]">
            Review workspace
          </div>
        </div>
      </div>
      <nav className="mt-4 lg:mt-8" aria-label="Primary adviser views">
        <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navigationItems.map((item) => {
            const isActive = isNavigationItemActive(activeView, item.id);

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`focus-ring flex min-w-fit items-center justify-between rounded px-3 py-2 text-left text-sm font-semibold transition lg:w-full ${
                  isActive
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-white"
                }`}
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
              >
                <span>{item.label}</span>
                {isActive ? (
                  <span className="ml-3 hidden h-2 w-2 rounded-full bg-[var(--accent)] lg:inline-block" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="mt-auto hidden border-t border-white/10 pt-4 text-xs text-[var(--sidebar-muted)] lg:block">
        <div className="font-semibold text-white">Jordan Bennett</div>
        <div className="mt-1">Adviser workspace</div>
      </div>
    </div>
  </aside>
);
