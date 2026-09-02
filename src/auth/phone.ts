export type CountryDial = {
  iso: string;
  name: string;
  dial: string;
  example: string;
};

export const COUNTRY_DIALS: CountryDial[] = [
  { iso: "CN", name: "中国", dial: "86", example: "138 0013 8000" },
  { iso: "HK", name: "香港", dial: "852", example: "9123 4567" },
  { iso: "TW", name: "台湾", dial: "886", example: "912 345 678" },
  { iso: "JP", name: "日本", dial: "81", example: "90 1234 5678" },
  { iso: "US", name: "美国", dial: "1", example: "202 555 0147" },
  { iso: "GB", name: "英国", dial: "44", example: "7400 123456" },
];

export const DEFAULT_DIAL = "86";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatNationalNumber(dial: string, digits: string): string {
  const raw = digitsOnly(digits);
  if (dial === "86") {
    return raw.replace(/(\d{3})(\d{4})(\d{0,4})/, (_, a, b, c) => (c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a));
  }
  if (dial === "1") {
    return raw.replace(/(\d{3})(\d{3})(\d{0,4})/, (_, a, b, c) => (c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a));
  }
  return raw.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function validateNationalNumber(dial: string, national: string): string | null {
  const digits = digitsOnly(national);
  if (!digits) {
    return "Please enter a valid phone number.";
  }
  if (dial === "86") {
    if (!/^1[3-9]\d{9}$/.test(digits)) {
      return "Please enter a valid phone number.";
    }
    return null;
  }
  if (dial === "852") {
    return /^[569]\d{7}$/.test(digits) ? null : "Please enter a valid phone number.";
  }
  if (dial === "886") {
    return /^9\d{8}$/.test(digits) ? null : "Please enter a valid phone number.";
  }
  if (dial === "81") {
    return /^\d{10,11}$/.test(digits) ? null : "Please enter a valid phone number.";
  }
  if (dial === "1") {
    return /^[2-9]\d{9}$/.test(digits) ? null : "Please enter a valid phone number.";
  }
  if (dial === "44") {
    return /^7\d{9}$/.test(digits) ? null : "Please enter a valid phone number.";
  }
  return /^\d{6,15}$/.test(digits) ? null : "Please enter a valid phone number.";
}

export function e164(dial: string, national: string): string {
  return `+${dial}${digitsOnly(national)}`;
}
