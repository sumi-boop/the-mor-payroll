import { prisma } from "@/lib/db";
import { resolveTargetMonth } from "@/lib/targetMonth.server";
import { DeductionManager } from "./deduction-manager";

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const targetMonth = await resolveTargetMonth(sp.month);

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
        // targetMonth が変わるたびにコンポーネントを作り直し、
        // 内部の入力状態(rows)を新しい月のデータで初期化し直す。
        // key を付けないと、対象年月を切り替えても画面上は前の月の
        // 入力内容が残ったままになり、手動リロードしないと更新されない。
        key={targetMonth}
        targetMonth={targetMonth}
        employees={employees}
        deductions={deductions}
      />
    </div>
  );
}
