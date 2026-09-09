"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatYen } from "@/lib/format";
import { calcTotalDeduction } from "@/lib/payroll/calc";
import { rememberTargetMonth } from "@/lib/targetMonth";

type Employee = {
  id: string;
  name: string;
  socialInsurance: boolean;
  employmentInsurance: boolean;
  taxWithholdingType: string;
  dependentFormSubmitted: boolean;
  dependentCount: number;
};

type Deduction = {
  id: string;
  employeeId: string;
  targetMonth: string;
  healthInsurance: number;
  careInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  otherDeduction: number;
  otherDeductionLabel: string | null;
  remarks: string | null;
  residentTaxConfirmed: boolean;
  socialInsuranceConfirmed: boolean;
  incomeTaxConfirmed: boolean;
};

type Row = Omit<Deduction, "id"> & { id?: string };

const FIELD_KEYS = [
  "healthInsurance",
  "careInsurance",
  "pensionInsurance",
  "employmentInsurance",
  "incomeTax",
  "residentTax",
  "otherDeduction",
] as const;

const FIELD_LABELS: Record<(typeof FIELD_KEYS)[number], string> = {
  healthInsurance: "健康保険料",
  careInsurance: "介護保険料",
  pensionInsurance: "厚生年金保険料",
  employmentInsurance: "雇用保険料",
  incomeTax: "所得税",
  residentTax: "住民税",
  otherDeduction: "その他控除",
};

