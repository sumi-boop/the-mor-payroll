import Link from "next/link";
import { prisma } from "@/lib/db";
import { calcTotalDeduction, calcNetPayment, evaluateWarnings, hasBlockingErrors } from "@/lib/payroll/calc";
import { formatYen, formatMonth, formatDateJp } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const targetMonth = sp.month ?? currentMonth();

  const [records, deductions, recentPdfs] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: { targetMonth },
      include: { employee: true },
    }),
    prisma.monthlyDeduction.findMany({ where: { targetMonth } }),
    prisma.payrollRecord.findMany({
      where: { pdfGeneratedAt: { not: null } },
      include: { employee: true },
      orderBy: { pdfGeneratedAt: "desc" },
      take: 5,
    }),
  ]);

  const deductionMap = new Map(deductions.map((d) => [d.employeeId, d]));

  let totalPayment = 0;
  let totalDeduction = 0;
  let netPayment = 0;
  let errorCount = 0;
  let unsetCount = 0;

  for (const record of records) {
    const deduction = deductionMap.get(record.employeeId);
    const effective = record.isConfirmed
      ? record
      : {
          healthInsurance: deduction?.healthInsurance ?? 0,
          careInsurance: deduction?.careInsurance ?? 0,
          pensionInsurance: deduction?.pensionInsurance ?? 0,
          employmentInsurance: deduction?.employmentInsurance ?? 0,
          incomeTax: deduction?.incomeTax ?? 0,
          residentTax: deduction?.residentTax ?? 0,
          otherDeduction: deduction?.otherDeduction ?? 0,
        };
    const td = calcTotalDeduction(effective);
    const np = calcNetPayment(record.totalPayment, td);
    totalPayment += record.totalPayment;
    totalDeduction += td;
    netPayment += np;

    if (!deduction) unsetCount++;

    const warnings = evaluateWarnings({
      employeeExists: true,
      employeeStatus: record.employee.status,
      socialInsuranceEnrolled: record.employee.socialInsurance,
      employmentInsuranceEnrolled: record.employee.employmentInsurance,
      ...effective,
      residentTaxConfirmed: record.isConfirmed || (deduction?.residentTaxConfirmed ?? false),
      socialInsuranceConfirmed: record.isConfirmed || (deduction?.socialInsuranceConfirmed ?? false),
      incomeTaxConfirmed: record.isConfirmed || (deduction?.incomeTaxConfirmed ?? false),
      totalPayment: record.totalPayment,
      amountMismatch: record.amountMismatch,
      amountMismatchAck: record.amountMismatchAck,
      isDuplicateInCsv: false,
      alreadyExistsForMonth: false,
    });
    if (hasBlockingErrors(warnings)) errorCount++;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">{formatMonth(targetMonth)}の状況</p>
        </div>
        <form className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">対象年月</label>
            <Input type="month" name="month" defaultValue={targetMonth} className="w-48" />
          </div>
          <button
            type="submit"
            className="h-10 rounded-md border border-border bg-card px-4 text-sm hover:bg-secondary"
          >
            表示
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="従業員数" value={`${records.length}人`} />
        <StatCard label="総支給額" value={formatYen(totalPayment)} variant="result" />
        <StatCard label="控除合計" value={formatYen(totalDeduction)} variant="result" />
        <StatCard label="差引支給額合計" value={formatYen(netPayment)} variant="result" />
        <StatCard label="未設定項目がある従業員数" value={`${unsetCount}人`} variant={unsetCount > 0 ? "warn" : undefined} />
        <StatCard label="エラー件数" value={`${errorCount}件`} variant={errorCount > 0 ? "error" : undefined} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/import" className="text-sm text-primary underline">
          CSV取込へ →
        </Link>
        <Link href={`/payroll?month=${targetMonth}`} className="text-sm text-primary underline">
          給与計算確認画面へ →
        </Link>
        <Link href={`/deductions?month=${targetMonth}`} className="text-sm text-primary underline">
          月別控除設定へ →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近作成した給与明細</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPdfs.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ作成されていません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentPdfs.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span>
                    {r.employee.name}({formatMonth(r.targetMonth)})
                  </span>
                  <span className="text-muted-foreground">
                    {r.pdfGeneratedAt ? formatDateJp(r.pdfGeneratedAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "result" | "warn" | "error";
}) {
  const cls =
    variant === "result"
      ? "border-result-field-border bg-result-field"
      : variant === "warn"
      ? "border-warn-field-border bg-warn-field"
      : variant === "error"
      ? "border-error-field-border bg-error-field"
      : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-navy">{value}</p>
    </div>
  );
}
