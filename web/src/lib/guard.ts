// One action at a time. A second click while the first is still running, or a repeat of the
// same action within a short cool-down after it (Demo bets finish instantly, before the second
// click of a double click arrives), is ignored, so a double click can't place two bets or send
// two transactions. A different action (say "Dispute" right after "Ask the judge") is not held up.

export type Guard = {
  run: <T>(fn: () => Promise<T> | T, key?: string) => Promise<T | undefined>;
  busy: () => boolean;
};

export function createGuard(onChange?: (busy: boolean) => void, cooldownMs = 400): Guard {
  let running = false;
  const until = new Map<string, number>();
  return {
    busy: () => running,
    async run(fn, key = "") {
      if (running || Date.now() < (until.get(key) ?? 0)) return undefined;
      running = true;
      onChange?.(true);
      try {
        return await fn();
      } finally {
        running = false;
        until.set(key, Date.now() + cooldownMs);
        onChange?.(false);
      }
    },
  };
}
