/**
 * Solveur PL basé sur glpk.js (WebAssembly).
 * Fonctionne côté client et serveur (GLPK WASM + Node.js compatible).
 * Le solveur est chargé en lazy-loading ; aucune exécution au niveau du module.
 */
import type { LPModel, SolveResult, SolveStatus } from "./lp-schema";

let glpkPromise: Promise<any> | null = null;

async function getGLPK(): Promise<any> {
  if (!glpkPromise) {
    glpkPromise = import("glpk.js").then((m: any) => {
      const factory = m.default ?? m;
      return typeof factory === "function" ? factory() : factory;
    });
  }
  return glpkPromise;
}

function statusFromGlpk(glpk: any, code: number): SolveStatus {
  if (code === glpk.GLP_OPT) return "optimal";
  if (code === glpk.GLP_FEAS) return "feasible";
  if (code === glpk.GLP_INFEAS || code === glpk.GLP_NOFEAS) return "infeasible";
  if (code === glpk.GLP_UNBND) return "unbounded";
  return "undefined";
}

export async function solveLP(model: LPModel): Promise<SolveResult> {
  const t0 = performance.now();
  try {
    const glpk = await getGLPK();

    const vars = model.variables.map((v) => ({
      name: v.name,
      coef: model.objective.coefficients[v.name] ?? 0,
    }));

    const subjectTo = model.constraints.map((c, idx) => {
      const op = c.operator;
      const bnds =
        op === "<="
          ? { type: glpk.GLP_UP, ub: c.rhs, lb: 0 }
          : op === ">="
          ? { type: glpk.GLP_LO, lb: c.rhs, ub: 0 }
          : { type: glpk.GLP_FX, lb: c.rhs, ub: c.rhs };
      return {
        name: c.name || `c${idx + 1}`,
        vars: model.variables
          .map((v) => ({ name: v.name, coef: c.coefficients[v.name] ?? 0 }))
          .filter((x) => x.coef !== 0),
        bnds,
      };
    });

    const bounds = model.variables
      .filter((v) => v.lb != null || v.ub != null)
      .map((v) => {
        const lb = v.lb ?? -Infinity;
        const ub = v.ub ?? Infinity;
        let type = glpk.GLP_FR;
        if (lb !== -Infinity && ub !== Infinity) type = lb === ub ? glpk.GLP_FX : glpk.GLP_DB;
        else if (lb !== -Infinity) type = glpk.GLP_LO;
        else if (ub !== Infinity) type = glpk.GLP_UP;
        return { name: v.name, type, lb: lb === -Infinity ? 0 : lb, ub: ub === Infinity ? 0 : ub };
      });

    const generals = model.variables.filter((v) => v.type === "integer").map((v) => v.name);
    const binaries = model.variables.filter((v) => v.type === "binary").map((v) => v.name);

    const lp: any = {
      name: model.id,
      objective: {
        direction: model.sense === "max" ? glpk.GLP_MAX : glpk.GLP_MIN,
        name: "obj",
        vars,
      },
      subjectTo,
    };
    if (bounds.length) lp.bounds = bounds;
    if (generals.length) lp.generals = generals;
    if (binaries.length) lp.binaries = binaries;

    const out = await glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF });
    const res = out.result;

    const status = statusFromGlpk(glpk, res.status);
    const objective = (res.z ?? 0) + (model.objective.constant ?? 0);

    const variables = model.variables.map((v) => ({
      name: v.name,
      value: res.vars?.[v.name] ?? 0,
    }));

    const constraints = model.constraints.map((c, idx) => {
      const name = c.name || `c${idx + 1}`;
      const lhs = model.variables.reduce(
        (acc, v) => acc + (c.coefficients[v.name] ?? 0) * (res.vars?.[v.name] ?? 0),
        0,
      );
      const slack =
        c.operator === "<=" ? c.rhs - lhs : c.operator === ">=" ? lhs - c.rhs : Math.abs(lhs - c.rhs);
      return {
        name,
        lhs,
        rhs: c.rhs,
        operator: c.operator,
        slack,
        saturated: Math.abs(slack) < 1e-6,
        dual: res.dual?.[name],
      };
    });

    return {
      status,
      objective,
      variables,
      constraints,
      durationMs: performance.now() - t0,
    };
  } catch (e: any) {
    return {
      status: "error",
      objective: NaN,
      variables: [],
      constraints: [],
      durationMs: performance.now() - t0,
      message: e?.message ?? String(e),
    };
  }
}
