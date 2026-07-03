import { describe, expect, it } from "vitest";
import {
  classifyBlockedHtml,
  classifyHttpStatus,
} from "./fetch-errors.js";

describe("classifyHttpStatus", () => {
  it("maps auth and paywall statuses to ACCESS_BLOCKED", () => {
    expect(classifyHttpStatus(401)?.code).toBe("ACCESS_BLOCKED");
    expect(classifyHttpStatus(403)?.code).toBe("ACCESS_BLOCKED");
  });

  it("maps 429 to RATE_LIMITED", () => {
    expect(classifyHttpStatus(429)?.code).toBe("RATE_LIMITED");
  });
});

describe("classifyBlockedHtml", () => {
  it("detects CAPTCHA pages", () => {
    const err = classifyBlockedHtml(
      '<html><body><div class="g-recaptcha"></div></body></html>'
    );
    expect(err?.code).toBe("ACCESS_BLOCKED");
  });

  it("detects paywall language", () => {
    const err = classifyBlockedHtml(
      "<html><body>Subscribe to continue reading this article.</body></html>"
    );
    expect(err?.code).toBe("ACCESS_BLOCKED");
  });
});
