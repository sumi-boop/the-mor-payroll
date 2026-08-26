"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Employee = {
  id: string;
  name: string;
  kana: string | null;
  employeeNumber: string | null;
  postalCode: string | null;
  address: string | null;
  birthDate: string | null;
  hireDate: string | null;
  resignDate: string | null;
  status: string;
  payType: string;
  socialInsurance: boolean;
  careInsurance: boolean;
  employmentInsurance: boolean;
  standardMonthlyRemuneration: number | null;
  dependentFormSubmitted: boolean;
  dependentCount: number;
  taxWithholdingType: string;
  bankInfo: string | null;
  remarks: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "在籍",
  resigned: "退職",
  leave: "休職",
};

const emptyForm: Omit<Employee, "id"> = {
  name: "",
  kana: "",
  employeeNumber: "",
  postalCode: "",
  address: "",
  birthDate: "",
  hireDate: "",
  resignDate: "",
  status: "active",
  payType: "hourly",
  socialInsurance: false,
  careInsurance: false,
  employmentInsurance: false,
  standardMonthlyRemuneration: null,
  dependentFormSubmitted: false,
  dependentCount: 0,
  taxWithholdingType: "kou",
  bankInfo: "",
  remarks: "",
};

export function EmployeeManager({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Employee, "id">>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id);
    setForm({ ...emp, birthDate: toDateInput(emp.birthDate), hireDate: toDateInput(emp.hireDate), resignDate: toDateInput(emp.resignDate) });
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      standardMonthlyRemuneration:
        form.standardMonthlyRemuneration === null || Number.isNaN(form.standardMonthlyRemuneration)
          ? null
          : Number(form.standardMonthlyRemuneration),
      dependentCount: Number(form.dependentCount) || 0,
    };
    try {
      const res = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        setSaving(false);
        return;
      }
      if (editingId) {
        setEmployees((prev) => prev.map((e) => (e.id === editingId ? data.employee : e)));
      } else {
        setEmployees((prev) => [...prev, data.employee].sort((a, b) => a.name.localeCompare(b.name, "ja")));
      }
      setOpen(false);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>+ 従業員を追加</Button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>従業員番号</TableHead>
              <TableHead>在籍状況</TableHead>
              <TableHead>社会保険</TableHead>
              <TableHead>雇用保険</TableHead>
              <TableHead>源泉区分</TableHead>
              <TableHead>扶養人数</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>{emp.employeeNumber ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={emp.status === "active" ? "success" : "secondary"}>
                    {STATUS_LABEL[emp.status] ?? emp.status}
                  </Badge>
                </TableCell>
                <TableCell>{emp.socialInsurance ? "加入" : "未加入"}</TableCell>
                <TableCell>{emp.employmentInsurance ? "加入" : "未加入"}</TableCell>
                <TableCell>{emp.taxWithholdingType === "kou" ? "甲欄" : "乙欄"}</TableCell>
                <TableCell>{emp.dependentCount}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => openEdit(emp)}>
                    編集
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  従業員が登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "従業員情報を編集" : "従業員を追加"}</DialogTitle>
          </DialogHeader>
          {error && <p className="text-sm text-error-text">{error}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="氏名" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="フリガナ">
              <Input value={form.kana ?? ""} onChange={(e) => setForm((f) => ({ ...f, kana: e.target.value }))} />
            </Field>
            <Field label="従業員番号">
              <Input
                value={form.employeeNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, employeeNumber: e.target.value }))}
              />
            </Field>
            <Field label="郵便番号">
              <Input
                value={form.postalCode ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </Field>
            <Field label="住所" full>
              <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Field>
            <Field label="生年月日">
              <Input
                type="date"
                value={form.birthDate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
            </Field>
            <Field label="入社日">
              <Input
                type="date"
                value={form.hireDate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
              />
            </Field>
            <Field label="退職日">
              <Input
                type="date"
                value={form.resignDate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, resignDate: e.target.value }))}
              />
            </Field>
            <Field label="在籍状況">
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">在籍</SelectItem>
                  <SelectItem value="leave">休職</SelectItem>
                  <SelectItem value="resigned">退職</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="給与区分">
              <Select value={form.payType} onValueChange={(v) => setForm((f) => ({ ...f, payType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">時給制</SelectItem>
                  <SelectItem value="monthly">月給制</SelectItem>
                  <SelectItem value="daily">日給制</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="源泉徴収区分">
              <Select
                value={form.taxWithholdingType}
                onValueChange={(v) => setForm((f) => ({ ...f, taxWithholdingType: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kou">甲欄</SelectItem>
                  <SelectItem value="otsu">乙欄</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="標準報酬月額">
              <Input
                type="number"
                value={form.standardMonthlyRemuneration ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    standardMonthlyRemuneration: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="扶養親族等の人数">
              <Input
                type="number"
                min={0}
                value={form.dependentCount}
                onChange={(e) => setForm((f) => ({ ...f, dependentCount: Number(e.target.value) || 0 }))}
              />
            </Field>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <CheckField
                label="社会保険加入"
                checked={form.socialInsurance}
                onChange={(v) => setForm((f) => ({ ...f, socialInsurance: v }))}
              />
              <CheckField
                label="介護保険対象(40歳以上65歳未満等)"
                checked={form.careInsurance}
                onChange={(v) => setForm((f) => ({ ...f, careInsurance: v }))}
              />
              <CheckField
                label="雇用保険加入"
                checked={form.employmentInsurance}
                onChange={(v) => setForm((f) => ({ ...f, employmentInsurance: v }))}
              />
              <CheckField
                label="扶養控除等申告書 提出あり"
                checked={form.dependentFormSubmitted}
                onChange={(v) => setForm((f) => ({ ...f, dependentFormSubmitted: v }))}
              />
            </div>
            <Field label="振込先情報" full>
              <Textarea
                value={form.bankInfo ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, bankInfo: e.target.value }))}
                rows={2}
              />
            </Field>
            <Field label="備考" full>
              <Textarea
                value={form.remarks ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>
        {label}
        {required && <span className="ml-1 text-error-text">*</span>}
      </Label>
      {children}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      {label}
    </label>
  );
}

