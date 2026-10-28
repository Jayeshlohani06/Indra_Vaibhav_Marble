import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1";

function setDevice({ userAgent = ANDROID_CHROME, installed = false } = {}) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: installed })));
}

// The component listens for the browser's install offer as soon as it loads,
// so each test loads a fresh copy.
async function loadInstallPrompt() {
  vi.resetModules();
  return (await import("./InstallPrompt")).default;
}

// What Chrome fires when the site can be installed.
function offerInstall(outcome = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows nothing until the browser offers to install", async () => {
    setDevice();
    const InstallPrompt = await loadInstallPrompt();
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an Install button when Chrome offers to install", async () => {
    setDevice();
    const InstallPrompt = await loadInstallPrompt();
    render(<InstallPrompt />);

    const event = offerInstall();

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByText("Install the app on this phone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("remembers an offer that arrived before the page was drawn", async () => {
    setDevice();
    const InstallPrompt = await loadInstallPrompt();
    offerInstall();

    render(<InstallPrompt />);

    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("opens the browser's install dialog and hides once installed", async () => {
    setDevice();
    const InstallPrompt = await loadInstallPrompt();
    render(<InstallPrompt />);
    const event = offerInstall("accepted");

    await userEvent.click(screen.getByRole("button", { name: "Install" }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Install the app on this phone")).not.toBeInTheDocument();
  });

  it("hides the button if the person cancels the install dialog", async () => {
    setDevice();
    const InstallPrompt = await loadInstallPrompt();
    render(<InstallPrompt />);
    offerInstall("dismissed");

    await userEvent.click(screen.getByRole("button", { name: "Install" }));

    // Chrome allows the offer only once, so there is nothing left to press.
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("stays hidden after 'Not now', even after reopening", async () => {
    setDevice();
    const InstallPrompt = await loadInstallPrompt();
    const { unmount } = render(<InstallPrompt />);
    offerInstall();

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Install the app on this phone")).not.toBeInTheDocument();
    expect(localStorage.getItem("install-prompt-dismissed")).toBe("yes");

    unmount();
    const Reopened = await loadInstallPrompt();
    render(<Reopened />);
    offerInstall();
    expect(screen.queryByText("Install the app on this phone")).not.toBeInTheDocument();
  });

  it("shows nothing when already opened as the installed app", async () => {
    setDevice({ installed: true });
    const InstallPrompt = await loadInstallPrompt();
    const { container } = render(<InstallPrompt />);
    offerInstall();
    expect(container).toBeEmptyDOMElement();
  });

  it("tells iPhone Safari users where to tap, without an Install button", async () => {
    setDevice({ userAgent: IPHONE_SAFARI });
    const InstallPrompt = await loadInstallPrompt();
    render(<InstallPrompt />);

    expect(screen.getByText(/Tap Share/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("shows nothing in Chrome on iPhone, which cannot add apps", async () => {
    setDevice({ userAgent: IPHONE_CHROME });
    const InstallPrompt = await loadInstallPrompt();
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });
});
