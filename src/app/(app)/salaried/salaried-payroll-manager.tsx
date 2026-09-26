"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatYen } from "@/lib/format";
import { rememberTargetMonth } from "@/lib/targetMonth";

type Item = {
  employeeId: string;
  name: string;
  employeeNumber: string | null;
  recordId: string | null;
  isConfirmed: boolean;
  payDate: string;
  workDays: number;
  baseSalary: number;
  commuteAllowance: number;
  incentive: number;
  totalPayment: number | null;
};

type Row = {
  workDays: number;
  baseSalary: number;
  commuteAllowance: number;
  incentive: number;
};

type Status = { message: string; tone: "ok" | "error" };

export function SalariedPayrollManager({ targetMonth }: { targetMonth: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [payDate, setPayDate] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [statusById, setStatusById] = useState<Record<string, Status>>({});
  const [saveAllStatus, setSaveAllStatus] = useState<Status | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/salaried-payroll?targetMonth=${targetMonth}`);
    const data = await res.json();
    const nextItems: Item[] = data.items ?? [];
    setItems(nextItems);
    const nextRows: Record<string, Row> = {};
    let foundPayDate = "";
    for (const item of nextItems) {
      nextRows[item.employeeId] = {
        workDays: item.workDays,
        baseSalary: item.baseSalary,
        commuteAllowance: item.commuteAllowance,
        incentive: item.incentive,
      };
      if (!foundPayDate && item.payDate) foundPayDate = item.payDate;
    }
    setRows(nextRows);
    setPayDate(foundPayDate);
    setStatusById({});
    setSaveAllStatus(null);
    setLoading(false);
  }

  useEffect(() => {
    // 対象年月が変わるたびに最新データを取得する(意図的な同期setState)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMonth]);

  function handleMonthChange(month: string) {
    rememberTargetMonth(month);
    router.push(`/salaried?month=${month}`);
  }

  function updateRow(employeeId: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }));
  }

  async function saveOne(employeeId: string): Promise<boolean> {
    const row = rows[employeeId];
    const res = await fetch("/api/salaried-payroll", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        targetMonth,
        payDate,
        workDays: row.workDays,
        baseSalary: row.baseSalary,
        commuteAllowance: row.commuteAllowance,
        incentive: row.incentive,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusById((prev) => ({
        ...prev,
        [employeeId]: { message: data.error ?? "保存に失敗しました", tone: "error" },
      }));
      return false;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.employeeId === employeeId
          ? {
              ...it,
              recordId: data.record.id,
              isConfirmed: data.record.isConfirmed,
              totalPayment: data.record.totalPayment,
            }
          : it
      )
    );
    setStatusById((prev) => ({ ...prev, [employeeId]: { message: "保存しました", tone: "ok" } }));
    return true;
  }

  async function handleSave(employeeId: string) {
    if (!payDate) {
      setStatusById((prev) => ({
        ...prev,
        [employeeId]: { message: "支給日を入力してください", tone: "error" },
      }));
      return;
    }
    setSavingId(employeeId);
    try {
      await saveOne(employeeId);
    } catch {
      setStatusById((prev) => ({
        ...prev,
        [employeeId]: { message: "通信エラーのため保存できませんでした", tone: "error" },
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveAll() {
    if (!payDate) {
      setSaveAllStatus({ message: "支給日を入力してください", tone: "error" });
      return;
    }
    setSavingAll(true);
    setSaveAllStatus(null);
    let success = 0;
    let failed = 0;
    for (const item of items) {
      if (item.isConfirmed) continue;
      try {
        const ok = await saveOne(item.employeeId);
        if (ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setSavingAll(false);
    setSaveAllStatus({
      message:
        failed > 0
          ? `${success}件を保存しました(${failed}件は失敗しました)`
          : `${success}件をすべて保存しました`,
      tone: failed > 0 ? "error" : "ok",
    });
  }

  const busy = savingId !== null || savingAll;

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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">支給日</label>
          <Input
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="w-48"
          />
        </div>
        <Button onClick={handleSaveAll} disabled={busy || items.length === 0}>
          {savingAll ? "全員分を保存中..." : "全員分を保存"}
        </Button>
      </div>
      {saveAllStatus && (
        <p className={saveAllStatus.tone === "ok" ? "text-sm text-result-field-border" : "text-sm text-destructive"}>
          {saveAllStatus.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>出勤日数</TableHead>
              <TableHead>基本給</TableHead>
              <TableHead>通勤手当</TableHead>
              <TableHead>インセンティブ</TableHead>
              <TableHead>総支給額</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>保存</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  読み込み中...
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((item) => {
                const row = rows[item.employeeId];
                const total = row.baseSalary + row.commuteAllowance + row.incentive;
                const status = statusById[item.employeeId];
                return (
                  <TableRow key={item.employeeId} className={item.isConfirmed ? "bg-result-field" : undefined}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.workDays}
                        disabled={item.isConfirmed}
                        onChange={(e) =>
                          updateRow(item.employeeId, { workDays: Number(e.target.value) || 0 })
                        }
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.baseSalary}
                        disabled={item.isConfirmed}
                        onChange={(e) =>
                          updateRow(item.employeeId, { baseSalary: Number(e.target.value) || 0 })
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.commuteAllowance}
                        disabled={item.isConfirmed}
                        onChange={(e) =>
                          updateRow(item.employeeId, { commuteAllowance: Number(e.target.value) || 0 })
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.incentive}
                        disabled={item.isConfirmed}
                        onChange={(e) =>
                          updateRow(item.employeeId, { incentive: Number(e.target.value) || 0 })
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell className="bg-result-field font-semibold tabular-nums">
                      {formatYen(total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {item.isConfirmed ? (
                          <Badge variant="success">確定済み</Badge>
                        ) : (
                          <Badge variant="secondary">未確定</Badge>
                        )}
                        {item.isConfirmed && (
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            修正するには給与計算確認画面で確定解除してください
                          </p>
                        )}
                        {status && (
                          <p
                            className={
                              "text-[11px] leading-snug " +
                              (status.tone === "ok" ? "text-result-field-border" : "text-destructive")
                            }
                          >
                            {status.message}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleSave(item.employeeId)}
                        disabled={busy || item.isConfirmed}
                      >
                        {savingId === item.employeeId ? "保存中" : "保存"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  正社員が登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
