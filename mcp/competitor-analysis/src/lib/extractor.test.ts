import { describe, expect, it } from "vitest";
import { extractFaqQuestions, extractTopics } from "./extractor.js";

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>SEO Guide</title></head>
<body>
  <h1>SEO Tips for Startups</h1>
  <h2>Keyword research basics</h2>
  <h2>On-page optimization</h2>
  <h3>Meta descriptions</h3>
  <p>Keyword research helps startups find opportunities. On-page optimization improves rankings.</p>
  <details><summary>What is SEO?</summary><p>Search engine optimization.</p></details>
  <h3>How do you measure SEO success?</h3>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": "Why is SEO important for startups?",
      "acceptedAnswer": { "@type": "Answer", "text": "It drives organic traffic." }
    }]
  }
  </script>
</body>
</html>
`;

describe("extractTopics", () => {
  it("extracts topics from headings and body", () => {
    const topics = extractTopics(
      {
        h2: ["Keyword research basics", "On-page optimization"],
        h3: ["Meta descriptions"],
      },
      "Keyword research helps startups find opportunities for growth"
    );
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.some((t) => t.includes("keyword"))).toBe(true);
  });
});

describe("extractFaqQuestions", () => {
  it("detects details, question headings, and JSON-LD FAQ", () => {
    const faqs = extractFaqQuestions(SAMPLE_HTML);
    expect(faqs.some((q) => q.includes("What is SEO"))).toBe(true);
    expect(faqs.some((q) => q.includes("measure SEO success"))).toBe(true);
    expect(
      faqs.some((q) => q.includes("Why is SEO important for startups"))
    ).toBe(true);
  });
});
