import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FitText from "./FitText";

describe("FitText", () => {
  it("tells the CSS how long the amount is", () => {
    const { container } = render(<FitText>{"-₹12,34,56,789.00"}</FitText>);
    const amount = container.querySelector("strong");
    expect(amount).toHaveTextContent("-₹12,34,56,789.00");
    expect(amount.style.getPropertyValue("--fit-chars")).toBe("17");
  });

  it("counts plain numbers too", () => {
    const { container } = render(<FitText>{8}</FitText>);
    expect(container.querySelector("strong").style.getPropertyValue("--fit-chars")).toBe("1");
  });

  it("renders the chosen tag", () => {
    const { container } = render(<FitText as="h3">{"₹14,219.00"}</FitText>);
    expect(container.querySelector("h3")).toHaveTextContent("₹14,219.00");
  });

  it("leaves the size alone while something else is shown, like a loader", () => {
    const { container } = render(<FitText><span>Loading…</span></FitText>);
    expect(container.querySelector("strong").getAttribute("style")).toBeNull();
  });
});
