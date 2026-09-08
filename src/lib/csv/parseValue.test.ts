import { describe, it, expect } from "vitest";
import {
  parseYenAmount,
  parseIntCount,
  parseHoursMinutes,
  formatMinutesAsHM,
  looksLikeFormulaInjection,
  sanitizeForSpreadsheet,
} from "./parseValue";

describe("parseYenAmount", () => {
  it("整数の金額を正しくパースする", () => {
    expect(parseYenAmount("205728")).toEqual({ ok: true, value: 205728 });
  });

  it("カンマ区切りの金額を正しくパースする", () => {
    expect(parseYenAmount("205,728")).toEqual({ ok: true, value: 205728 });
  });

  it("空文字はエラーになる", () => {
    const r = parseYenAmount("");
    expect(r.ok).toBe(false);
  });

  it("小数はエラーになる(整数円のみ許可)", () => {
    const r = parseYenAmount("1000.5");
    expect(r.ok).toBe(false);
  });

  it("数値以外の文字列はエラーになる", () => {
    const r = parseYenAmount("abc円");
    expect(r.ok).toBe(false);
  });

  it("数式インジェクションの可能性がある文字列は拒否する(=)", () => {
    const r = parseYenAmount("=SUM(A1:A10)");
    expect(r.ok).toBe(false);
  });

  it("数式インジェクションの可能性がある文字列は拒否する(+)", () => {
    const r = parseYenAmount("+1234");
    expect(r.ok).toBe(false);
  });

  it("数式インジェクションの可能性がある文字列は拒否する(-)", () => {
    // 純粋なマイナス数値は許可したいところだが、仕様上-始まりは数式懸念として拒否する
    const r = parseYenAmount("-1234");
    expect(r.ok).toBe(false);
  });

  it("数式インジェクションの可能性がある文字列は拒否する(@)", () => {
    const r = parseYenAmount("@cmd");
    expect(r.ok).toBe(false);
  });
});

describe("parseIntCount", () => {
  it("正の整数をパースできる", () => {
    expect(parseIntCount("20")).toEqual({ ok: true, value: 20 });
  });

  it("小数はエラーになる", () => {
    expect(parseIntCount("20.5").ok).toBe(false);
  });

  it("空文字はエラーになる", () => {
    expect(parseIntCount("").ok).toBe(false);
  });
});

describe("parseHoursMinutes", () => {
  it("「時:分」形式を分単位に変換できる(146:57)", () => {
    expect(parseHoursMinutes("146:57")).toEqual({ ok: true, value: 146 * 60 + 57 });
  });

  it("1桁の分も正しく解釈する(6:03)", () => {
    expect(parseHoursMinutes("6:03")).toEqual({ ok: true, value: 6 * 60 + 3 });
  });

  it("0:00 を 0 に変換できる", () => {
    expect(parseHoursMinutes("0:00")).toEqual({ ok: true, value: 0 });
  });

  it("不正な時間表記(コロンなし)はエラーになる", () => {
    expect(parseHoursMinutes("14657").ok).toBe(false);
  });

  it("不正な時間表記(分が60以上)はエラーになる", () => {
    expect(parseHoursMinutes("10:75").ok).toBe(false);
  });

  it("不正な時間表記(空文字)はエラーになる", () => {
    expect(parseHoursMinutes("").ok).toBe(false);
  });

  it("不正な時間表記(文字列混入)はエラーになる", () => {
    expect(parseHoursMinutes("10時30分").ok).toBe(false);
  });
});

describe("formatMinutesAsHM", () => {
  it("分単位を「時:分」表記へ戻せる", () => {
    expect(formatMinutesAsHM(146 * 60 + 57)).toBe("146:57");
    expect(formatMinutesAsHM(6 * 60 + 3)).toBe("6:03");
    expect(formatMinutesAsHM(0)).toBe("0:00");
  });
});

describe("looksLikeFormulaInjection / sanitizeForSpreadsheet", () => {
  it("=, +, -, @ で始まる文字列を数式の可能性ありと判定する", () => {
    expect(looksLikeFormulaInjection("=cmd")).toBe(true);
    expect(looksLikeFormulaInjection("+1")).toBe(true);
    expect(looksLikeFormulaInjection("-1")).toBe(true);
    expect(looksLikeFormulaInjection("@SUM")).toBe(true);
  });

  it("通常の氏名は数式と判定しない", () => {
    expect(looksLikeFormulaInjection("山口桃花")).toBe(false);
  });

  it("sanitizeForSpreadsheetは危険な文字列に先頭シングルクォートを付与する", () => {
    expect(sanitizeForSpreadsheet("=cmd")).toBe("'=cmd");
    expect(sanitizeForSpreadsheet("山口桃花")).toBe("山口桃花");
  });
});
