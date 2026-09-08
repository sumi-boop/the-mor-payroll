import { prisma } from "@/lib/db";
import { DeductionManager } from "./deduction-manager";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const targetMonth = sp.month ?? currentMonth();

  const [employees, deductions] = await Promise.all([
    prisma.employee.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    prisma.monthlyDeduction.findMany({ where: { targetMonth } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-navy">月別控除設定</h1>
        <p className="text-sm text-muted-foreground">
          健康保険・介護保険・厚生年金・雇用保険・所得税・住民税・その他控除を従業員ごと、対象年月ごとに設定します。
          住民税・社会保険料・所得税は管理者が確認してから確定してください。
        </p>
      </div>
      <DeductionManager
        targetMonth={targetMonth}
        employees={employees}
        deductions={deductions}
      />
    </div>
  );
}
