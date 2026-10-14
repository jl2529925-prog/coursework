export function money(value, currency = "CNY", locale = "en-GB") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

export function currencySymbol(currency = "CNY") {
  return new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value ?? currency;
}

export function readableDate(isoDate, locale = "en-GB") {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return isoDate;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(date);
}

export function periodLabel(period, locale = "en-GB") {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

