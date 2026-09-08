import "server-only";
import iconv from "iconv-lite";
import jschardet from "jschardet";

export type DetectedEncoding = "utf-8" | "utf-8-bom" | "shift_jis";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * CSVファイルのバイト列から文字コードを判定し、UTF-8文字列にデコードする。
 * 対応: UTF-8 / UTF-8(BOM付き) / Shift_JIS
 */
export function decodeCsvBuffer(buffer: Buffer): {
  text: string;
  encoding: DetectedEncoding;
} {
  if (buffer.subarray(0, 3).equals(UTF8_BOM)) {
    return {
      text: buffer.subarray(3).toString("utf-8"),
      encoding: "utf-8-bom",
    };
  }

  // まずUTF-8として正当かどうかを検証する
  if (isValidUtf8(buffer)) {
    return { text: buffer.toString("utf-8"), encoding: "utf-8" };
  }

  // jschardetで判定を試みつつ、Shift_JIS(CP932)としてデコードする
  const detected = jschardet.detect(buffer);
  const detectedEncoding = detected?.encoding?.toLowerCase() ?? "";

  if (
    detectedEncoding.includes("sjis") ||
    detectedEncoding.includes("shift") ||
    detectedEncoding.includes("windows-31j") ||
    detectedEncoding.includes("euc") ||
    detectedEncoding === ""
  ) {
    return { text: iconv.decode(buffer, "Shift_JIS"), encoding: "shift_jis" };
  }

  // それ以外(gb2312等誤検出されがちなもの含む)もShift_JISとして試す
  return { text: iconv.decode(buffer, "Shift_JIS"), encoding: "shift_jis" };
}

function isValidUtf8(buffer: Buffer): boolean {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buffer);
    return true;
  } catch {
    return false;
  }
}
