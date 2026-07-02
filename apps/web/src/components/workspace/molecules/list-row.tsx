import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ListRowProps {
  title: string;
  subtitle?: string;
  badge?: string;
  initials?: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}

export function ListRow({
  title,
  subtitle,
  badge,
  initials,
  href,
  active = false,
  onClick,
  trailing,
}: ListRowProps) {
  const content = (
    <>
      <Avatar className="size-9 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-medium",
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {initials ?? title.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && (
          <p
            className={cn(
              "truncate text-xs",
              active ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {badge && (
        <Badge
          variant={active ? "secondary" : "outline"}
          className={cn(
            "shrink-0",
            active && "border-transparent bg-primary-foreground/15 text-primary-foreground"
          )}
        >
          {badge}
        </Badge>
      )}
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "hover:bg-muted"
  );

  if (href) {
    return (
      <div
        className={cn(
          "flex items-center gap-1 rounded-xl",
          !active && "hover:bg-muted"
        )}
      >
        <Link href={href} prefetch className={cn(className, "min-w-0 flex-1")}>
          {content}
        </Link>
        {trailing}
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(className, "w-full text-left")}>
      {content}
    </button>
  );
}
