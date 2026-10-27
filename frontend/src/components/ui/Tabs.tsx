"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { createContext, useContext, type ComponentProps } from "react";
import { trackClass, trackItemClass } from "./Segmented";
import { cx } from "./cx";

// "track": abas em trilho, como Chegadas e Saídas no Hoje. "line": sublinhadas, como as abas da reserva aberta.
export type TabsVariant = "track" | "line";

const VariantContext = createContext<TabsVariant>("track");

const lineListClass = "flex gap-0.5 border-b border-rule";
const lineItemClass =
  "inline-flex h-10 items-center gap-1.5 px-2.5 text-[13px] text-fg-2 transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:font-semibold data-[state=active]:text-fg data-[state=active]:shadow-[inset_0_-2px_0_var(--fg)]";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ variant = "track", className, ...props }: ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.List className={cx(variant === "track" ? trackClass : lineListClass, className)} {...props} />
    </VariantContext.Provider>
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = useContext(VariantContext);
  return <TabsPrimitive.Trigger className={cx(variant === "track" ? trackItemClass : lineItemClass, className)} {...props} />;
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cx("min-h-0", className)} {...props} />;
}
