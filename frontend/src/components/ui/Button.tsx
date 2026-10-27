import type { ComponentProps } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-fg text-on-dark hover:bg-fg/85",
  accent: "bg-accent text-on-dark hover:bg-accent-700",
  outline: "border border-border bg-surface text-fg hover:bg-bg",
  ghost: "bg-transparent text-fg-2 hover:bg-muted hover:text-fg",
};

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-9 px-3.5 text-sm",
  sm: "min-h-8 px-3 text-[13px]",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Botão só com ícone precisa de aria-label: o ícone não dá nome ao botão.
export default function Button({ variant = "outline", size = "md", type = "button", className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
