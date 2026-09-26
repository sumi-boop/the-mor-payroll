import { z } from "zod";

export const SalariedPayrollInputSchema = z.object({
  employeeId: z.string().min(1),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
  payDate: z.string().min(1, "支給日は必須です"),
  workDays: z.number().int().min(0).default(0),
  baseSalary: z.number().int().min(0).default(0),
  commuteAllowance: z.number().int().min(0).default(0),
  incentive: z.number().int().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

export type SalariedPayrollInput = z.infer<typeof SalariedPayrollInputSchema>;
