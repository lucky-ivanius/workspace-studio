"use client";

import { Button } from "@/components/ui/button";
import { DECOR, fromPricePerWeek, PRODUCTS } from "../model/catalog";
import type { ProductCategory } from "../model/types";
import { useStudioStore } from "../state/store";
import { formatUsd } from "../state/summary";

const GROUPS: { label: string; category: ProductCategory }[] = [
  { label: "Desks", category: "desk" },
  { label: "Chairs", category: "chair" },
  { label: "Monitors", category: "monitor" },
  { label: "Lighting", category: "lighting" },
  { label: "Extras", category: "extras" },
];

export function CatalogPanel() {
  const addProduct = useStudioStore((state) => state.addProduct);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {GROUPS.map((group) => {
        const products = PRODUCTS.filter(
          (product) => product.category === group.category,
        );
        if (products.length === 0) return null;

        return (
          <section key={group.category} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h2>
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className="flex flex-col items-start gap-0.5 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="text-sm font-medium">{product.name}</span>
                <span className="text-xs text-muted-foreground">
                  from {formatUsd(fromPricePerWeek(product))}/week
                </span>
              </button>
            ))}
          </section>
        );
      })}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Staging
        </h2>
        <p className="text-xs text-muted-foreground">
          Sets the scene. Not part of the rental.
        </p>
        <div className="flex flex-wrap gap-2">
          {DECOR.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              onClick={() => addProduct(item.id)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