export function DeductionManager({
  targetMonth,
  employees,
  deductions,
}: {
  targetMonth: string;
  employees: Employee[];
  deductions: Deduction[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const map: Record<string, Row> = {};
    for (const emp of employees) {
      const existing = deductions.find((d) => d.employeeId === emp.id);
      map[emp.id] = existing ?? {
        employeeId: emp.id,
        targetMonth,
        healthInsurance: 0,
        careInsurance: 0,
        pensionInsurance: 0,
        employmentInsurance: 0,
        incomeTax: 0,
        residentTax: 0,
        otherDeduction: 0,
        otherDeductionLabel: "",
        remarks: "",
        residentTaxConfirmed: false,
        socialInsuranceConfirmed: false,
        incomeTaxConfirmed: false,
      };
    }
    return map;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [bulkEmployee, setBulkEmployee] = useState<Employee | null>(null);
  const [estimating, setEstimating] = useState<string | null>(null);
  const [estimateStatus, setEstimateStatus] = useState<
    Record<string, { message: string; tone: "ok" | "info" | "error" }>
  >({});
  const [confirmStatus, setConfirmStatus] = useState<
    Record<string, { message: string; tone: "ok" | "error" }>
  >({});
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllMessage, setSaveAllMessage] = useState<string | null>(null);
  const [estimatingAll, setEstimatingAll] = useState(false);
  const [estimateAllMessage, setEstimateAllMessage] = useState<string | null>(null);

  const anyRowBusy = savingId !== null || estimating !== null || savingAll || estimatingAll;

  function updateRow(employeeId: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }));
  }

  // 確認チェックボックス(住民税・社保・所得税)は、他の入力項目と違い
  // トグルした瞬間にその行の内容をまるごと保存する。
  // これにより「チェックは入れたが保存ボタンを押し忘れた」ため
  // 給与計算確認画面で「未確認」警告が消えない、という事故を防ぐ。
  async function handleToggleConfirm(
    employeeId: string,
    field: "residentTaxConfirmed" | "socialInsuranceConfirmed" | "incomeTaxConfirmed",
    value: boolean
  ) {
    const previousRow = rows[employeeId];
    const nextRow = { ...previousRow, [field]: value };
    setRows((prev) => ({ ...prev, [employeeId]: nextRow }));
    setConfirmStatus((prev) => ({ ...prev, [employeeId]: undefined } as never));
    setSavingId(employeeId);
    try {
      const res = await fetch("/api/deductions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextRow),
      });
      const data = await res.json();
      if (res.ok) {
        updateRow(employeeId, data.deduction);
        setConfirmStatus((prev) => ({ ...prev, [employeeId]: { message: "保存しました", tone: "ok" } }));
      } else {
        setRows((prev) => ({ ...prev, [employeeId]: previousRow }));
        setConfirmStatus((prev) => ({
          ...prev,
          [employeeId]: { message: data.error ?? "保存に失敗しました。もう一度お試しください。", tone: "error" },
        }));
      }
    } catch {
      setRows((prev) => ({ ...prev, [employeeId]: previousRow }));
      setConfirmStatus((prev) => ({
        ...prev,
        [employeeId]: { message: "通信エラーのため保存できませんでした。もう一度お試しください。", tone: "error" },
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSave(employeeId: string) {
    setSavingId(employeeId);
    const row = rows[employeeId];
    try {
      const res = await fetch("/api/deductions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      if (res.ok) {
        updateRow(employeeId, data.deduction);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleCopyPrevious() {
    setCopying(true);
    try {
      const res = await fetch("/api/deductions/copy-previous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMonth }),
      });
      if (res.ok) {
        router.refresh();
        window.location.reload();
      }
    } finally {
      setCopying(false);
    }
  }

  function handleMonthChange(month: string) {
    rememberTargetMonth(month);
    router.push(`/deductions?month=${month}`);
  }

  // 戻り値の tone は「全員分を自動計算」でまとめて呼び出したときの
  // 集計(何件入力できて、何件スキップ/失敗したか)に使う。
  async function handleEstimateIncomeTax(
    employeeId: string
  ): Promise<{ tone: "ok" | "info" | "error" }> {
    setEstimating(employeeId);
    setEstimateStatus((prev) => ({ ...prev, [employeeId]: undefined } as never));
    const row = rows[employeeId];
    try {
      const res = await fetch("/api/deductions/income-tax-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          targetMonth,
          healthInsurance: row.healthInsurance,
          careInsurance: row.careInsurance,
          pensionInsurance: row.pensionInsurance,
          employmentInsurance: row.employmentInsurance,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEstimateStatus((prev) => ({
          ...prev,
          [employeeId]: { message: data.error ?? "計算に失敗しました", tone: "error" },
        }));
        return { tone: "error" };
      }
      if (!data.found) {
        setEstimateStatus((prev) => ({
          ...prev,
          [employeeId]: { message: data.message, tone: "info" },
        }));
        return { tone: "info" };
      }
      if (!data.supported) {
        setEstimateStatus((prev) => ({
          ...prev,
          [employeeId]: { message: data.note, tone: "info" },
        }));
        return { tone: "info" };
      }
      updateRow(employeeId, { incomeTax: data.amount });
      setEstimateStatus((prev) => ({
        ...prev,
        [employeeId]: { message: `${data.amount.toLocaleString()}円を入力しました。${data.note}`, tone: "ok" },
      }));
      return { tone: "ok" };
    } catch {
      setEstimateStatus((prev) => ({
        ...prev,
        [employeeId]: { message: "通信エラーのため計算できませんでした。", tone: "error" },
      }));
      return { tone: "error" };
    } finally {
      setEstimating(null);
    }
  }

  // 表示中の全従業員について、所得税の自動計算を順番に実行する。
  // 値はその場で入力されるだけで保存はされないため、内容を確認してから
  // 「全員分を保存」または各行の「保存」で確定すること。
  async function handleEstimateAll() {
    setEstimatingAll(true);
    setEstimateAllMessage(null);
    let filled = 0;
    let skipped = 0;
    let failed = 0;
    for (const emp of employees) {
      const result = await handleEstimateIncomeTax(emp.id);
      if (result.tone === "ok") filled++;
      else if (result.tone === "error") failed++;
      else skipped++;
    }
    setEstimatingAll(false);
    setEstimateAllMessage(
      `所得税の自動計算が完了しました: ${filled}件入力` +
        (skipped ? `、${skipped}件はスキップ(未取込・乙欄など。個別に確認してください)` : "") +
        (failed ? `、${failed}件は失敗しました` : "")
    );
  }

  // 表示中の全従業員の入力内容(金額・確認チェック)を1行ずつまとめて保存する。
  async function handleSaveAll() {
    setSavingAll(true);
    setSaveAllMessage(null);
    let success = 0;
    let failed = 0;
    for (const emp of employees) {
      const row = rows[emp.id];
      try {
        const res = await fetch("/api/deductions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        const data = await res.json();
        if (res.ok) {
          updateRow(emp.id, data.deduction);
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    setSavingAll(false);
    setSaveAllMessage(
      failed > 0
        ? `${success}件を保存しました(${failed}件は失敗しました。個別に保存し直してください)`
        : `${success}件をすべて保存しました`
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">対象年月</label>
          <Input
            type="month"
            value={targetMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-48"
          />
        </div>
        <Button variant="outline" onClick={handleCopyPrevious} disabled={copying}>
          {copying ? "コピー中..." : "前月の控除額をコピー"}
        </Button>
        <Button variant="outline" onClick={handleEstimateAll} disabled={anyRowBusy || employees.length === 0}>
          {estimatingAll ? "全員分を自動計算中..." : "全員分の所得税を自動計算"}
        </Button>
        <Button onClick={handleSaveAll} disabled={anyRowBusy || employees.length === 0}>
          {savingAll ? "全員分を保存中..." : "全員分を保存"}
        </Button>
      </div>

      {(saveAllMessage || estimateAllMessage) && (
        <div className="flex flex-col gap-1">
          {estimateAllMessage && (
            <p className="text-sm text-muted-foreground">{estimateAllMessage}</p>
          )}
          {saveAllMessage && <p className="text-sm text-muted-foreground">{saveAllMessage}</p>}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-secondary">氏名</TableHead>
              {FIELD_KEYS.map((key) => (
                <TableHead key={key}>{FIELD_LABELS[key]}</TableHead>
              ))}
              <TableHead>控除合計</TableHead>
              <TableHead>確認</TableHead>
              <TableHead>住民税一括</TableHead>
              <TableHead>保存</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => {
              const row = rows[emp.id];
              const total = calcTotalDeduction(row);
              return (
                <TableRow key={emp.id}>
                  <TableCell className="sticky left-0 bg-card font-medium">
                    {emp.name}
                    {emp.socialInsurance && (
                      <Badge variant="outline" className="ml-1">社保</Badge>
                    )}
                    {emp.employmentInsurance && (
                      <Badge variant="outline" className="ml-1">雇保</Badge>
                    )}
                  </TableCell>
                  {FIELD_KEYS.map((key) => (
                    <TableCell key={key}>
                      <Input
                        type="number"
                        value={row[key]}
                        onChange={(e) =>
                          updateRow(emp.id, { [key]: Number(e.target.value) || 0 } as Partial<Row>)
                        }
                        className="w-28"
                      />
                      {key === "incomeTax" && (
                        <div className="mt-1 flex flex-col gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleEstimateIncomeTax(emp.id)}
                            disabled={estimating === emp.id || estimatingAll || savingAll}
                          >
                            {estimating === emp.id ? "計算中..." : "自動計算"}
                          </Button>
                          {estimateStatus[emp.id] && (
                            <p
                              className={
                                "w-40 text-[11px] leading-snug " +
                                (estimateStatus[emp.id].tone === "ok"
                                  ? "text-result-field-border"
                                  : estimateStatus[emp.id].tone === "error"
                                    ? "text-destructive"
                                    : "text-muted-foreground")
                              }
                            >
                              {estimateStatus[emp.id].message}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="bg-result-field font-semibold tabular-nums">
                    {formatYen(total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="flex items-center gap-1">
                        <Checkbox
                          checked={row.residentTaxConfirmed}
                          disabled={savingId === emp.id || savingAll || estimatingAll}
                          onCheckedChange={(v) => handleToggleConfirm(emp.id, "residentTaxConfirmed", !!v)}
                        />
                        住民税
                      </label>
                      <label className="flex items-center gap-1">
                        <Checkbox
                          checked={row.socialInsuranceConfirmed}
                          disabled={savingId === emp.id || savingAll || estimatingAll}
                          onCheckedChange={(v) => handleToggleConfirm(emp.id, "socialInsuranceConfirmed", !!v)}
                        />
                        社保
                      </label>
                      <label className="flex items-center gap-1">
                        <Checkbox
                          checked={row.incomeTaxConfirmed}
                          disabled={savingId === emp.id || savingAll || estimatingAll}
                          onCheckedChange={(v) => handleToggleConfirm(emp.id, "incomeTaxConfirmed", !!v)}
                        />
                        所得税
                      </label>
                      {savingId === emp.id && (
                        <p className="text-[11px] leading-snug text-muted-foreground">保存中...</p>
                      )}
                      {savingId !== emp.id && confirmStatus[emp.id] && (
                        <p
                          className={
                            "text-[11px] leading-snug " +
                            (confirmStatus[emp.id].tone === "ok"
                              ? "text-result-field-border"
                              : "text-destructive")
                          }
                        >
                          {confirmStatus[emp.id].message}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setBulkEmployee(emp)}>
                      一括登録
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleSave(emp.id)}
                      disabled={savingId === emp.id || savingAll || estimatingAll}
                    >
                      {savingId === emp.id ? "保存中" : "保存"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {bulkEmployee && (
        <ResidentTaxBulkDialog
          employee={bulkEmployee}
          onClose={() => setBulkEmployee(null)}
        />
      )}
    </div>
  );
}

function ResidentTaxBulkDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const now = new Date();
  const defaultStartYear = now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const [startYear, setStartYear] = useState(defaultStartYear);
  const [amounts, setAmounts] = useState<number[]>(() => Array(12).fill(0));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const months = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < 12; i++) {
      const idx = 5 + i;
      const y = startYear + Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      list.push(`${y}年${m}月`);
    }
    return list;
  }, [startYear]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/deductions/resident-tax-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, startYear, amounts }),
      });
      if (res.ok) setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{employee.name} さんの住民税 一括登録(6月〜翌年5月)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          市区町村から届く「特別徴収税額決定通知書」に記載の月割額を入力してください。
        </p>
        <div className="flex items-center gap-2">
          <label className="text-sm">開始年(6月分):</label>
          <Input
            type="number"
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            className="w-28"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
          {months.map((label, i) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{label}</label>
              <Input
                type="number"
                value={amounts[i]}
                onChange={(e) => {
                  const next = [...amounts];
                  next[i] = Number(e.target.value) || 0;
                  setAmounts(next);
                }}
              />
            </div>
          ))}
        </div>
        {done && <p className="text-sm text-result-field-border">登録しました。</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "登録中..." : "一括登録する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
