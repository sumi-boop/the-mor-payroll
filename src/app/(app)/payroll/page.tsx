import { resolveTargetMonth } from "@/lib/targetMonth.server";
import { PayrollManager } from "./payroll-manager";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const targetMonth = await resolveTargetMonth(sp.month);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-navy">給与計算確認画面</h1>
        <p className="text-sm text-muted-foreground">
          勤怠・支給・控除の内容を確認し、問題がなければ確定してPDFを作成します。
        </p>
      </div>
      <PayrollManager initialMonth={targetMonth} />
    </div>
  );
}
