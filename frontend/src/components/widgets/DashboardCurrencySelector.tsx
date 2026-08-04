"use client";

import { CurrencySelect } from "@/components/ui/CurrencySelect";

interface DashboardCurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
}

export function DashboardCurrencySelector({ value, onChange }: DashboardCurrencySelectorProps) {
  return (
    <CurrencySelect 
      value={value} 
      onChange={onChange} 
      placeholder="Select currency..." 
      variant="pill"
    />
  );
}

