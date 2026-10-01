"use client";

import { cn } from "cn";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { RentalProduct } from "../model/catalog";
import { fromPricePerWeek, getCategory } from "../model/catalog";
import { formatUsd } from "../state/summary";

/**
 * The spec sheet behind the "i" on a product card: gallery, the pitch, what the
 * rate buys, what is in the box, and the full spec table.
 */
export function ProductInfoDialog({
  product,
  onOpenChange,
  onAdd,
}: {
  /** The product to describe, or null when the dialog is closed. */
  product: RentalProduct | null;
  onOpenChange: (open: boolean) => void;
  onAdd: (productId: string) => void;
}) {
  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {product && <ProductInfo product={product} onAdd={onAdd} />}
      </DialogContent>
    </Dialog>
  );
}

function ProductInfo({
  product,
  onAdd,
}: {
  product: RentalProduct;
  onAdd: (productId: string) => void;
}) {
  const rate = fromPricePerWeek(product);

  return (
    <div className="flex max-h-[90dvh] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Keyed so a new product starts on its own first photograph. */}
          <Gallery key={product.id} product={product} />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {/* pr-10 keeps the title clear of the close button. */}
              <DialogTitle className="pr-10 text-xl leading-tight font-semibold">
                {product.name}
              </DialogTitle>

              <div className="flex flex-wrap items-center gap-1.5">
                {product.brand && (
                  <Badge variant="secondary">{product.brand}</Badge>
                )}
                {product.categoryIds.map((id) => {
                  const category = getCategory(id);
                  return category ? (
                    <Badge key={id} variant="outline">
                      {category.name}
                    </Badge>
                  ) : null;
                })}
              </div>

              {product.summary && (
                <DialogDescription className="text-sm">
                  {product.summary}
                </DialogDescription>
              )}
            </div>

            <Separator />

            <Pricing product={product} />

            {product.included.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">What's included</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {product.included.map((entry) => (
                    <li key={entry}>
                      <Badge variant="secondary">{entry}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {(product.description || product.specs.length > 0) && (
          <div className="grid gap-6 px-6 pb-6 sm:grid-cols-2">
            {product.description && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">About</h3>
                {product.description.split("\n\n").map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-sm text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            )}

            {product.specs.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Specifications</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {product.specs.map((spec) => (
                    <div key={spec.label} className="contents">
                      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {spec.label}
                      </dt>
                      <dd>{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-popover p-4">
        <a
          href={product.productUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          View on monis.rent
          <ExternalLinkIcon className="size-3.5" />
        </a>

        <Button onClick={() => onAdd(product.id)}>
          <PlusIcon data-icon="inline-start" />
          Add for {formatUsd(rate)}/week
        </Button>
      </div>
    </div>
  );
}

function Gallery({ product }: { product: RentalProduct }) {
  const [index, setIndex] = useState(0);

  const active = product.images[index] ?? product.images[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-muted">
        {/* biome-ignore lint/performance/noImgElement: Strapi uploads are remote and unoptimised. */}
        <img
          src={active.url}
          alt={active.alt || product.name}
          className="aspect-square w-full object-contain"
        />
      </div>

      {product.images.length > 1 && (
        <ul className="flex flex-wrap gap-2">
          {product.images.map((image, position) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Show image ${position + 1}`}
                aria-current={position === index}
                className={cn(
                  "size-14 overflow-hidden rounded-xl border bg-muted transition-colors",
                  position === index
                    ? "border-primary ring-2 ring-primary/30"
                    : "hover:border-foreground/30",
                )}
              >
                {/* biome-ignore lint/performance/noImgElement: Strapi uploads are remote and unoptimised. */}
                <img
                  src={image.thumbnailUrl}
                  alt=""
                  className="size-full object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pricing({ product }: { product: RentalProduct }) {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Under a month",
      value: `${formatUsd(product.pricePerWeek)}/week`,
    },
  ];

  if (product.longStayPricePerWeek !== null) {
    rows.push({
      label: "Over a month",
      value: `${formatUsd(product.longStayPricePerWeek)}/week`,
    });
  }
  if (product.monthlyPrice !== null) {
    rows.push({ label: "Monthly", value: formatUsd(product.monthlyPrice) });
  }
  if (product.securityDeposit !== null) {
    rows.push({
      label: "Refundable deposit",
      value: formatUsd(product.securityDeposit),
    });
  }
  if (product.setupCost !== null) {
    rows.push({ label: "Setup", value: formatUsd(product.setupCost) });
  }

  return (
    <dl className="flex flex-col gap-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
