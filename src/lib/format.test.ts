import { describe, it, expect } from "vitest";
import { formatYen, formatMonth, formatDateJp } from "./format";

describe("formatMonth", () => {
  it("月をゼロパディングした「YYYY年MM月」形式で返す(ファイル名仕様に合わせる)", () => {
    expect(formatMonth("2026-08")).toBe("2026年08月");
  });

  it("すでに2桁の月もそのまま正しく整形する", () => {
    expect(formatMonth("2026-12")).toBe("2026年12月");
  });
});

describe("formatYen", () => {
  it("3桁区切りカンマ + 円で整形する", () => {
    expect(formatYen(1234567)).toBe("1,234,567円");
  });

  it("マイナス金額も正しく整形する", () => {
    expect(formatYen(-5000)).toBe("-5,000円");
  });

  it("0円を正しく整形する", () => {
    expect(formatYen(0)).toBe("0円");
  });
});

describe("formatDateJp", () => {
  it("Dateオブジェクトを日本語の年月日形式で整形する", () => {
    expect(formatDateJp(new Date(2026, 7, 25))).toBe("2026年8月25日");
  });
});
