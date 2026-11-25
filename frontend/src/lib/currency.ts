export function normalizeCurrency(currency?: string | null): string {
  return (currency ?? "USD").toUpperCase();
}

function isIndianLocale(locale: string): boolean {
  return locale.toUpperCase().includes("-IN");
}

function isIndianTimeZone(timeZone: string): boolean {
  const normalizedTimeZone = timeZone.trim().toUpperCase();

  return normalizedTimeZone === "ASIA/KOLKATA" || normalizedTimeZone === "ASIA/CALCUTTA";
}

export function detectPreferredCurrency(): string {
  try {
    const { locale = "", timeZone = "" } = Intl.DateTimeFormat().resolvedOptions();

    // Time zone is closer to physical location than browser language preference.
    if (isIndianTimeZone(timeZone) || isIndianLocale(locale)) {
      return "INR";
    }
  } catch {
    // ignore Intl detection errors and continue to navigator-based fallbacks
  }

  if (typeof navigator !== "undefined") {
    const locales = [...(navigator.languages ?? []), navigator.language ?? ""];
    if (locales.some(isIndianLocale)) {
      return "INR";
    }
  }

  return "USD";
}

export function formatMoney(amountMinor: number, currency: string, locale?: string): string {
  const normalizedCurrency = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    }).format(amountMinor / 100);
  } catch {
    return `${normalizedCurrency} ${(amountMinor / 100).toFixed(2)}`;
  }
}
