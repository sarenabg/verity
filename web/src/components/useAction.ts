"use client";

import { useState } from "react";
import { createGuard, type Guard } from "@/lib/guard";

/** [busy, run]: run(fn) ignores extra clicks until fn has finished. */
export function useAction(): [boolean, Guard["run"]] {
  const [busy, setBusy] = useState(false);
  const [guard] = useState(() => createGuard(setBusy));
  return [busy, guard.run];
}
