import { describe, expect, it } from "vitest";
import { csvNumber, toCsv } from "./csv";

describe("toCsv", () => {
  it("usa ';', CRLF e BOM", () => {
    expect(toCsv([["a", "b"], [1, null]])).toBe("﻿a;b\r\n1;\r\n");
  });

  it("coloca aspas em campos com ';', aspas ou quebra de linha", () => {
    const csv = toCsv([['Mercado; padaria', 'Disse "oi"', "linha 1\nlinha 2", "simples"]]);
    expect(csv).toBe('﻿"Mercado; padaria";"Disse ""oi""";"linha 1\nlinha 2";simples\r\n');
  });
});

describe("csvNumber", () => {
  it("vírgula decimal, duas casas, sem milhar", () => {
    expect(csvNumber(-1234.5)).toBe("-1234,50");
    expect(csvNumber(0.1 + 0.2)).toBe("0,30");
  });
});
