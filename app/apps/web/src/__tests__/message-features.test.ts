import { describe, it, expect } from "vitest";
import { extractMessageFeatures } from "@/lib/emails/message-features";

/**
 * M12-R1 (outreach-autopilot T7) — message_features v1 extractor. Pure:
 * whitespace word count + pattern-detected CTA with a fixed precedence
 * (meeting-ask > link-click > question > none); tone is null v1.
 */

describe("extractMessageFeatures — length_words", () => {
  it("counts whitespace-separated words", () => {
    expect(extractMessageFeatures("one two three").length_words).toBe(3);
  });

  it("collapses runs of whitespace and newlines", () => {
    expect(extractMessageFeatures("one   two\n\nthree\tfour").length_words).toBe(4);
  });

  it("empty, whitespace-only and null/undefined bodies count 0", () => {
    expect(extractMessageFeatures("").length_words).toBe(0);
    expect(extractMessageFeatures("   \n ").length_words).toBe(0);
    expect(extractMessageFeatures(null).length_words).toBe(0);
    expect(extractMessageFeatures(undefined).length_words).toBe(0);
  });
});

describe("extractMessageFeatures — cta_type", () => {
  it("detects a meeting ask", () => {
    expect(extractMessageFeatures("Would you be open to a quick call?").cta_type).toBe("meeting-ask");
    expect(extractMessageFeatures("Happy to book a demo whenever suits.").cta_type).toBe("meeting-ask");
    expect(extractMessageFeatures("Do you have 15 minutes this week?").cta_type).toBe("meeting-ask");
  });

  it("meeting-ask wins over question when both patterns match", () => {
    const f = extractMessageFeatures("Could we schedule a meeting next week?");
    expect(f.cta_type).toBe("meeting-ask");
  });

  it("accent-initial FR vocabulary matches (\\b never fires before é in JS)", () => {
    expect(extractMessageFeatures("On pourrait échanger 15 minutes ?").cta_type).toBe("meeting-ask");
    expect(extractMessageFeatures("Partant pour un échange rapide ?").cta_type).toBe("meeting-ask");
    expect(extractMessageFeatures("Quel créneau vous convient ?").cta_type).toBe("meeting-ask");
    // Conjugated forms past the lookahead stay excluded.
    expect(extractMessageFeatures("Nous échangeons déjà avec eux.").cta_type).toBe("none");
  });

  it("detects a link-click ask (URL or click-through phrasing)", () => {
    expect(extractMessageFeatures("Full write-up here: https://example.com/report").cta_type).toBe("link-click");
    expect(extractMessageFeatures("Click the button below to start.").cta_type).toBe("link-click");
    expect(extractMessageFeatures("Check out our latest benchmark.").cta_type).toBe("link-click");
  });

  it("meeting-ask wins over link-click when both patterns match", () => {
    const f = extractMessageFeatures("Book a call here: https://example.com/booking-page");
    expect(f.cta_type).toBe("meeting-ask");
  });

  it("a bare question is a question", () => {
    expect(extractMessageFeatures("Is deliverability a problem for your team?").cta_type).toBe("question");
  });

  it("no pattern at all is none", () => {
    expect(extractMessageFeatures("Thanks again for the intro, much appreciated.").cta_type).toBe("none");
    expect(extractMessageFeatures("").cta_type).toBe("none");
    expect(extractMessageFeatures(null).cta_type).toBe("none");
  });
});

describe("extractMessageFeatures — tone", () => {
  it("is null v1 (not knowable at transport without a model)", () => {
    expect(extractMessageFeatures("Any body at all.").tone).toBeNull();
  });
});
