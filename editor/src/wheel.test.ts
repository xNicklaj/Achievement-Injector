import { describe, expect, it } from "vitest";
import { createWheelClassifier, zoomFactor } from "./wheel";

const ev = (deltaY: number, deltaX = 0, deltaMode = 0) => ({ deltaX, deltaY, deltaMode });

describe("wheel classifier", () => {
  it("treats a single 100px notch as a mouse wheel and zooms", () => {
    expect(createWheelClassifier(() => 0)(ev(100))).toBe("zoom");
    expect(createWheelClassifier(() => 0)(ev(-200))).toBe("zoom");
  });
  it("treats Firefox line-mode wheel as a mouse", () => {
    expect(createWheelClassifier(() => 0)(ev(3, 0, 1))).toBe("zoom");
  });
  it("treats small, fractional or horizontal events as a touchpad and pans", () => {
    const c = createWheelClassifier(() => 0);
    expect(c(ev(12))).toBe("pan");
    expect(c(ev(130.5))).toBe("pan");
    expect(c(ev(150, 4))).toBe("pan");
  });
  it("keeps a touchpad gesture a touchpad when one event in the flick is large", () => {
    let t = 0;
    const c = createWheelClassifier(() => t);
    expect(c(ev(20))).toBe("pan");
    t = 40;
    expect(c(ev(120))).toBe("pan"); // inertia burst
    t = 1000;
    expect(c(ev(120))).toBe("zoom"); // a later, isolated notch is a mouse again
  });
  it("zooms in on wheel up and out on wheel down, symmetrically", () => {
    expect(zoomFactor(ev(-100))).toBeGreaterThan(1);
    expect(zoomFactor(ev(100))).toBeLessThan(1);
    expect(zoomFactor(ev(-100)) * zoomFactor(ev(100))).toBeCloseTo(1);
  });
});
