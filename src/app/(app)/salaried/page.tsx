import { prisma } from "@/lib/db";
import { resolveTargetMonth } from "@/lib/targetMonth.server";
import { SalariedPayrollManager } from "./salaried-payroll-manager";

export default async function SalariedPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const targetMonth = await resolveTargetMonth(sp.month);

  const employees = await prisma.employee.findMany({
    where: { employmentType: "full_time", status: "active" },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-navy">正社員給与入力</h1>
        <p className="text-sm text-muted-foreground">
          正社員の給与はCSV取込を使わず、ここで直接入力します。基本給・通勤手当・インセンティブは一度入力すると翌月以降も同じ金額を引き継ぎます(変更があった月だけ直してください)。出勤日数は毎月入力してください。
        </p>
      </div>
      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          雇用形態が「正社員」の従業員がまだ登録されていません。従業員マスタで雇用形態を「正社員」に設定してください。
        </p>
      ) : (
        <SalariedPayrollManager targetMonth={targetMonth} />
      )}
    </div>
  );
}
