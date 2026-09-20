/**
 * Utility functions for Indonesian Rupiah (IDR) currency formatting & parsing.
 * 
 * Sesuai instruksi:
 * - Nominal harga menggunakan rupiah (Rp).
 * - Saat masuk kolom harga, keyboard perangkat berubah jadi angka (numeric keypad).
 * - Nominal otomatis ada titik setelah setiap 3 angka (pemisah ribuan standar Rupiah).
 */

/**
 * Formats a raw numeric string or digits into Indonesian Rupiah format with dots as thousand separators.
 * Example: "15000000" -> "15.000.000"
 */
export function formatRupiahNumber(value: string | number): string {
  if (value === undefined || value === null) return "";
  const rawDigits = String(value).replace(/\D/g, "");
  if (!rawDigits) return "";

  // Remove leading zeros, unless it is "0"
  const trimmed = rawDigits.replace(/^0+/, "");
  if (!trimmed) return "0";

  // Insert dots every 3 digits from the right
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formats value with full "Rp " prefix and standard dot thousand separators.
 * Example: 15000000 or "15000000" -> "Rp 15.000.000"
 */
export function formatToRupiah(value: string | number): string {
  if (value === undefined || value === null || value === "") return "Rp 0";
  const str = String(value);
  const digits = str.replace(/\D/g, "");
  if (!digits) return "Rp 0";
  return `Rp ${formatRupiahNumber(digits)}`;
}

/**
 * Parses numeric value from a Rupiah string.
 * Example: "15.000.000" or "Rp 15.000.000" -> 15000000
 */
export function parseRupiahNumber(value: string): number {
  if (!value) return 0;
  const digits = String(value).replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Converts integer number to Indonesian words (Terbilang).
 * Example: 15000000 -> "Lima Belas Juta Rupiah"
 */
export function rupiahToTerbilang(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "";

  const satuan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  function bilang(n: number): string {
    if (n < 12) return satuan[n];
    if (n < 20) return bilang(n - 10) + " Belas";
    if (n < 100) return bilang(Math.floor(n / 10)) + " Puluh " + bilang(n % 10);
    if (n < 200) return "Seratus " + bilang(n - 100);
    if (n < 1000) return bilang(Math.floor(n / 100)) + " Ratus " + bilang(n % 100);
    if (n < 2000) return "Seribu " + bilang(n - 1000);
    if (n < 1000000) return bilang(Math.floor(n / 1000)) + " Ribu " + bilang(n % 1000);
    if (n < 1000000000) return bilang(Math.floor(n / 1000000)) + " Juta " + bilang(n % 1000000);
    if (n < 1000000000000)
      return bilang(Math.floor(n / 1000000000)) + " Miliar " + bilang(n % 1000000000);
    return bilang(Math.floor(n / 1000000000000)) + " Triliun " + bilang(n % 1000000000000);
  }

  const result = bilang(num).replace(/\s+/g, " ").trim();
  return result ? `${result} Rupiah` : "";
}
