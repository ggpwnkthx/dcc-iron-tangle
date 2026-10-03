import {
  CANONICAL_STAIRWELL_COUNT,
  DOCUMENTED_TEN_PLATFORM_STATIONS,
  HOMEWARD_BOUND_PLATFORM_COUNT,
  isExitOnlyCavernStation,
  isPrimeTransferStation,
  PRIMARY_STAIRWELL_STATIONS,
  STATION_24_PLATFORM_EXITS,
  STATION_24_STAIRWELLS,
  stationCanonRole,
  transferClub,
} from "../src/client/canon.ts";
import { assert, equal } from "./assert.ts";

Deno.test("canonical stairwell constraints stay separate from inferred rail density", () => {
  equal(CANONICAL_STAIRWELL_COUNT, 9_375);
  equal(JSON.stringify(PRIMARY_STAIRWELL_STATIONS), JSON.stringify([12, 24, 36, 48, 72]));
  equal(STATION_24_STAIRWELLS, 5);
  equal(STATION_24_PLATFORM_EXITS, 10);
  equal(HOMEWARD_BOUND_PLATFORM_COUNT, 12);
  equal(JSON.stringify(DOCUMENTED_TEN_PLATFORM_STATIONS), JSON.stringify([24, 36, 48]));
});

Deno.test("prime transfer stations expose their documented safe-room and club rules", () => {
  assert(isPrimeTransferStation(83));
  assert(isPrimeTransferStation(89));
  assert(isPrimeTransferStation(101));
  equal(transferClub(83), null);
  equal(transferClub(89), "Club Vanquisher");
  equal(transferClub(101), "Desperado Club");
  assert(!isPrimeTransferStation(75));
});

Deno.test("exit-only cavern rule preserves known special-station exceptions", () => {
  assert(isExitOnlyCavernStation(15));
  assert(isExitOnlyCavernStation(85));
  assert(!isExitOnlyCavernStation(50));
  assert(!isExitOnlyCavernStation(60));
  assert(!isExitOnlyCavernStation(75));
});

Deno.test(
  "station descriptions retain the book-specific details the viewer can actually know",
  () => {
    assert(stationCanonRole(24).includes("5 stairwells"));
    assert(stationCanonRole(24).includes("10 platform exits"));
    assert(stationCanonRole(24).includes("Escape Velocity III"));
    assert(stationCanonRole(36).includes("10 platform exits"));
    assert(stationCanonRole(48).includes("5 stairwells"));
    assert(stationCanonRole(60).includes("12 Homeward Bound platforms"));
    assert(stationCanonRole(433).includes("hidden stairwell"));
    assert(stationCanonRole(89).includes("Club Vanquisher"));
  },
);
