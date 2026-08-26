import { z } from "zod";

export const EmployeeInputSchema = z.object({
  name: z.string().min(1, "氏名は必須です"),
  kana: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(), // ISO date string
  hireDate: z.string().optional().nullable(),
  resignDate: z.string().optional().nullable(),
  status: z.enum(["active", "resigned", "leave"]).default("active"),
  payType: z.string().default("hourly"),
  socialInsurance: z.boolean().default(false),
  careInsurance: z.boolean().default(false),
  employmentInsurance: z.boolean().default(false),
  standardMonthlyRemuneration: z.number().int().nullable().optional(),
  dependentFormSubmitted: z.boolean().default(false),
  dependentCount: z.number().int().min(0).default(0),
  taxWithholdingType: z.enum(["kou", "otsu"]).default("kou"),
  bankInfo: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type EmployeeInput = z.infer<typeof EmployeeInputSchema>;
