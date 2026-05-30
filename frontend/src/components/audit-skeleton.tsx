"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

const STATUS_MESSAGES = [
  "Crawling page structure…",
  "Extracting meta tags…",
  "Analyzing heading hierarchy…",
  "Counting words & links…",
  "Checking image alt text…",
  "Running AI analysis…",
  "Compiling audit report…",
];

export function AuditSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2800);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 6, 92));
    }, 1500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="space-y-3">
        <Progress value={progress} className="h-1.5" />
        <p className="text-center text-sm text-muted-foreground">
          {STATUS_MESSAGES[messageIndex]}
        </p>
      </div>

      <Card className="border-border bg-card p-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-[140px] w-[240px] rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border bg-card p-4">
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
