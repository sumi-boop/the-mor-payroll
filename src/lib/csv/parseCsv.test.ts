import { describe, it, expect } from "vitest";
import { parseCsvText, EXPECTED_HEADERS } from "./parseCsv";

const HEADER_LINE = EXPECTED_HEADERS.join(",");

function csv(...rows: string[]): string {
  return [HEADER_LINE, ...rows].join("\n") + "\n";
}

describe("parseCsvText - 1. 正常なCSVの取込", () => {
  it("仕様通りの1行を正しくパースし、金額の内訳合計とCSVの合計列が一致する", () => {
    const text = csv("山口桃花,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223636");
    const result = parseCsvText(text);

    expect(result.headerValid).toBe(true);
    expect(result.totalRowCount).toBe(1);
    expect(result.errorRowCount).toBe(0);

    const row = result.rows[0];
    expect(row.rawName).toBe("山口桃花");
    expect(row.workDays).toBe(20);
    expect(row.workMinutes).toBe(146 * 60 + 57);
    expect(row.overtimeMinutes).toBe(6 * 60 + 3);
    expect(row.nightMinutes).toBe(4 * 60 + 12);
    expect(row.hourlyWage).toBe(1400);
    expect(row.baseSalary).toBe(205728);
    expect(row.overtimeAllowance).toBe(2118);
    expect(row.nightAllowance).toBe(1470);
    expect(row.commuteAllowance).toBe(14320);
    expect(row.otherAllowance).toBe(0);
    expect(row.totalAllowanceCsv).toBe(223636);
    expect(row.computedTotal).toBe(205728 + 2118 + 1470 + 14320 + 0);
    expect(row.amountMismatch).toBe(false);
    expect(row.errors).toEqual([]);
  });

  it("複数行を正しくパースできる", () => {
    const text = csv(
      "田中太郎,22,176:00,10:30,0:00,1350,237600,14175,0,10000,0,261775",
      "佐藤花子,18,132:15,0:00,2:00,1300,171925,0,650,8000,0,180575"
    );
    const result = parseCsvText(text);
    expect(result.totalRowCount).toBe(2);
    expect(result.errorRowCount).toBe(0);
    expect(result.rows.map((r) => r.rawName)).toEqual(["田中太郎", "佐藤花子"]);
  });
});

describe("parseCsvText - 4. 必須列不足", () => {
  it("列数が不足しているCSVはheaderValid=falseになる(APIルート側でrowsは空として扱われる)", () => {
    const shortHeader = EXPECTED_HEADERS.slice(0, 8).join(",");
    const text = `${shortHeader}\n山口桃花,20,146:57,6:03,4:12,1400,205728,2118\n`;
    const result = parseCsvText(text);
    expect(result.headerValid).toBe(false);
    expect(result.headerErrors.length).toBeGreaterThan(0);
    // 不足している列(通勤手当・手当その他・合計)は値が取得できずエラーになる
    expect(result.rows[0].errors.some((e) => e.includes("通勤手当"))).toBe(true);
  });

  it("必須列の名称が異なるCSVはheaderValid=falseになる", () => {
    const badHeader: string[] = [...EXPECTED_HEADERS];
    badHeader[0] = "名前"; // 「氏名」であるべき列が違う
    const text = `${badHeader.join(",")}\n山口桃花,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223636\n`;
    const result = parseCsvText(text);
    expect(result.headerValid).toBe(false);
    expect(result.headerErrors.some((e) => e.includes("1列目"))).toBe(true);
  });
});

describe("parseCsvText - 5. 不正な金額", () => {
  it("金額欄に数値以外が入っている行はエラーになる", () => {
    const text = csv("鈴木一郎,21,168:00,5:00,0:00,1400,不明,8750,0,12000,5000,260950");
    const result = parseCsvText(text);
    expect(result.errorRowCount).toBe(1);
    expect(result.rows[0].errors.some((e) => e.startsWith("基本給"))).toBe(true);
    expect(result.rows[0].baseSalary).toBeNull();
  });

  it("金額欄が数式インジェクションの可能性がある文字列の場合エラーになる", () => {
    const text = csv("鈴木一郎,21,168:00,5:00,0:00,1400,=205728,8750,0,12000,5000,260950");
    const result = parseCsvText(text);
    expect(result.errorRowCount).toBe(1);
    expect(result.rows[0].errors.some((e) => e.includes("基本給"))).toBe(true);
  });
});

