"use client";

import { ShoppingCartIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "../state/store";
import { formatUsd, summarize } from "../state/summary";

const WEEK_OPTIONS = [1, 2, 4, 12];

export function SummaryPanel() {
  const items = useStudioStore((state) => state.items);
  const cart = useStudioStore((state) => state.cart);
  const rentalWeeks = useStudioStore((state) => state.rentalWeeks);
  const setRentalWeeks = useStudioStore((state) => state.setRentalWeeks);
  const removeFromCart = useStudioStore((state) => state.removeFromCart);
  const clear = useStudioStore((state) => state.clear);

  const summary = useMemo(
    () => summarize(items, cart, rentalWeeks),
    [items, cart, rentalWeeks],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-sm font-semibold">Your setup</h2>
        {summary.itemCount > 0 && (
          <Button variant="ghost" size="xs" onClick={clear}>
            Clear
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b p-4">
        {WEEK_OPTIONS.map((weeks) => (
          <Button
            key={weeks}
            size="xs"
            variant={weeks === rentalWeeks ? "default" : "outline"}
            onClick={() => setRentalWeeks(weeks)}
          >
            {weeks}w
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {summary.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pick a desk to start, then add a chair and whatever else you need.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {summary.lines.map((line) => (
              <li
                key={line.product.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <p className="truncate text-sm font-medium">
                    {line.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {line.quantity} x {formatUsd(line.ratePerWeek)}/week
                  </p>
                  {/* Cart-only copies have no sprite to select, so the only way
                      to drop one is from here. */}
                  {line.inCart > 0 && (
                    <Badge
                      variant="secondary"
                      render={<button type="button" />}
                      onClick={() => removeFromCart(line.product.id)}
                      title="Remove one from the cart"
                    >
                      <ShoppingCartIcon data-icon="inline-start" />
                      {line.inCart} in cart
                    </Badge>
                  )}
                </div>
                <span className="text-sm tabular-nums">
                  {formatUsd(line.weeklyTotal)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Per week</span>
          <span className="tabular-nums" data-testid="summary-per-week">
            {formatUsd(summary.perWeek)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Refundable deposit</span>
          <span className="tabular-nums" data-testid="summary-deposit">
            {formatUsd(summary.deposit)}
          </span>
        </div>
        <div className="flex justify-between border-t pt-3 text-sm font-semibold">
          <span>Total for {summary.weeks} weeks</span>
          <span className="tabular-nums" data-testid="summary-total">
            {formatUsd(summary.total)}
          </span>
        </div>

        <Button disabled={summary.itemCount === 0}>Rent this setup</Button>
      </div>
    </div>
  );
}
