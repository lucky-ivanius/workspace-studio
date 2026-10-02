"use client";

import { MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LONG_STAY_WEEKS } from "../model/catalog";
import { useStudioStore } from "../state/store";
import { formatUsd, formatWeeks, summarize } from "../state/summary";
import { RentSuccessDialog } from "./rent-success-dialog";

/**
 * Rental lengths worth offering, labelled so the tier is readable: everything
 * from LONG_STAY_WEEKS onwards is billed at the cheaper long-stay rate.
 */
const WEEK_OPTIONS = [
  { value: 1, label: formatWeeks(1) },
  { value: 2, label: formatWeeks(2) },
  {
    value: LONG_STAY_WEEKS,
    label: `${formatWeeks(LONG_STAY_WEEKS)} · 1 month`,
  },
  { value: 12, label: `${formatWeeks(12)} · 3 months` },
];

export function SummaryPanel() {
  const items = useStudioStore((state) => state.items);
  const cart = useStudioStore((state) => state.cart);
  const rentalWeeks = useStudioStore((state) => state.rentalWeeks);
  const setRentalWeeks = useStudioStore((state) => state.setRentalWeeks);
  const addToCart = useStudioStore((state) => state.addToCart);
  const removeCopy = useStudioStore((state) => state.removeCopy);
  const clear = useStudioStore((state) => state.clear);

  // Demo checkout: the button has nothing real to call, so it just confirms.
  const [rented, setRented] = useState(false);

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

      <div className="flex-1 overflow-y-auto p-4">
        {summary.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pick a desk to start, then add a chair and whatever else you need.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {summary.lines.map((line) => (
              <li key={line.product.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium">
                    {line.product.name}
                  </p>
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatUsd(line.weeklyTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    {/* Stepping up only ever adds a cart copy, so the room the
                        user arranged is never rearranged behind their back.
                        Stepping down gives those copies back before it touches
                        anything on the canvas. */}
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => removeCopy(line.product.id)}
                      aria-label={`One less ${line.product.name}`}
                    >
                      <MinusIcon />
                    </Button>
                    <output
                      className="w-7 text-center text-sm tabular-nums"
                      aria-label={`${line.product.name} quantity`}
                    >
                      {line.quantity}
                    </output>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => addToCart(line.product.id)}
                      aria-label={`One more ${line.product.name}`}
                    >
                      <PlusIcon />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatUsd(line.ratePerWeek)}/week each
                  </p>
                </div>

                {/* Cart copies are rented but never drawn, so the count that is
                    missing from the canvas is worth saying out loud. */}
                {line.inCart > 0 && (
                  <Badge variant="secondary">
                    <ShoppingCartIcon data-icon="inline-start" />
                    {line.inCart} in cart
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Rental length</span>
          <Select
            items={WEEK_OPTIONS}
            value={rentalWeeks}
            // The select is never cleared, so a null only means "nothing
            // changed" and the current length stands.
            onValueChange={(weeks) => setRentalWeeks(weeks ?? rentalWeeks)}
          >
            <SelectTrigger size="sm" aria-label="Rental length">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEK_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <span>Total for {formatWeeks(summary.weeks)}</span>
          <span className="tabular-nums" data-testid="summary-total">
            {formatUsd(summary.total)}
          </span>
        </div>

        {summary.longStay && summary.itemCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Long-stay rate applied, from {formatWeeks(LONG_STAY_WEEKS)} onwards.
          </p>
        )}

        <Button
          disabled={summary.itemCount === 0}
          onClick={() => setRented(true)}
        >
          Rent this setup
        </Button>
      </div>

      <RentSuccessDialog open={rented} onOpenChange={setRented} />
    </div>
  );
}
