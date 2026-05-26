import { z } from 'zod';

export const loginSchema = z.object({ user: z.string().min(1), pass: z.string().min(1) });

export const clientSchema = z.object({
  cpf: z.string().min(11),
  nome: z.string().min(2),
  telefone: z.string().min(8),
  cep: z.string().optional().nullable(),
  rua: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  indicacao: z.string().optional().nullable(),
  obs: z.string().optional().nullable(),
  optin_whatsapp: z.boolean().optional(),
  oculto_lista: z.boolean().optional()
});

export const loanSchema = z.object({
  client_id: z.number(),
  label: z.string().optional().nullable(),
  data_emprestimo: z.string().min(8),
  data_pagamento_base: z.string().min(8),
  valor_emprestimo: z.number().positive(),
  juros_percent: z.number().positive(),
  cobrar_auto: z.boolean().optional(),
  ativo: z.boolean().optional()
});

export const loanUpdateSchema = loanSchema.partial().extend({ client_id: z.number().optional() });

export const paymentSchema = z.object({
  loan_id: z.number(),
  data_pagamento: z.string().min(8),
  valor_pago: z.number().positive(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

export const visibilitySchema = z.object({ hidden: z.boolean() });

export const agreementCreateSchema = z.object({ loan_id: z.number() });
export const agreementUpdateSchema = z.object({
  installment_count: z.number().int().min(1).max(240),
  installment_amount: z.number().positive(),
  first_due_date: z.string().min(8),
  auto_charge: z.boolean().optional(),
  active: z.boolean().optional()
});
export const agreementSettingsSchema = z.object({ auto_charge: z.boolean().optional(), active: z.boolean().optional() });
export const agreementPaySchema = z.object({ data_pagamento: z.string().min(8), valor_pago: z.number().positive() });
