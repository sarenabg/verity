"use client";

import { useEffect, useState } from "react";

export type AiStatus = { nearAi: boolean; writer: string; panel: string[]; contract: string | null };

let cached: AiStatus | null = null;

/** Is NEAR AI live (key set on the server) or is the demo writer in use? */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(cached);
  useEffect(() => {
    if (cached) return;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: AiStatus) => {
        cached = s;
        setStatus(s);
      })
      .catch(() => {});
  }, []);
  return status;
}
