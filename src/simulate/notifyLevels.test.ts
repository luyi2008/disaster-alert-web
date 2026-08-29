import { describe, expect, it } from "vitest";
import { FALLBACK_NOTIFY_LEVELS, notifyLevelLabel, notifyLevelsFromOptions } from "./notifyLevels";

describe("notifyLevelsFromOptions", () => {
  it("falls back to the three backend interruption levels", () => {
    expect(notifyLevelsFromOptions(null)).toEqual(FALLBACK_NOTIFY_LEVELS);
    expect(notifyLevelsFromOptions({ categories: [] }).map((item) => item.id)).toEqual([
      "passive",
      "active",
      "critical",
    ]);
  });

  it("reads unique interruption levels from earthquake warning bands in order", () => {
    const levels = notifyLevelsFromOptions({
      categories: [{
        id: "earthquake_warning",
        default_alert: {
          estimated_intensity_bands: [
            { min: 1, max: 2, interruption_level: "passive" },
            { min: 3, max: 7, interruption_level: "critical" },
          ],
        },
      }],
    });
    expect(levels).toEqual([
      { id: "passive", min: 1, max: 2 },
      { id: "critical", min: 3, max: 7 },
    ]);
  });

  it("keeps unknown level ids so the test page can still send them", () => {
    const levels = notifyLevelsFromOptions({
      categories: [{
        id: "earthquake_warning",
        default_alert: {
          estimated_intensity_bands: [
            { min: 0, max: 7, interruption_level: "timeSensitive" },
          ],
        },
      }],
    });
    expect(levels).toEqual([{ id: "timesensitive", min: 0, max: 7 }]);
    expect(notifyLevelLabel("timesensitive")).toBe("timesensitive");
  });
});
