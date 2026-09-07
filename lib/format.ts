export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function formatSignedCompactNumber(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCompactNumber(Math.abs(value))}`;
}

/** For a 0..1 fraction (e.g. share of total) — multiplies by 100. */
export function formatPercent(fraction: number, fractionDigits = 1): string {
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

/** For a value already on a 0..100 percentage scale (e.g. lib/metrics ER, which bakes in ×100) — does NOT re-multiply. */
export function formatPercentValue(percentValue: number, fractionDigits = 1): string {
  return `${percentValue.toFixed(fractionDigits)}%`;
}

export function formatSignedPercent(deltaPct: number): string {
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}

const BANGKOK_TZ = "Asia/Bangkok";

// th-TH defaults to the Buddhist calendar (2569) — forcing gregory keeps Thai
// month names but the same year our data and UI talk about everywhere else.
const dateTimeFormatter = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
  timeZone: BANGKOK_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
  timeZone: BANGKOK_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** e.g. "7 ก.ย. 2026 21:00" — Asia/Bangkok wall-clock time. */
export function formatDateTimeBangkok(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** e.g. "7 ก.ย. 2026" — no time component. */
export function formatDateBangkok(date: Date): string {
  return dateFormatter.format(date);
}
