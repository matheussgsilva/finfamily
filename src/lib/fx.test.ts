import { describe, expect, it } from "vitest";
import { fxQuoteFor } from "./fx";

describe("fxQuoteFor", () => {
  it("BRL não precisa de câmbio", () => {
    expect(fxQuoteFor("BRL")).toBeNull();
  });

  it("monta o par da moeda com BRL", () => {
    expect(fxQuoteFor("USD")).toEqual({ symbol: "USDBRL=X", divisor: 1 });
    expect(fxQuoteFor("eur")).toEqual({ symbol: "EURBRL=X", divisor: 1 });
  });

  it("cotação em pence usa GBP e divide por 100", () => {
    expect(fxQuoteFor("GBp")).toEqual({ symbol: "GBPBRL=X", divisor: 100 });
    expect(fxQuoteFor("GBX")).toEqual({ symbol: "GBPBRL=X", divisor: 100 });
  });
});
