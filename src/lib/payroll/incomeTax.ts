/**
 * 所得税(源泉徴収税額)の自動計算ロジック。
 *
 * 国税庁が公表する「令和8年分 源泉徴収税額表」のうち、月額表・甲欄に対応する
 * 「電子計算機等を用いて源泉徴収税額を計算する方法(電算機計算の特例)」の算式を実装したもの。
 * (出典: 国税庁 https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/denshi_01.pdf )
 *
 * 実装した算式は、国税庁が公表する印刷用の月額表(甲欄)
 * https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf
 * の「248,000円以上251,000円未満」の行(扶養親族等の数 0人〜3人)と突き合わせ、
 * 一致することを確認済み(このモジュールの各テストを参照)。
 *
 * 【対応範囲・注意点】
 * - 甲欄(扶養控除等申告書を提出している場合)のみ自動計算に対応する。
 *   乙欄(扶養控除等申告書を提出していない、2か所以上から給与を受けている場合など)は
 *   電算機計算の算式を公式資料から確実に検証できなかったため、今回は自動計算の対象外とし、
 *   従来どおり手入力とする(estimateIncomeTax は supported:false を返す)。
 * - 課税対象額(A)は「基本給+残業手当+深夜手当+手当その他 − 社会保険料等」として計算しており、
 *   通勤手当は全額非課税として除外している(月15万円などの非課税限度額を超える通勤手当がある
 *   場合は、実際には課税対象になるため、この自動計算では考慮されていない点に注意)。
 * - 配偶者控除・扶養控除は、従業員マスタの「扶養親族等の人数」をそのまま
 *   源泉控除対象親族の人数として扱っている(配偶者を含む場合は、その人数を含めて入力する)。
 * - 税制改正により税額表の数値は毎年見直される可能性があるため、年が変わった際は
 *   このファイルの数値が最新の国税庁公表資料と一致しているか確認すること。
 */

export type TaxWithholdingType = "kou" | "otsu";

export type IncomeTaxCalcInput = {
  /** その月の課税対象支給額(社会保険料等控除前。通勤手当を除く) */
  grossTaxablePayment: number;
  /** その月に控除する社会保険料等の合計(健康保険+介護保険+厚生年金+雇用保険) */
  socialInsuranceTotal: number;
  taxWithholdingType: TaxWithholdingType;
  dependentFormSubmitted: boolean;
  dependentCount: number;
};

export type IncomeTaxEstimate = {
  /** 自動計算に対応している場合の推定税額(円) */
  amount: number;
  /** この従業員・条件で自動計算に対応しているか */
  supported: boolean;
  /** 補足メッセージ(未対応の理由や前提条件など) */
  note: string;
  /** 計算に用いた課税対象額(A) */
  taxableWage: number;
};

/** 1円未満切り上げ */
function ceilYen(n: number): number {
  return Math.ceil(n);
}

/** 10円未満四捨五入(五捨五超入ではなく、ちょうど5は切り上げ) */
function roundToTen(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * 第1表: 給与所得控除の額を求める(甲欄・乙欄共通)。
 * A = その月の社会保険料等控除後の給与等の金額
 */
function salaryIncomeDeduction(a: number): number {
  if (a < 158334) return 54167;
  if (a <= 299999) return ceilYen(a * 0.3 + 6667);
  if (a <= 549999) return ceilYen(a * 0.2 + 36667);
  if (a <= 708330) return ceilYen(a * 0.1 + 91667);
  return 162500;
}

/**
 * 第3表: 基礎控除の額を求める(甲欄・乙欄共通)。
 * A = その月の社会保険料等控除後の給与等の金額
 */
function basicDeduction(a: number): number {
  if (a <= 2120833) return 48334;
  if (a <= 2162499) return 40000;
  if (a <= 2204166) return 26667;
  if (a <= 2245833) return 13334;
  return 0;
}

/**
 * 第4表: 甲欄の税額の算式。B = 課税給与所得金額。
 * (復興特別所得税を含んだ税率で、10円未満四捨五入まで実施した最終税額を返す)
 */
function kouTaxFromBracket(b: number): number {
  let raw: number;
  if (b <= 162500) raw = b * 0.05105;
  else if (b <= 275000) raw = b * 0.1021 - 8296;
  else if (b <= 579166) raw = b * 0.2042 - 36374;
  else if (b <= 750000) raw = b * 0.23483 - 54113;
  else if (b <= 1500000) raw = b * 0.33693 - 130688;
  else if (b <= 3333333) raw = b * 0.4084 - 237893;
  else raw = b * 0.45945 - 408061;
  return roundToTen(Math.max(0, raw));
}

/**
 * 甲欄の月額源泉徴収税額を計算する。
 */
export function calcKouWithholdingTax(
  grossTaxablePayment: number,
  socialInsuranceTotal: number,
  dependentCount: number
): number {
  const a = Math.max(0, grossTaxablePayment - socialInsuranceTotal);
  const salaryDeduction = salaryIncomeDeduction(a);
  const salaryIncome = Math.max(0, a - salaryDeduction);
  const dependentDeduction = Math.max(0, dependentCount) * 31667;
  const basic = basicDeduction(a);
  const b = Math.max(0, salaryIncome - dependentDeduction - basic);
  return kouTaxFromBracket(b);
}

/**
 * 従業員の条件から、その月の所得税(源泉徴収税額)を推定する。
 * 乙欄は自動計算に未対応のため supported:false を返す。
 */
export function estimateIncomeTax(input: IncomeTaxCalcInput): IncomeTaxEstimate {
  const taxableWage = Math.max(0, input.grossTaxablePayment - input.socialInsuranceTotal);

  if (input.taxWithholdingType !== "kou" || !input.dependentFormSubmitted) {
    return {
      amount: 0,
      supported: false,
      note:
        input.taxWithholdingType !== "kou"
          ? "乙欄が設定されている従業員は自動計算に対応していません。税額表(乙欄)を確認して手入力してください。"
          : "扶養控除等申告書が未提出の従業員は甲欄の自動計算を適用できません。乙欄の税額表を確認して手入力してください。",
      taxableWage,
    };
  }

  const amount = calcKouWithholdingTax(
    input.grossTaxablePayment,
    input.socialInsuranceTotal,
    input.dependentCount
  );

  return {
    amount,
    supported: true,
    note: `甲欄・扶養親族等${input.dependentCount}人として計算した概算額です。内容を確認のうえご利用ください。`,
    taxableWage,
  };
}
