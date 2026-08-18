"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor numérico (float) do input */
  value?: number;
  /** Callback executado sempre que o valor altera */
  onChange?: (value: number | undefined) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, onBlur, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>("");

    // Sincroniza o valor externo (numérico) para a string formatada
    React.useEffect(() => {
      if (value === undefined || value === null) {
        setDisplay("");
        return;
      }
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
      setDisplay(formatted);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, ""); // Extrai apenas dígitos
      if (!raw) {
        setDisplay("");
        onChange?.(undefined);
        return;
      }

      const num = parseInt(raw, 10);
      const floatVal = num / 100; // Divide por 100 para ter as duas casas decimais

      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(floatVal);

      setDisplay(formatted);
      onChange?.(floatVal);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 shadow-sm transition-colors placeholder:text-zinc-600 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={display}
        onChange={handleChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
