/** What someone typed in an amount box, kept to digits, one dot and cents. "1.2.3" → "1.23", "12.345" → "12.34". */
export function cleanAmount(raw: string, decimals = 2): string {
  const s = raw.replace(/[^0-9.]/g, ""); // "$1,000" → "1000"
  const dot = s.indexOf(".");
  if (dot === -1) return s.replace(/^0+(?=\d)/, "");
  const whole = s.slice(0, dot).replace(/^0+(?=\d)/, "");
  const frac = s.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  return `${whole || "0"}.${frac}`;
}

/** Digits to show for an amount: whole dollars stay whole, anything else shows cents. */
export const amountDigits = (v: number) => (Number.isInteger(v) ? 0 : 2);
