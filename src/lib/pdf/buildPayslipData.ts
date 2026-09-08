import "server-only";
import type { Employee, PayrollRecord } from "@prisma/client";
import { formatMonth, formatDateJp } from "@/lib/format";
import type { PayslipData } from "./payslipDocument";

const COMPANY_NAME = "THE MOR";

export function buildPayslipData(
  record: PayrollRecord,
  employee: Employee
): PayslipData {
  return {
    companyName: COMPANY_NAME,
    targetMonthLabel: formatMonth(record.targetMonth),
    payDateLabel: formatDateJp(record.payDate),
    employeeNumber: employee.employeeNumber,
    employeeName: employee.name,
    workDays: record.workDays,
    workMinutes: record.workMinutes,
    overtimeMinutes: record.overtimeMinutes,
    nightMinutes: record.nightMinutes,
    baseSalary: record.baseSalary,
    overtimeAllowance: record.overtimeAllowance,
    nightAllowance: record.nightAllowance,
    commuteAllowance: record.commuteAllowance,
    otherAllowance: record.otherAllowance,
    totalPayment: record.totalPayment,
    healthInsurance: record.healthInsurance,
    careInsurance: record.careInsurance,
    pensionInsurance: record.pensionInsurance,
    employmentInsurance: record.employmentInsurance,
    incomeTax: record.incomeTax,
    residentTax: record.residentTax,
    otherDeduction: record.otherDeduction,
    otherDeductionLabel: record.otherDeductionLabel,
    totalDeduction: record.totalDeduction,
    netPayment: record.netPayment,
    remarks: record.remarks,
  };
}

export { COMPANY_NAME };
