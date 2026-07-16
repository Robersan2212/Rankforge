import Link from "next/link";
import { BriefDeleteButton } from "@/components/workspace/molecules/brief-delete-button";
import { isGeneratedBriefContent } from "@/lib/brief-types";
import type { Brief, Project } from "@/lib/types";
import { formatShortDateTime } from "@/lib/format-date";

interface BriefDetailViewProps {
  project: Project;
  brief: Brief;
}

export function BriefDetailView({ project, brief }: BriefDetailViewProps) {
  const content = isGeneratedBriefContent(brief.content) ? brief.content : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Link
            href={`/project/${project.id}/briefs`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to briefs
          </Link>
          <h1 className="text-xl font-semibold">{brief.keyword}</h1>
          <p className="text-sm text-muted-foreground">
            {project.name} · Generated{" "}
            {formatShortDateTime(content?.generated_at ?? brief.created_at)}
          </p>
        </div>
        <BriefDeleteButton
          projectId={project.id}
          briefId={brief.id}
          redirectTo={`/project/${project.id}/briefs`}
          variant="button"
        />
      </div>

      {content ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Target word count
              </p>
              <p className="text-2xl font-semibold mt-1">
                {content.target_word_count.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Primary keyword
              </p>
              <p className="text-lg font-medium mt-1">{content.primary_keyword}</p>
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-medium">Recommended structure</h2>
            <ol className="space-y-3 list-decimal list-inside">
              {content.recommended_structure.map((section) => (
                <li key={section.section_title} className="text-sm">
                  <span className="font-medium">{section.section_title}</span>
                  <span className="text-muted-foreground"> — {section.purpose}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-medium">Semantic keywords</h2>
            <div className="flex flex-wrap gap-2">
              {content.semantic_keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-medium">Suggested headings</h2>
            <ul className="space-y-2">
              {content.suggested_headings.map((heading) => (
                <li key={heading} className="text-sm">
                  {heading}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-medium">FAQ questions</h2>
            <ul className="space-y-2 list-disc list-inside">
              {content.faq_questions.map((question) => (
                <li key={question} className="text-sm">
                  {question}
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-muted-foreground">
            Sources: audit {content.source_audit_id.slice(0, 8)}… · competitor
            analysis {content.source_competitor_analysis_id.slice(0, 8)}…
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <p className="text-sm font-medium">Manual brief</p>
          <p className="text-sm text-muted-foreground">
            This brief was created manually and does not include AI-generated
            structure. Generate a new brief from an audit and competitor
            analysis.
          </p>
        </div>
      )}
    </div>
  );
}
