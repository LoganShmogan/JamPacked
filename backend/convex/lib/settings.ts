import { Doc } from "../_generated/dataModel";

export const DEFAULT_SETTINGS = {
  jurisdiction: "NZ" as const,
  // NZ MPI Food Control Plan & FSANZ Std 3.2.2 cl.5: chilled ≤5°C, hot ≥60°C, frozen received frozen hard.
  chilledMaxC: 5,
  frozenMaxC: -15,
  hotMinC: 60,
  expiryWarningDays: 3,
};

/** Temperature limits and alerts now live on each business. */
export type Settings = Pick<Doc<"businesses">, "chilledMaxC" | "frozenMaxC" | "hotMinC" | "expiryWarningDays">;

/** null when the storage type has no temperature requirement. */
export function isTempCompliant(
  s: Settings,
  storage: "chilled" | "frozen" | "hot" | "ambient",
  tempC: number | undefined,
): boolean | null {
  if (storage === "ambient") return null;
  if (tempC === undefined) return false; // required but not recorded
  if (storage === "chilled") return tempC <= s.chilledMaxC;
  if (storage === "frozen") return tempC <= s.frozenMaxC;
  return tempC >= s.hotMinC;
}

export function unitCompliant(
  s: Settings,
  unitType: "chiller" | "freezer" | "hot_hold" | "cooking" | "cooling",
  tempC: number,
) {
  switch (unitType) {
    case "chiller":
      return tempC <= s.chilledMaxC;
    case "freezer":
      return tempC <= s.frozenMaxC;
    case "hot_hold":
      return tempC >= s.hotMinC;
    case "cooking":
      return tempC >= 75; // MPI: cook to 75°C core
    case "cooling":
      return tempC <= 21; // 2-stage cooling: ≤21°C within 2h, ≤5°C within further 4h
  }
}
