/**
 * Canonical Fourth Floor constraints that are explicit enough to encode without inventing geometry.
 */
export const CANONICAL_STAIRWELL_COUNT = 9_375;
export const PRIMARY_STAIRWELL_STATIONS = [12, 24, 36, 48, 72] as const;
export const DOCUMENTED_TEN_PLATFORM_STATIONS = [24, 36, 48] as const;
export const HIDDEN_STAIRWELL_STATION = 433;
export const STATION_24_STAIRWELLS = 5;
export const STATION_24_PLATFORM_EXITS = 10;
export const HOMEWARD_BOUND_PLATFORM_COUNT = 12;

// Special stations the model must not auto-label as ordinary Exit-only Caverns. Keep this list
// narrow: it is better to leave a station generic than invent a cavern.
const EXIT_ONLY_CAVERN_EXCEPTIONS = new Set([50, 60, 75]);

export type TransferClub = "Desperado Club" | "Club Vanquisher";

export function isPrimaryStairwellStation(n: number): boolean {
  return PRIMARY_STAIRWELL_STATIONS.some((station) => station === n);
}

export function isPrimeTransferStation(n: number): boolean {
  if (n < 11 || n > 433) return false;
  for (let k = 2; k * k <= n; k++) if (n % k === 0) return false;
  return true;
}

export function transferClub(n: number): TransferClub | null {
  if (!isPrimeTransferStation(n)) return null;
  if (n % 10 === 1) return "Desperado Club";
  if (n % 10 === 9) return "Club Vanquisher";
  return null;
}

export function isExitOnlyCavernStation(n: number): boolean {
  return n >= 15 && n <= 430 && n % 5 === 0 && !EXIT_ONLY_CAVERN_EXCEPTIONS.has(n);
}

/**
 * Human-readable topology notes for numbered colored-line stops.
 *
 * This deliberately describes only rules or stations supported by the text. It does not attempt to
 * derive a complete line graph from the 9,375-stairwell floor total.
 */
export function stationCanonRole(n: number): string {
  if (DOCUMENTED_TEN_PLATFORM_STATIONS.some((station) => station === n)) {
    return `Stairwell hub · ${STATION_24_STAIRWELLS} stairwells · ` +
      `${STATION_24_PLATFORM_EXITS} platform exits` +
      (n === 24 ? " · Escape Velocity III" : "");
  }
  if (isPrimaryStairwellStation(n)) {
    return "Stairwell hub · portals open during the final six hours";
  }
  if (n === HIDDEN_STAIRWELL_STATION) {
    return "Terminus transfer · saferoom · Station Mimic · " +
      "hidden stairwell revealed after the Mimic is removed";
  }
  if (n === 435) return "End of the Line · employees depart through the trainyard portal";
  if (n === 436) return "Abyss Station · engine return / discarded-car disposal";
  if (n === 60) {
    return `Employee hub · selector for ${HOMEWARD_BOUND_PLATFORM_COUNT} Homeward Bound platforms`;
  }
  if (n === 50) return "Homeward Bound access · explicitly not an Exit-only Cavern";
  if (isExitOnlyCavernStation(n)) {
    return "Exit-only cavern · monster offload / trainyard return path";
  }
  if (isPrimeTransferStation(n)) {
    const club = transferClub(n);
    return "Transfer station · saferoom" + (club ? ` · ${club}` : "");
  }
  return "Modeled subway stop";
}
