import { describe, expect, it } from "vitest";
import { greetingForHour } from "../greeting";

describe("greetingForHour", () => {
  it("morning until noon", () => {
    expect(greetingForHour(0)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
  });
  it("afternoon from 12 to 16", () => {
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(16)).toBe("Good afternoon");
  });
  it("evening from 17 (the /home vs /chat disagreement hour)", () => {
    expect(greetingForHour(17)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
  });
});
