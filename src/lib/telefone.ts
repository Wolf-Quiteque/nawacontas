/** Números de telemóvel de Angola: 9 dígitos começados por 9 (ex.: 932 876 178). */

/** Extrai até 9 dígitos, removendo o indicativo +244 / 00244 se existir. */
export function digitosTelefone(entrada: string): string {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.startsWith("00244")) d = d.slice(5);
  else if (d.startsWith("244") && d.length > 9) d = d.slice(3);
  return d.slice(0, 9);
}

/** Devolve os 9 dígitos do número, ou `null` se não for um telemóvel angolano válido. */
export function normalizarTelefone(entrada: string): string | null {
  const d = digitosTelefone(entrada);
  return /^9\d{8}$/.test(d) ? d : null;
}

/** "932876178" → "932 876 178" */
export function formatarTelefone(entrada: string): string {
  const d = digitosTelefone(entrada);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(" ");
}
