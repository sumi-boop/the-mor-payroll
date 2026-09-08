import { describe, it, expect } from "vitest";
import { normalizeName, namesMatch } from "./name";

describe("normalizeName - 8. 空白を含む氏名", () => {
  it("全角スペースを半角スペース1つへ正規化する", () => {
    expect(normalizeName("田中　太郎")).toBe("田中 太郎");
  });

  it("連続する空白(全角/半角混在)を単一の半角スペースへ正規化する", () => {
    expect(normalizeName("田中　 　太郎")).toBe("田中 太郎");
  });

  it("前後の空白を除去する", () => {
    expect(normalizeName("  山口桃花  ")).toBe("山口桃花");
    expect(normalizeName("　山口桃花　")).toBe("山口桃花");
  });

  it("全角英数字を半角へ正規化する(NFKC)", () => {
    expect(normalizeName("Ｊｏｈｎ")).toBe("John");
  });

  it("空文字・null相当の入力に対して安全に空文字を返す", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("namesMatch", () => {
  it("全角/半角スペースの違いを吸収して同一人物と判定する", () => {
    expect(namesMatch("田中　太郎", "田中 太郎")).toBe(true);
  });

  it("氏名が異なる場合はfalseを返す", () => {
    expect(namesMatch("田中太郎", "田中花子")).toBe(false);
  });
});
