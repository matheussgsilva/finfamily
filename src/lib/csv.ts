export type CsvCell = string | number | null | undefined;

const BOM = "﻿";
const SEPARATOR = ";";

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const text = String(cell);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Gera CSV no formato que o Excel em pt-BR abre direto: separador ";" (a vírgula
 * é o separador decimal), quebras CRLF e BOM UTF-8 para os acentos.
 */
export function toCsv(rows: CsvCell[][]): string {
  return BOM + rows.map((row) => row.map(escapeCell).join(SEPARATOR)).join("\r\n") + "\r\n";
}

/** Número com vírgula decimal e sem separador de milhar (ex.: -1234,5 → "-1234,50"). */
export function csvNumber(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
