import { prisma } from "@/lib/db";
import { EmployeeManager } from "./employee-manager";

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });

  const serializable = employees.map((e) => ({
    ...e,
    birthDate: e.birthDate?.toISOString() ?? null,
    hireDate: e.hireDate?.toISOString() ?? null,
    resignDate: e.resignDate?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-navy">従業員マスタ</h1>
        <p className="text-sm text-muted-foreground">
          従業員の基本情報・社会保険加入状況・扶養情報などを管理します。個人番号(マイナンバー)は保存しません。
        </p>
      </div>
      <EmployeeManager initialEmployees={serializable} />
    </div>
  );
}
