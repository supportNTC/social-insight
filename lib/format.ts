export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatSignedPercent(deltaPct: number): string {
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}
