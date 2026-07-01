# Rankforge — API Token Cost Guidelines

Context: this is a senior capstone demo project (Rankforge / AI SEO Content
Intelligence Platform) with a small API budget (~$50) intended to cover
development, testing, and a live demo for 2 users. These guidelines exist to
prevent avoidable token spend during implementation.

## Model selection

- Default to **Claude Sonnet** for all agentic orchestration, brief
  generation, and draft writing. It is the price/quality sweet spot for this
  workload.
- Do **not** use Opus-tier models unless a specific step clearly needs the
  extra reasoning quality (e.g. final draft polish). Confirm with the user
  before switching any call to Opus.
- Consider Haiku for simple, structured sub-tasks that don't need deep
  reasoning (e.g. classifying/labeling data, basic extraction, formatting).

## Context size discipline (the #1 cost risk)

- **Never pass raw scraped HTML/DOM into the model's context.** The Page
  Auditor MCP and Competitor Analysis MCP should extract and return clean,
  structured text (headings, word count, meta tags, plain body text) — not
  full HTML. Raw HTML from a single competitor page can be 10–20k tokens;
  multiplied across 10 SERP competitors, this can balloon a single brief
  generation call to 100k+ input tokens.
- Cap/truncate any scraped page content before it's added to conversation
  history. Summarize long pages rather than including them in full.
- When the agent chains multiple MCP tool calls (Page Auditor → SERP Scraper
  → Competitor Analysis → Keyword Research), trim or summarize each tool
  result before appending it to context rather than letting the full raw
  result accumulate across turns.
- Avoid re-sending the same large context (e.g. full competitor data) on
  every follow-up call in a session — pass only what changed or is needed.

## Caching and batching

- Use **prompt caching** for any content reused across calls in the same
  session (e.g. system instructions, a page's audit data reused across
  multiple brief regenerations, competitor data reused for several draft
  attempts). Cached input is significantly cheaper than fresh input.
- If any workflow can tolerate a delay (e.g. weekly ranking digest, batch
  competitor monitoring), use the **Batch API** — it's roughly half price for
  both input and output.

## Output length control

- Set explicit `max_tokens` limits appropriate to each feature (e.g. a
  content brief doesn't need a 4000-token budget; a full draft generation
  does). Don't leave output length uncapped/oversized by default.
- For FR-06 (full draft generation), target the article length actually
  requested rather than over-generating.

## Development/testing hygiene

- Most of the token budget will be burned during development iteration, not
  the live demo. Avoid repeatedly re-running full end-to-end pipelines
  (audit → competitor analysis → brief → draft) while debugging one step —
  isolate and test individual MCP calls instead.
- Never leave a test script or agent loop running unattended; a stuck retry
  loop can burn through credits quickly.
- Log token usage per call during development (input/output counts) so
  spend is visible and traceable to a specific feature.

## Budget guardrails

- Set a monthly spending limit and usage alerts in the Anthropic Console
  (Settings → Billing) so spend is capped well below $50 and the team is
  warned before hitting it.
- Track approximate cost per feature during testing:
  - SEO audit (FR-02): mostly non-AI crawl; minimal token cost if AI is only
    used for score/summary reasoning.
  - Competitor synthesis (FR-03): moderate — depends on how much scraped
    text is passed in (keep this trimmed).
  - Content brief generation (FR-04): higher — agentic, multiple tool
    results in context. This is the step most likely to balloon if scraped
    content isn't cleaned up.
  - Full draft generation (FR-06): output-heavy (article length), but input
    should stay lean if it only needs the brief, not raw source data.

## Quick reference

- Full end-to-end pipeline run (audit → competitor analysis → brief →
  draft), with clean/trimmed context: roughly $0.10–$0.20 per run at current
  Sonnet pricing.
- The realistic risk to a $50 budget is not the demo itself — it's
  unbounded context growth during development (raw HTML in context, agent
  retry loops, accidental Opus usage).
