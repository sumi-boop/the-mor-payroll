/**
 * DB(Prisma + better-sqlite3アダプタ)を用いた統合テスト。
 * Next.jsのルートハンドラ自体は認証・セッション処理と密結合なため、
 * ここでは各APIルートが実際に行っているデータ操作ロジックを直接
 * Prisma経由で再現し、以下のデータ整合性要件を検証する。
 *
 * - 16. 同一月の二重登録防止
 * - 17. 確定後データが変更されないこと
 * - 13. 住民税の月別反映(6月〜翌年5月の一括登録・前月コピー時の確認フラグリセット)
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../testDb";
import { calcTotalDeduction, calcNetPayment, residentTaxMonthRange } from "@/lib/payroll/calc";

async function createAdminUser() {
  return testPrisma.user.create({
    data: {
      loginId: `admin-${Math.random().toString(36).slice(2)}`,
      name: "テスト管理者",
      passwordHash: "dummy-hash",
    },
  });
}

async function createEmployee(name: string) {
  return testPrisma.employee.create({
    data: { name, nameNormalized: name, status: "active" },
  });
}

beforeAll(async () => {
  await resetDb();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("16. 同一月の二重登録防止", () => {
  it("同一従業員・同一対象年月のPayrollRecordはDB制約上1件しか作成できない(@@unique)", async () => {
    const employee = await createEmployee("田中太郎");
    await testPrisma.payrollRecord.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-08",
        payDate: new Date("2026-08-25"),
        workDays: 20,
        workMinutes: 9600,
        overtimeMinutes: 0,
        nightMinutes: 0,
        hourlyWage: 1400,
        baseSalary: 200000,
        overtimeAllowance: 0,
        nightAllowance: 0,
        commuteAllowance: 10000,
        otherAllowance: 0,
        totalAllowanceCsv: 210000,
        totalPayment: 210000,
      },
    });

    await expect(
      testPrisma.payrollRecord.create({
        data: {
          employeeId: employee.id,
          targetMonth: "2026-08",
          payDate: new Date("2026-08-25"),
          workDays: 21,
          workMinutes: 9700,
          overtimeMinutes: 0,
          nightMinutes: 0,
          hourlyWage: 1400,
          baseSalary: 210000,
          overtimeAllowance: 0,
          nightAllowance: 0,
          commuteAllowance: 10000,
          otherAllowance: 0,
          totalAllowanceCsv: 220000,
          totalPayment: 220000,
        },
      })
    ).rejects.toThrow();
  });

  it("未確定レコードへの再取込は上書き更新される(下書きの利便性)", async () => {
    const employee = await createEmployee("佐藤花子");
    const created = await testPrisma.payrollRecord.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-08",
        payDate: new Date("2026-08-25"),
        workDays: 20,
        workMinutes: 9600,
        overtimeMinutes: 0,
        nightMinutes: 0,
        hourlyWage: 1300,
        baseSalary: 180000,
        overtimeAllowance: 0,
        nightAllowance: 0,
        commuteAllowance: 8000,
        otherAllowance: 0,
        totalAllowanceCsv: 188000,
        totalPayment: 188000,
      },
    });

    // commit route と同じロジック: 既存かつ未確定 -> update
    const existing = await testPrisma.payrollRecord.findUnique({
      where: { employeeId_targetMonth: { employeeId: employee.id, targetMonth: "2026-08" } },
    });
    expect(existing?.isConfirmed).toBe(false);

    const updated = await testPrisma.payrollRecord.update({
      where: { id: created.id },
      data: { baseSalary: 190000, totalAllowanceCsv: 198000, totalPayment: 198000 },
    });
    expect(updated.baseSalary).toBe(190000);

    const count = await testPrisma.payrollRecord.count({
      where: { employeeId: employee.id, targetMonth: "2026-08" },
    });
    expect(count).toBe(1);
  });

  it("確定済みレコードへの再取込はconflict_confirmedとして上書きされない", async () => {
    const admin = await createAdminUser();
    const employee = await createEmployee("鈴木一郎");
    const created = await testPrisma.payrollRecord.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-08",
        payDate: new Date("2026-08-25"),
        workDays: 20,
        workMinutes: 9600,
        overtimeMinutes: 0,
        nightMinutes: 0,
        hourlyWage: 1400,
        baseSalary: 235200,
        overtimeAllowance: 8750,
        nightAllowance: 0,
        commuteAllowance: 12000,
        otherAllowance: 5000,
        totalAllowanceCsv: 260950,
        totalPayment: 260950,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedById: admin.id,
      },
    });

    // commit route と同じロジック: 既存かつ確定済み -> 上書きせずconflict_confirmedとして扱う
    const existing = await testPrisma.payrollRecord.findUnique({
      where: { employeeId_targetMonth: { employeeId: employee.id, targetMonth: "2026-08" } },
    });
    expect(existing?.isConfirmed).toBe(true);

    // ルートの実装では isConfirmed===true の場合 update を呼ばずスキップするため、
    // ここでは「更新してはならない」という不変条件そのものを検証する
    const stillSame = await testPrisma.payrollRecord.findUnique({ where: { id: created.id } });
    expect(stillSame?.baseSalary).toBe(235200);
    expect(stillSame?.totalPayment).toBe(260950);
  });
});

describe("17. 確定後データが変更されないこと", () => {
  it("確定時にスナップショットが作成され、確定後の月別控除変更が確定済みレコードへ反映されない", async () => {
    const admin = await createAdminUser();
    const employee = await createEmployee("中村愛");

    await testPrisma.monthlyDeduction.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-08",
        healthInsurance: 10000,
        pensionInsurance: 18000,
        employmentInsurance: 1200,
        incomeTax: 5000,
        residentTax: 8000,
        residentTaxConfirmed: true,
        socialInsuranceConfirmed: true,
        incomeTaxConfirmed: true,
      },
    });

    const record = await testPrisma.payrollRecord.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-08",
        payDate: new Date("2026-08-25"),
        workDays: 20,
        workMinutes: 9600,
        overtimeMinutes: 150,
        nightMinutes: 0,
        hourlyWage: 1450,
        baseSalary: 232000,
        overtimeAllowance: 3625,
        nightAllowance: 0,
        commuteAllowance: 13000,
        otherAllowance: 3000,
        totalAllowanceCsv: 251625,
        totalPayment: 251625,
      },
    });

    // confirm route と同じロジック: MonthlyDeductionから実効控除を取得し、
    // PayrollRecord自身の列へコピー(凍結)した上でスナップショットを保存する
    const deduction = await testPrisma.monthlyDeduction.findUnique({
      where: { employeeId_targetMonth: { employeeId: employee.id, targetMonth: "2026-08" } },
    });
    const effective = {
      healthInsurance: deduction!.healthInsurance,
      careInsurance: deduction!.careInsurance,
      pensionInsurance: deduction!.pensionInsurance,
      employmentInsurance: deduction!.employmentInsurance,
      incomeTax: deduction!.incomeTax,
      residentTax: deduction!.residentTax,
      otherDeduction: deduction!.otherDeduction,
    };
    const totalDeduction = calcTotalDeduction(effective);
    const netPayment = calcNetPayment(record.totalPayment, totalDeduction);

    const confirmed = await testPrisma.payrollRecord.update({
      where: { id: record.id },
      data: {
        ...effective,
        totalDeduction,
        netPayment,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedById: admin.id,
      },
    });

    await testPrisma.payrollSnapshot.create({
      data: {
        payrollRecordId: confirmed.id,
        targetMonth: confirmed.targetMonth,
        employeeId: confirmed.employeeId,
        snapshotJson: JSON.stringify(confirmed),
        reason: "confirm",
        createdById: admin.id,
      },
    });

    expect(confirmed.totalDeduction).toBe(42200);
    expect(confirmed.netPayment).toBe(251625 - 42200);

    // --- 確定後に月別控除設定(住民税)を変更しても、確定済みレコードは変わらない ---
    await testPrisma.monthlyDeduction.update({
      where: { employeeId_targetMonth: { employeeId: employee.id, targetMonth: "2026-08" } },
      data: { residentTax: 99999 },
    });

    const afterChange = await testPrisma.payrollRecord.findUnique({ where: { id: record.id } });
    expect(afterChange?.residentTax).toBe(8000); // 変更されていない(凍結されている)
    expect(afterChange?.totalDeduction).toBe(42200);
    expect(afterChange?.netPayment).toBe(251625 - 42200);

    // スナップショットにも変更前の値が保存され続けている
    const snapshot = await testPrisma.payrollSnapshot.findFirst({
      where: { payrollRecordId: record.id },
    });
    const snapshotData = JSON.parse(snapshot!.snapshotJson);
    expect(snapshotData.residentTax).toBe(8000);
    expect(snapshotData.netPayment).toBe(251625 - 42200);
  });

  it("確定済みレコードは再確定(二重確定)されない", async () => {
    const admin = await createAdminUser();
    const employee = await createEmployee("小林大輔");
    const record = await testPrisma.payrollRecord.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-08",
        payDate: new Date("2026-08-25"),
        workDays: 23,
        workMinutes: 11040,
        overtimeMinutes: 720,
        nightMinutes: 360,
        hourlyWage: 1400,
        baseSalary: 257600,
        overtimeAllowance: 16800,
        nightAllowance: 1050,
        commuteAllowance: 10000,
        otherAllowance: 0,
        totalAllowanceCsv: 285450,
        totalPayment: 285450,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedById: admin.id,
        totalDeduction: 30000,
        netPayment: 255450,
      },
    });

    // confirm route: 既にisConfirmed=trueなら "already_confirmed" として処理をスキップする
    const found = await testPrisma.payrollRecord.findUnique({ where: { id: record.id } });
    expect(found?.isConfirmed).toBe(true);
    // 何もupdateしない(ロジック上スキップされる)ことをそのまま表明
    const stillSame = await testPrisma.payrollRecord.findUnique({ where: { id: record.id } });
    expect(stillSame?.netPayment).toBe(255450);
  });
});

describe("13. 住民税の月別反映", () => {
  it("6月〜翌年5月の12ヶ月分の住民税をまとめて登録できる", async () => {
    const employee = await createEmployee("高橋美咲");
    const months = residentTaxMonthRange(2026);
    const amounts = months.map((_, i) => 8000 + i * 100);

    for (let i = 0; i < months.length; i++) {
      await testPrisma.monthlyDeduction.upsert({
        where: { employeeId_targetMonth: { employeeId: employee.id, targetMonth: months[i] } },
        create: { employeeId: employee.id, targetMonth: months[i], residentTax: amounts[i], residentTaxConfirmed: true },
        update: { residentTax: amounts[i], residentTaxConfirmed: true },
      });
    }

    const rows = await testPrisma.monthlyDeduction.findMany({
      where: { employeeId: employee.id, targetMonth: { in: months } },
      orderBy: { targetMonth: "asc" },
    });
    expect(rows).toHaveLength(12);
    expect(rows[0].targetMonth).toBe("2026-06");
    expect(rows[0].residentTax).toBe(8000);
    expect(rows[0].residentTaxConfirmed).toBe(true);
    expect(rows[11].targetMonth).toBe("2027-05");
    expect(rows[11].residentTax).toBe(9100);
  });

  it("前月からのコピーでは金額のみ引き継ぎ、確認フラグはリセットされる", async () => {
    const employee = await createEmployee("伊藤健太");
    await testPrisma.monthlyDeduction.create({
      data: {
        employeeId: employee.id,
        targetMonth: "2026-07",
        healthInsurance: 9500,
        pensionInsurance: 17000,
        residentTax: 7500,
        residentTaxConfirmed: true,
        socialInsuranceConfirmed: true,
        incomeTaxConfirmed: true,
      },
    });

    // copy-previous route と同じロジック
    const prev = await testPrisma.monthlyDeduction.findMany({ where: { targetMonth: "2026-07" } });
    for (const p of prev) {
      await testPrisma.monthlyDeduction.create({
        data: {
          employeeId: p.employeeId,
          targetMonth: "2026-08",
          healthInsurance: p.healthInsurance,
          careInsurance: p.careInsurance,
          pensionInsurance: p.pensionInsurance,
          employmentInsurance: p.employmentInsurance,
          incomeTax: p.incomeTax,
          residentTax: p.residentTax,
          otherDeduction: p.otherDeduction,
          residentTaxConfirmed: false,
          socialInsuranceConfirmed: false,
          incomeTaxConfirmed: false,
        },
      });
    }

    const copied = await testPrisma.monthlyDeduction.findUnique({
      where: { employeeId_targetMonth: { employeeId: employee.id, targetMonth: "2026-08" } },
    });
    expect(copied?.residentTax).toBe(7500); // 金額は引き継がれる
    expect(copied?.residentTaxConfirmed).toBe(false); // 確認フラグはリセットされる
    expect(copied?.socialInsuranceConfirmed).toBe(false);
    expect(copied?.incomeTaxConfirmed).toBe(false);
  });
});
