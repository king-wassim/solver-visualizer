import { z } from "zod";

/**
 * Schéma JSON unifié pour tout problème de Programmation Linéaire.
 * Conçu pour être agnostique au type de problème (transport, production, mix, etc.)
 * et compatible avec un solveur GLPK (continu, entier, mixte, binaire).
 */

export const VariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["continuous", "integer", "binary"]).default("continuous"),
  lb: z.number().nullable().optional(), // borne inférieure (null = -inf)
  ub: z.number().nullable().optional(), // borne supérieure (null = +inf)
  description: z.string().optional(),
});

export const ConstraintSchema = z.object({
  name: z.string().optional(),
  // Coefficients indexés par nom de variable. Variables absentes = coefficient 0.
  coefficients: z.record(z.string(), z.number()),
  operator: z.enum(["<=", ">=", "="]),
  rhs: z.number(),
  description: z.string().optional(),
});

export const ObjectiveSchema = z.object({
  coefficients: z.record(z.string(), z.number()),
  constant: z.number().optional(),
});

export const LPModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sense: z.enum(["max", "min"]),
  variables: z.array(VariableSchema).min(1),
  objective: ObjectiveSchema,
  constraints: z.array(ConstraintSchema),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type Variable = z.infer<typeof VariableSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type LPModel = z.infer<typeof LPModelSchema>;

export type SolveStatus =
  | "optimal"
  | "feasible"
  | "infeasible"
  | "unbounded"
  | "undefined"
  | "error";

export interface ConstraintResult {
  name: string;
  lhs: number;
  rhs: number;
  operator: "<=" | ">=" | "=";
  slack: number;
  saturated: boolean;
  dual?: number;
}

export interface VariableResult {
  name: string;
  value: number;
  reducedCost?: number;
}

export interface SolveResult {
  status: SolveStatus;
  objective: number;
  variables: VariableResult[];
  constraints: ConstraintResult[];
  durationMs: number;
  message?: string;
}
