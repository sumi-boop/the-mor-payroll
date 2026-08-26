import "server-only";
import path from "node:path";
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { formatMinutesAsHM } from "@/lib/csv/parseValue";

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const fontDir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: path.join(fontDir, "NotoSansJP-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(fontDir, "NotoSansJP-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // react-pdf(pdfkit)は自動的なハイフネーションを行おうとするため、
  // 日本語では単語区切りの概念が異なり不要な分割が起きるのでオフにする
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    padding: 32,
    color: "#1a2238",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  companyName: { fontSize: 12, fontWeight: "bold" },
  docTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  metaBlock: { fontSize: 9, textAlign: "right" },
  employeeBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1 solid #12213f",
    paddingBottom: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    backgroundColor: "#12213f",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    padding: 4,
    marginTop: 10,
    marginBottom: 4,
  },
  table: { display: "flex", flexDirection: "column", border: "1 solid #dbdfe6" },
  tr: { flexDirection: "row" },
  th: {
    flex: 1,
    borderRight: "1 solid #dbdfe6",
    borderBottom: "1 solid #dbdfe6",
    backgroundColor: "#eef0f3",
    padding: 4,
    fontSize: 8,
    textAlign: "center",
  },
  td: {
    flex: 1,
    borderRight: "1 solid #dbdfe6",
    borderBottom: "1 solid #dbdfe6",
    padding: 4,
    fontSize: 9,
    textAlign: "right",
  },
  tdLast: { borderRight: "0 solid #dbdfe6" },
  netPaymentBox: {
    marginTop: 14,
    padding: 14,
    backgroundColor: "#12213f",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netPaymentLabel: { color: "#ffffff", fontSize: 12, fontWeight: "bold" },
  netPaymentValue: { color: "#ffffff", fontSize: 22, fontWeight: "bold" },
  remarksBox: {
    marginTop: 12,
    border: "1 solid #dbdfe6",
    padding: 8,
    minHeight: 40,
  },
  remarksLabel: { fontSize: 8, color: "#5b6472", marginBottom: 3 },
  footerNote: {
    marginTop: 20,
    fontSize: 7,
    color: "#5b6472",
    textAlign: "center",
  },
});

function yen(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.trunc(n)).toLocaleString("ja-JP")}円`;
}

export type PayslipData = {
  companyName: string;
  targetMonthLabel: string; // "2026年08月"
  payDateLabel: string; // "2026年8月25日"
  employeeNumber: string | null;
  employeeName: string;
  workDays: number;
  workMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  baseSalary: number;
  overtimeAllowance: number;
  nightAllowance: number;
  commuteAllowance: number;
  otherAllowance: number;
  totalPayment: number;
  healthInsurance: number;
  careInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  otherDeduction: number;
  otherDeductionLabel: string | null;
  totalDeduction: number;
  netPayment: number;
  remarks: string | null;
};

function PayslipPage({ data }: { data: PayslipData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <Text style={styles.companyName}>{data.companyName}</Text>
        <View style={styles.metaBlock}>
          <Text>対象年月: {data.targetMonthLabel}</Text>
          <Text>支給日: {data.payDateLabel}</Text>
        </View>
      </View>
      <Text style={styles.docTitle}>給与支給明細書</Text>

      <View style={styles.employeeBlock}>
        <Text>従業員番号: {data.employeeNumber ?? "-"}</Text>
        <Text style={{ fontSize: 12, fontWeight: "bold" }}>{data.employeeName} 様</Text>
      </View>

      <Text style={styles.sectionTitle}>勤怠</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={styles.th}>出勤日数</Text>
          <Text style={styles.th}>労働時間</Text>
          <Text style={styles.th}>残業時間</Text>
          <Text style={[styles.th, styles.tdLast]}>深夜労働時間</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>{data.workDays}日</Text>
          <Text style={styles.td}>{formatMinutesAsHM(data.workMinutes)}</Text>
          <Text style={styles.td}>{formatMinutesAsHM(data.overtimeMinutes)}</Text>
          <Text style={[styles.td, styles.tdLast]}>{formatMinutesAsHM(data.nightMinutes)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>支給</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={styles.th}>基本給</Text>
          <Text style={styles.th}>残業手当</Text>
          <Text style={styles.th}>深夜手当</Text>
          <Text style={styles.th}>通勤手当</Text>
          <Text style={styles.th}>手当・その他</Text>
          <Text style={[styles.th, styles.tdLast]}>総支給額</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>{yen(data.baseSalary)}</Text>
          <Text style={styles.td}>{yen(data.overtimeAllowance)}</Text>
          <Text style={styles.td}>{yen(data.nightAllowance)}</Text>
          <Text style={styles.td}>{yen(data.commuteAllowance)}</Text>
          <Text style={styles.td}>{yen(data.otherAllowance)}</Text>
          <Text style={[styles.td, styles.tdLast, { fontWeight: "bold" }]}>
            {yen(data.totalPayment)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>控除</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={styles.th}>健康保険料</Text>
          <Text style={styles.th}>介護保険料</Text>
          <Text style={styles.th}>厚生年金保険料</Text>
          <Text style={styles.th}>雇用保険料</Text>
          <Text style={styles.th}>所得税</Text>
          <Text style={styles.th}>住民税</Text>
          <Text style={styles.th}>
            {data.otherDeductionLabel ? data.otherDeductionLabel : "その他控除"}
          </Text>
          <Text style={[styles.th, styles.tdLast]}>控除合計</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>{yen(data.healthInsurance)}</Text>
          <Text style={styles.td}>{yen(data.careInsurance)}</Text>
          <Text style={styles.td}>{yen(data.pensionInsurance)}</Text>
          <Text style={styles.td}>{yen(data.employmentInsurance)}</Text>
          <Text style={styles.td}>{yen(data.incomeTax)}</Text>
          <Text style={styles.td}>{yen(data.residentTax)}</Text>
          <Text style={styles.td}>{yen(data.otherDeduction)}</Text>
          <Text style={[styles.td, styles.tdLast, { fontWeight: "bold" }]}>
            {yen(data.totalDeduction)}
          </Text>
        </View>
      </View>

      <View style={styles.netPaymentBox}>
        <Text style={styles.netPaymentLabel}>差引支給額</Text>
        <Text style={styles.netPaymentValue}>{yen(data.netPayment)}</Text>
      </View>

      <View style={styles.remarksBox}>
        <Text style={styles.remarksLabel}>備考</Text>
        <Text>{data.remarks ?? ""}</Text>
      </View>

      <Text style={styles.footerNote}>
        {data.companyName} ・ 本明細書は給与明細自動作成システムにより作成されました
      </Text>
    </Page>
  );
}

export function PayslipDocument({ records }: { records: PayslipData[] }) {
  registerFonts();
  return (
    <Document>
      {records.map((r, i) => (
        <PayslipPage key={i} data={r} />
      ))}
    </Document>
  );
}

export { registerFonts };
