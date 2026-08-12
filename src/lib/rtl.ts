const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(input: number | string): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatToman(amount: number): string {
  const withSep = amount.toLocaleString("en-US"); // 1,234,567
  return `${toFa(withSep)} تومان`;
}

export function formatPriceCompact(amount: number): string {
  return toFa(amount.toLocaleString("en-US"));
}

export function faDate(iso: string): string {
  try {
    return toFa(
      new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(
        new Date(iso),
      ),
    );
  } catch {
    return toFa(iso.slice(0, 10));
  }
}
