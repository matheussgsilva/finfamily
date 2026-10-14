export interface OfxTransaction {
  fitId: string;
  date: string; // yyyy-MM-dd
  amount: number; // com sinal: negativo = saída
  description: string;
}

export interface OfxStatement {
  kind: "BANK" | "CREDIT_CARD";
  transactions: OfxTransaction[];
}

/**
 * Decodifica o arquivo respeitando o cabeçalho do OFX. Bancos brasileiros
 * costumam exportar OFX 1.x em windows-1252 (CHARSET:1252); OFX 2.x é XML e
 * declara o encoding no prólogo. Sem declaração útil, tenta UTF-8 e cai para 1252.
 */
export function decodeOfx(buffer: ArrayBuffer): string {
  const head = new TextDecoder("windows-1252").decode(buffer.slice(0, 1024));
  const xmlEncoding = /<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1];
  const charset = /^\s*CHARSET\s*:\s*(\S+)/im.exec(head)?.[1];
  const encoding = /^\s*ENCODING\s*:\s*(\S+)/im.exec(head)?.[1];
  const declared = [xmlEncoding, charset, encoding].map((v) => v?.toLowerCase() ?? "");

  let text: string;
  if (declared.some((v) => v.includes("utf"))) {
    text = new TextDecoder("utf-8").decode(buffer);
  } else if (declared.some((v) => v.includes("1252") || v.includes("8859") || v.includes("latin"))) {
    text = new TextDecoder("windows-1252").decode(buffer);
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
  }
  return text.replace(/^﻿/, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

/** Valor de um elemento. Funciona em SGML (`<TAG>valor`) e em XML (`<TAG>valor</TAG>`). */
function readTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

/** `20261005120000[-3:BRT]` ou `20261005` → `2026-10-05`. Considera o dia informado pelo banco. */
function parseOfxDate(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${m}-${d}`;
}

/** Aceita ponto ou vírgula decimal (alguns bancos fogem da especificação) e separador de milhar. */
function parseOfxAmount(value: string): number | null {
  let clean = value.replace(/\s/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  if (lastComma > lastDot) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1) {
    clean = clean.replace(/,/g, "");
  }
  const amount = Number(clean);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Extrai os lançamentos (`<STMTTRN>`) de um extrato OFX 1.x (SGML) ou 2.x (XML),
 * de conta ou de cartão. Lançamentos sem data/valor válidos ou com valor zero são
 * ignorados; FITIDs repetidos no mesmo arquivo ficam só na primeira ocorrência.
 * Sem FITID, gera um id estável a partir de data, valor e descrição.
 */
export function parseOfx(text: string): OfxStatement {
  const kind = /<(CREDITCARDMSGSRSV1|CCSTMTRS)>/i.test(text) ? "CREDIT_CARD" : "BANK";

  const blocks =
    text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];

  const transactions: OfxTransaction[] = [];
  const seen = new Set<string>();
  const generatedCount = new Map<string, number>();

  for (const block of blocks) {
    const date = parseOfxDate(readTag(block, "DTPOSTED"));
    const amount = parseOfxAmount(readTag(block, "TRNAMT"));
    if (!date || amount === null || amount === 0) continue;

    const description = readTag(block, "MEMO") || readTag(block, "NAME") || "Sem descrição";

    let fitId = readTag(block, "FITID");
    if (!fitId) {
      const base = `gen:${date}:${amount}:${description.toLowerCase()}`;
      const n = (generatedCount.get(base) ?? 0) + 1;
      generatedCount.set(base, n);
      fitId = `${base}:${n}`;
    }
    if (seen.has(fitId)) continue;
    seen.add(fitId);

    transactions.push({ fitId, date, amount, description });
  }

  return { kind, transactions };
}
