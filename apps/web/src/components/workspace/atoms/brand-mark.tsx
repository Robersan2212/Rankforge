import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "font-mono text-xs font-medium tracking-[0.2em]",
        className
      )}
    >
      RANKFORGE
    </span>
  );
}
