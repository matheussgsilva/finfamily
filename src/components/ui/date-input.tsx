"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DateInputBR — Input de data no formato brasileiro DD/MM/AAAA.
 *
 * Internamente armazena e expõe o valor como string ISO (YYYY-MM-DD)
 * para compatibilidade com react-hook-form e z.coerce.date().
 */

interface DateInputBRProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor no formato ISO: YYYY-MM-DD */
  value?: string;
  /** Callback com o valor no formato ISO: YYYY-MM-DD */
  onChange?: (value: string) => void;
}

function isoToBR(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function brToISO(br: string): string {
  const clean = br.replace(/\D/g, "");
  if (clean.length !== 8) return "";
  const day = clean.slice(0, 2);
  const month = clean.slice(2, 4);
  const year = clean.slice(4, 8);
  return `${year}-${month}-${day}`;
}

function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const DateInputBR = React.forwardRef<HTMLInputElement, DateInputBRProps>(
  ({ className, value, onChange, onBlur, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() => isoToBR(value ?? ""));

    // Sync from external value changes (e.g., form reset)
    React.useEffect(() => {
      setDisplay(isoToBR(value ?? ""));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = applyDateMask(e.target.value);
      setDisplay(masked);

      // Emit ISO value only when complete
      if (masked.length === 10) {
        const iso = brToISO(masked);
        onChange?.(iso);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, validate and emit
      if (display.length === 10) {
        const iso = brToISO(display);
        // Validate the date is real
        const d = new Date(iso);
        if (isNaN(d.getTime())) {
          setDisplay("");
          onChange?.("");
        } else {
          onChange?.(iso);
        }
      } else if (display.length > 0) {
        // Incomplete date — clear
        setDisplay("");
        onChange?.("");
      }
      onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 shadow-sm transition-colors placeholder:text-zinc-600 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);
DateInputBR.displayName = "DateInputBR";

export { DateInputBR };
