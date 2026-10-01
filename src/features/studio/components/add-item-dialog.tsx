"use client";

import { cn } from "cn";
import { InfoIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CATALOG_ITEMS,
  type CatalogCategory,
  type CatalogItem,
  categoriesOf,
  DESK_ITEMS,
  itemsIn,
  type RentalProduct,
  searchItems,
} from "../model/catalog";
import { useStudioStore } from "../state/store";
import { formatUsd } from "../state/summary";
import { ProductInfoDialog } from "./product-info-dialog";

export function AddItemDialog({
  open,
  onOpenChange,
  /** Narrowed to desk-mounted items when called from a selected desk. */
  deskOnly = false,
  title = "Add to your workspace",
  description = "Pick something to drop into the room.",
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deskOnly?: boolean;
  title?: string;
  description?: string;
  onPick: (productId: string) => void;
}) {
  const allItems = deskOnly ? DESK_ITEMS : CATALOG_ITEMS;

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [infoProduct, setInfoProduct] = useState<RentalProduct | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset filters whenever the dialog opens so it always starts fresh.
  useEffect(() => {
    if (open) {
      setCategoryId(null);
      setQuery("");
    }
  }, [open]);

  // Focus the search box after the open animation.
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // A new filter is a new list, so it opens at the top rather than wherever the
  // last one happened to be left.
  function showFromTop() {
    listRef.current?.scrollTo({ top: 0 });
  }

  function filterBy(id: string | null) {
    setCategoryId(id);
    setQuery("");
    showFromTop();
  }

  /** Search reaches across every category, so picking one is set aside. */
  function search(text: string) {
    setQuery(text);
    if (text) setCategoryId(null);
    showFromTop();
  }

  const searched = useMemo(
    () => searchItems(allItems, query),
    [allItems, query],
  );

  const filtered = useMemo(
    () => itemsIn(searched, query ? null : categoryId),
    [searched, categoryId, query],
  );

  const categories = useMemo(() => categoriesOf(allItems), [allItems]);
  const added = useAddedCounts();

  function pick(productId: string) {
    onPick(productId);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[94dvh] max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5">
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="text-lg font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {description}
              </DialogDescription>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 bg-secondary"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <XIcon />
            </Button>
          </div>

          {/* Search bar */}
          <div className="shrink-0 border-b px-6 py-3">
            <label className="flex items-center gap-2.5 rounded-xl border bg-muted/50 px-3 py-2.5 has-[:focus]:border-ring has-[:focus]:ring-3 has-[:focus]:ring-ring/20 transition-colors">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search products…"
                value={query}
                onChange={(e) => search(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => search("")}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </label>
          </div>

          {/* Body: category rail + product grid */}
          <div className="flex min-h-0 flex-1">
            {/* Category rail */}
            <CategoryRail
              categories={categories}
              active={query ? null : categoryId}
              onSelect={filterBy}
            />

            {/* Product grid */}
            <ScrollArea viewportRef={listRef} className="min-w-0 flex-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-4">
                {filtered.length === 0 ? (
                  <div className="col-span-full flex items-center justify-center py-16 text-sm text-muted-foreground">
                    {query
                      ? `No results for "${query}"`
                      : "Nothing in this category yet."}
                  </div>
                ) : (
                  filtered.map((item) => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      added={added.get(item.id) ?? 0}
                      onAdd={pick}
                      onInfo={
                        item.product
                          ? () => setInfoProduct(item.product)
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <ProductInfoDialog
        product={infoProduct}
        onOpenChange={(open) => {
          if (!open) setInfoProduct(null);
        }}
        onAdd={(productId) => {
          setInfoProduct(null);
          pick(productId);
        }}
      />
    </>
  );
}

/**
 * How many of each catalog item the setup already holds, counting the room and
 * the cart alike. The grid is a hundred-odd cards and the canvas is hidden
 * behind it, so without this a click has nothing to show for itself.
 */
function useAddedCounts(): Map<string, number> {
  const items = useStudioStore((state) => state.items);
  const cart = useStudioStore((state) => state.cart);

  return useMemo(() => {
    const counts = new Map<string, number>();
    const tally = (productId: string, quantity: number) =>
      counts.set(productId, (counts.get(productId) ?? 0) + quantity);

    for (const item of items) tally(item.productId, 1);
    for (const entry of cart) tally(entry.productId, entry.quantity);

    return counts;
  }, [items, cart]);
}

function CategoryRail({
  categories,
  active,
  onSelect,
}: {
  categories: Array<CatalogCategory & { count: number }>;
  active: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r">
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-3">
          <p className="px-3 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Categories
          </p>
          <CategoryButton
            label="All"
            count={null}
            active={active === null}
            onClick={() => onSelect(null)}
          />
          {categories.map((category) => (
            <CategoryButton
              key={category.id}
              label={category.name}
              count={category.count}
              active={active === category.id}
              onClick={() => onSelect(category.id)}
            />
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-foreground hover:bg-muted",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== null && (
        <span
          className={cn(
            "ml-2 shrink-0 text-xs tabular-nums",
            active ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ProductCard({
  item,
  added,
  onAdd,
  onInfo,
}: {
  item: CatalogItem;
  /** How many are already in the setup, in the room or in the cart. */
  added: number;
  onAdd: (productId: string) => void;
  onInfo?: () => void;
}) {
  const price =
    item.pricePerWeek !== null
      ? `${formatUsd(item.pricePerWeek)}/week`
      : "Staging only";

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md">
      {/* Product photo */}
      <div className="relative aspect-square overflow-hidden bg-muted/50">
        {item.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: Strapi images are external, no Next Image available.
          <img
            src={item.imageUrl}
            alt={item.name}
            className="size-full object-contain p-3"
            loading="lazy"
          />
        ) : (
          <div className="size-full" />
        )}

        {item.discountPercent !== null && item.discountPercent > 0 && (
          <Badge className="absolute top-2 left-2 text-xs" variant="default">
            -{item.discountPercent}%
          </Badge>
        )}

        {added > 0 && (
          <Badge className="absolute top-2 right-2 text-xs" variant="secondary">
            {added} added
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <p className="line-clamp-2 text-sm font-medium leading-tight">
            {item.name}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{price}</p>
            {/* Says why the Add button leads to the cart instead of the room. */}
            {!item.placeable && (
              <Badge variant="outline" className="text-xs">
                Cart only
              </Badge>
            )}
          </div>
        </div>

        {/* Actions: "i" + wide "Add" */}
        <div className="mt-auto flex items-center gap-2">
          {onInfo && (
            <Button
              size="icon-sm"
              variant="outline"
              onClick={onInfo}
              aria-label={`Info for ${item.name}`}
            >
              <InfoIcon />
            </Button>
          )}

          <Button
            size="sm"
            className="flex-1"
            onClick={() => onAdd(item.id)}
            aria-label={`Add ${item.name}`}
          >
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