describe("parseCsvText - 6. 不正な時間表記", () => {
  it("時間欄が「時:分」形式でない場合エラーになる", () => {
    const text = csv("鈴木一郎,21,168時間,5:00,0:00,1400,235200,8750,0,12000,5000,260950");
    const result = parseCsvText(text);
    expect(result.errorRowCount).toBe(1);
    expect(result.rows[0].errors.some((e) => e.includes("労働時間"))).toBe(true);
    expect(result.rows[0].workMinutes).toBeNull();
  });

  it("分が60以上の不正な時間表記はエラーになる", () => {
    const text = csv("鈴木一郎,21,168:99,5:00,0:00,1400,235200,8750,0,12000,5000,260950");
    const result = parseCsvText(text);
    expect(result.errorRowCount).toBe(1);
  });
});

describe("parseCsvText - 7. 同姓同名", () => {
  it("同一氏名(正規化後)が複数行ある場合、両方isDuplicateName=trueとなる", () => {
    const text = csv(
      "田中太郎,22,176:00,10:30,0:00,1350,237600,14175,0,10000,0,261775",
      "田中太郎,20,160:00,0:00,0:00,1300,208000,0,0,8000,0,216000"
    );
    const result = parseCsvText(text);
    expect(result.duplicateNameCount).toBe(1);
    expect(result.rows[0].isDuplicateName).toBe(true);
    expect(result.rows[1].isDuplicateName).toBe(true);
  });

  it("異なる氏名同士は重複と判定しない", () => {
    const text = csv(
      "田中太郎,22,176:00,10:30,0:00,1350,237600,14175,0,10000,0,261775",
      "田中花子,20,160:00,0:00,0:00,1300,208000,0,0,8000,0,216000"
    );
    const result = parseCsvText(text);
    expect(result.duplicateNameCount).toBe(0);
    expect(result.rows.every((r) => !r.isDuplicateName)).toBe(true);
  });
});

describe("parseCsvText - 8. 空白を含む氏名", () => {
  it("全角スペースを含む氏名と半角スペースを含む氏名は正規化後に同一とみなされ重複検出される", () => {
    const text = csv(
      "田中　太郎,22,176:00,10:30,0:00,1350,237600,14175,0,10000,0,261775",
      "田中 太郎,20,160:00,0:00,0:00,1300,208000,0,0,8000,0,216000"
    );
    const result = parseCsvText(text);
    expect(result.rows[0].normalizedName).toBe(result.rows[1].normalizedName);
    expect(result.duplicateNameCount).toBe(1);
  });

  it("前後の空白は正規化で除去される", () => {
    const text = csv(" 山口桃花 ,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223636");
    const result = parseCsvText(text);
    expect(result.rows[0].normalizedName).toBe("山口桃花");
  });

  it("氏名が空白のみの場合はエラーになる", () => {
    // Papa Parseはトリムしないため、空白のみのセルは「氏名が空」として扱われる想定
    const text = csv(",20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223636");
    const result = parseCsvText(text);
    expect(result.rows[0].errors).toContain("氏名が空です");
  });
});

describe("parseCsvText - 9. 支給額不一致", () => {
  it("内訳の合計とCSVの「合計」列が一致しない場合、amountMismatch=trueかつ差分が記録される", () => {
    // 正しい内訳合計は 205728+2118+1470+14320+0 = 223636 だが、合計列を224000にずらす
    const text = csv("山口桃花,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,224000");
    const result = parseCsvText(text);
    const row = result.rows[0];
    expect(row.amountMismatch).toBe(true);
    expect(row.amountMismatchDiff).toBe(224000 - 223636);
  });

  it("差分が1円未満(0円)の場合は不一致と判定しない", () => {
    const text = csv("山口桃花,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223636");
    const result = parseCsvText(text);
    expect(result.rows[0].amountMismatch).toBe(false);
  });

  it("差分がちょうど1円の場合でも不一致と判定する(1円以上で警告)", () => {
    const text = csv("山口桃花,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223637");
    const result = parseCsvText(text);
    expect(result.rows[0].amountMismatch).toBe(true);
    expect(result.rows[0].amountMismatchDiff).toBe(1);
  });
});
