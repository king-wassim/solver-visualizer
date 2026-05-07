import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LPModel, SolveResult } from "./lp-schema";

export type Theme = "dark" | "light" | "system";

interface AppState {
  selectedModel: LPModel | null;
  solveResult: SolveResult | null;
  compareModel1: LPModel | null;
  compareModel2: LPModel | null;
  compareResult1: SolveResult | null;
  compareResult2: SolveResult | null;
  theme: Theme;
  setSelectedModel: (model: LPModel | null) => void;
  setSolveResult: (result: SolveResult | null) => void;
  setCompareModel1: (model: LPModel | null) => void;
  setCompareModel2: (model: LPModel | null) => void;
  setCompareResult1: (result: SolveResult | null) => void;
  setCompareResult2: (result: SolveResult | null) => void;
  setTheme: (theme: Theme) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedModel: null,
      solveResult: null,
      compareModel1: null,
      compareModel2: null,
      compareResult1: null,
      compareResult2: null,
      theme: "dark",
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSolveResult: (result) => set({ solveResult: result }),
      setCompareModel1: (model) => set({ compareModel1: model }),
      setCompareModel2: (model) => set({ compareModel2: model }),
      setCompareResult1: (result) => set({ compareResult1: result }),
      setCompareResult2: (result) => set({ compareResult2: result }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "ro-studio",
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
