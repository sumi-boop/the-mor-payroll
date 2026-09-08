import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { decodeCsvBuffer } from "./encoding";

const HEADER =
  "氏名,出勤日数,労働時間,残業時間,深夜労働時間,時給,基本給,残業手当,深夜手当,通勤手当,手当・その他,合計";
const ROW = "山口桃花,20,146:57,6:03,4:12,1400,205728,2118,1470,14320,0,223636";
const SAMPLE_CSV = `${HEADER}\n${ROW}\n`;

describe("decodeCsvBuffer", () => {
  it("UTF-8(BOMなし)のCSVを正しく判定・デコードできる", () => {
    const buffer = Buffer.from(SAMPLE_CSV, "utf-8");
    const { text, encoding } = decodeCsvBuffer(buffer);
    expect(encoding).toBe("utf-8");
    expect(text).toContain("氏名");
    expect(text).toContain("山口桃花");
  });

  it("UTF-8(BOM付き)のCSVを正しく判定し、BOMを除去してデコードできる", () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const buffer = Buffer.concat([bom, Buffer.from(SAMPLE_CSV, "utf-8")]);
    const { text, encoding } = decodeCsvBuffer(buffer);
    expect(encoding).toBe("utf-8-bom");
    // BOM文字自体がテキストの先頭に残っていないこと
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text.startsWith("氏名")).toBe(true);
    expect(text).toContain("山口桃花");
  });

  it("Shift_JISのCSVを正しく判定・デコードできる", () => {
    const buffer = iconv.encode(SAMPLE_CSV, "Shift_JIS");
    const { text, encoding } = decodeCsvBuffer(buffer);
    expect(encoding).toBe("shift_jis");
    expect(text).toContain("氏名");
    expect(text).toContain("山口桃花");
  });

  it("Shift_JIS特有の全角文字(丸数字や半角カナ等を含む氏名)も文字化けせず変換できる", () => {
    const text = `${HEADER}\n田中　太郎,22,176:00,10:30,0:00,1350,237600,14175,0,10000,0,261775\n`;
    const buffer = iconv.encode(text, "Shift_JIS");
    const result = decodeCsvBuffer(buffer);
    expect(result.encoding).toBe("shift_jis");
    expect(result.text).toContain("田中");
    expect(result.text).toContain("太郎");
  });
});
