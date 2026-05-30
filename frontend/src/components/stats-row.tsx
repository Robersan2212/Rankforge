import type { AuditImages, AuditLinks } from "@/lib/types";
import { StatCard } from "./stat-card";

interface StatsRowProps {
  wordCount: number;
  links: AuditLinks;
  images: AuditImages;
}

export function StatsRow({ wordCount, links, images }: StatsRowProps) {
  const wordSubtitle =
    wordCount >= 300 ? "Above minimum" : "Below 300";

  const altValue =
    images.total > 0 ? `${images.with_alt}/${images.total}` : "0/0";

  const altSubtitle =
    images.missing_alt > 0
      ? `${images.missing_alt} missing`
      : images.total > 0
        ? "All have alt"
        : "No images";

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Word Count"
        value={wordCount.toLocaleString()}
        subtitle={wordSubtitle}
      />
      <StatCard
        title="Internal Links"
        value={String(links.internal)}
      />
      <StatCard
        title="External Links"
        value={String(links.external)}
      />
      <StatCard
        title="Image Alt Text"
        value={altValue}
        subtitle={altSubtitle}
      />
    </div>
  );
}
