import { z } from "zod";

export const DeductionInputSchema = z.object({
  employeeId: z.string().min(1),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
  healthInsurance: z.number().int().default(0),
  careInsurance: z.number().int().default(0),
  pensionInsurance: z.number().int().default(0),
  employmentInsurance: z.number().int().default(0),
  incomeTax: z.number().int().default(0),
  residentTax: z.number().int().default(0),
  otherDeduction: z.number().int().default(0),
  otherDeductionLabel: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  residentTaxConfirmed: z.boolean().default(false),
  socialInsuranceConfirmed: z.boolean().default(false),
  incomeTaxConfirmed: z.boolean().default(false),
});

export type DeductionInput = z.infer<typeof DeductionInputSchema>;

export const ResidentTaxBulkSchema = z.object({
  employeeId: z.string().min(1),
  startYear: z.number().int(),
  amounts: z.array(z.number().int()).length(12), // 6月始まり12ヶ月分
});
