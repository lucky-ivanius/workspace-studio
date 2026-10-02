"use client";

import { CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The demo checkout confirmation: shown after "Rent this setup" is clicked.
 * Nothing is actually charged; the dialog just closes like the real thing.
 */
export function RentSuccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <CircleCheckIcon className="size-6" />
          </span>

          <DialogTitle className="text-lg">Rental confirmed</DialogTitle>

          <DialogDescription>
            Your setup is booked and on its way. A confirmation email with
            delivery details is heading to your inbox.
          </DialogDescription>
        </div>

        <DialogFooter className="w-full">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
