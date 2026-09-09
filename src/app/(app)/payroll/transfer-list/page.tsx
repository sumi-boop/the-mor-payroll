import { prisma } from "@/lib/db";
import { resolveTargetMonth } from "@/lib/targetMonth.server";
import { TransferList } from "./transfer-list";

export default async function TransferListPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const targetMonth = await resolveTargetMonth(sp.month);

  const [records, activeEmployeeCount] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: { targetMonth, isConfirmed: true },
      include: { employee: true },
    }),
    prisma.employee.count({ where: { status: "active" } }),
  ]);

  const rows = records
    .map((r) => ({
      employeeId: r.employeeId,
      name: r.employee.name,
      bankInfo: r.employee.bankInfo,
      netPayment: r.netPayment,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const totalAmount = rows.reduce((sum, r) => sum + r.netPayment, 0);
  const unconfirmedCount = Math.max(0, activeEmployeeCount - rows.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-navy">振込先一覧</h1>
        <p className="text-sm text-muted-foreground">
          確定済みの給与明細から、振込先情報と差引支給額の一覧を表示します。振込作業のご確認にお使いください。未確定の明細は含まれません。
        </p>
      </div>
      <TransferList
        targetMonth={targetMonth}
        rows={rows}
        totalAmount={totalAmount}
        unconfirmedCount={unconfirmedCount}
      />
    </div>
  );
}
