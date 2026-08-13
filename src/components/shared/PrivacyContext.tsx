"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface PrivacyContextType {
  isPrivate: boolean;
  togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("finfamily_privacy");
    if (stored === "true") {
      setIsPrivate(true);
    }
    setMounted(true);
  }, []);

  const togglePrivacy = () => {
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    localStorage.setItem("finfamily_privacy", String(newVal));
  };

  return (
    <PrivacyContext.Provider value={{ isPrivate: mounted ? isPrivate : false, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error("usePrivacy must be used within a PrivacyProvider");
  }
  return context;
}
