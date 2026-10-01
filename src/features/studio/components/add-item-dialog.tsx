"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATALOG_GROUPS, type CatalogGroup } from "../model/catalog";
import { formatUsd } from "../state/summary";

export function AddItemDialog({
  open,
  onOpenChange,
  groups = CATALOG_GROUPS,
  title = "Add to your workspace",
  description = "Pick something to drop into the room. Anything that cannot fit goes to your cart instead.",
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Narrowed for the desk menu, which only offers what a desk can hold. */
  groups?: CatalogGroup[];
  title?: string;
  description?: string;
  onPick: (productId: string) => void;
}) {
  const [tab, setTab] = useState(groups[0]?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="w-full justify-start">
            {groups.map((group) => (
              <TabsTrigger key={group.id} value={group.id}>
                {group.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {groups.map((group) => (
            <TabsContent key={group.id} value={group.id}>
              <ScrollArea className="h-80">
                <ItemGroup className="pr-3">
                  {group.entries.map((entry) => (
                    <Item key={entry.id} variant="outline" role="listitem">
                      <ItemContent>
                        <ItemTitle>{entry.name}</ItemTitle>
                        <ItemDescription>
                          {entry.pricePerWeek === null
                            ? "Staging only, never billed."
                            : `from ${formatUsd(entry.pricePerWeek)}/week`}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPick(entry.id)}
                          aria-label={`Add ${entry.name}`}
                        >
                          <PlusIcon data-icon="inline-start" />
                          Add
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
