import { describe, expect, it } from "vitest";
import { decodeOfx, parseOfx } from "./ofx";

const SGML_BANK = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<DTSTART>20261001
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-45.90
<FITID>abc-1
<MEMO>IFD*IFOOD SAO PAULO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261006
<TRNAMT>3500,00
<FITID>abc-2
<NAME>SALARIO EMPRESA &amp; CIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261006
<TRNAMT>-45.90
<FITID>abc-1
<MEMO>DUPLICADO NO ARQUIVO
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const XML_CARD = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>
  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
    <BANKTRANLIST>
      <STMTTRN>
        <TRNTYPE>DEBIT</TRNTYPE>
        <DTPOSTED>20261003000000[-3:BRT]</DTPOSTED>
        <TRNAMT>-1.234,56</TRNAMT>
        <FITID>card-1</FITID>
        <MEMO>Mercado Pão de Açúcar</MEMO>
      </STMTTRN>
      <STMTTRN>
        <TRNTYPE>CREDIT</TRNTYPE>
        <DTPOSTED>20261010</DTPOSTED>
        <TRNAMT>500.00</TRNAMT>
        <FITID>card-2</FITID>
        <MEMO>Pagamento recebido</MEMO>
      </STMTTRN>
    </BANKTRANLIST>
  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

describe("parseOfx", () => {
  it("lê OFX 1.x (SGML) de conta", () => {
    const { kind, transactions } = parseOfx(SGML_BANK);
    expect(kind).toBe("BANK");
    expect(transactions).toEqual([
      { fitId: "abc-1", date: "2026-10-05", amount: -45.9, description: "IFD*IFOOD SAO PAULO" },
      { fitId: "abc-2", date: "2026-10-06", amount: 3500, description: "SALARIO EMPRESA & CIA" },
    ]);
  });

  it("lê OFX 2.x (XML) de cartão, com vírgula decimal e milhar", () => {
    const { kind, transactions } = parseOfx(XML_CARD);
    expect(kind).toBe("CREDIT_CARD");
    expect(transactions.map((t) => t.amount)).toEqual([-1234.56, 500]);
    expect(transactions[0]).toMatchObject({ date: "2026-10-03", description: "Mercado Pão de Açúcar" });
  });

  it("gera id estável quando não há FITID e diferencia lançamentos iguais", () => {
    const block = `<STMTTRN><DTPOSTED>20261001<TRNAMT>-10.00<MEMO>CAFE</STMTTRN>`;
    const text = `<OFX><BANKTRANLIST>${block}${block}</BANKTRANLIST></OFX>`;
    const ids = parseOfx(text).transactions.map((t) => t.fitId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(parseOfx(text).transactions.map((t) => t.fitId)).toEqual(ids);
  });

  it("ignora lançamentos com valor zero ou data inválida", () => {
    const text = `<OFX><BANKTRANLIST>
      <STMTTRN><DTPOSTED>20261001<TRNAMT>0.00<FITID>z</STMTTRN>
      <STMTTRN><DTPOSTED>xx<TRNAMT>-5<FITID>y</STMTTRN>
    </BANKTRANLIST></OFX>`;
    expect(parseOfx(text).transactions).toEqual([]);
  });
});

describe("decodeOfx", () => {
  it("decodifica acentos em windows-1252 conforme o cabeçalho", () => {
    const header = "OFXHEADER:100\nCHARSET:1252\n\n<OFX><MEMO>P";
    const bytes = new Uint8Array([...Buffer.from(header, "ascii"), 0xe3, 0x6f, 0x0a]);
    expect(decodeOfx(bytes.buffer)).toContain("Pão");
  });

  it("usa UTF-8 quando declarado no prólogo XML", () => {
    const text = '<?xml version="1.0" encoding="UTF-8"?><OFX><MEMO>Açúcar</MEMO></OFX>';
    const bytes = new TextEncoder().encode(text);
    expect(decodeOfx(bytes.buffer as ArrayBuffer)).toContain("Açúcar");
  });

  it("sem declaração, tenta UTF-8 e cai para windows-1252", () => {
    const utf8 = new TextEncoder().encode("<OFX><MEMO>Pão");
    expect(decodeOfx(utf8.buffer as ArrayBuffer)).toContain("Pão");
    const latin = new Uint8Array([0x3c, 0x4f, 0x46, 0x58, 0x3e, 0x50, 0xe3, 0x6f]);
    expect(decodeOfx(latin.buffer)).toContain("Pão");
  });
});
