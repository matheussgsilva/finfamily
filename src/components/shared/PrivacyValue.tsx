"use client";

import React from "react";
import { usePrivacy } from "./PrivacyContext";
import { cn } from "@/lib/utils";

interface PrivacyValueProps {
  children: React.ReactNode;
  className?: string;
}

export function PrivacyValue({ children, className }: PrivacyValueProps) {
  const { isPrivate } = usePrivacy();

  return (
    <span
      className={cn(
        "transition-all duration-300 ease-in-out inline-block origin-left",
        isPrivate ? "blur-[6px] select-none scale-[0.95] opacity-50" : "blur-0 opacity-100",
        className
      )}
    >
      {children}
    </span>
  );
}
