import { CatalogPanel } from "./catalog-panel";
import { StudioCanvasLoader } from "./studio-canvas-loader";
import { SummaryPanel } from "./summary-panel";

export function StudioShell() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-baseline gap-3 border-b px-5 py-3">
        <h1 className="text-base font-semibold">Design your workspace</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Add a desk, drag things where you want them, then rent the whole
          setup.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[260px_1fr_300px]">
        <aside className="hidden min-h-0 overflow-hidden rounded-xl border bg-card lg:block">
          <CatalogPanel />
        </aside>

        <main className="min-h-0">
          <StudioCanvasLoader />
        </main>

        <aside className="min-h-0 overflow-hidden rounded-xl border bg-card">
          <SummaryPanel />
        </aside>
      </div>
    </div>
  );
}
