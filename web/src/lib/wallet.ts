"use client";

// Connecting a NEAR wallet (Live mode only). Uses NEAR's official wallet selector.
// Verity never sees keys: every bet is signed in the person's own wallet.

import type { WalletSelector } from "@near-wallet-selector/core";
import { LIVE } from "./config";

export const WALLETS = [
  { id: "meteor-wallet", name: "Meteor Wallet", color: "#1C1917" },
  { id: "hot-wallet", name: "HOT Wallet", color: "#F97316" },
  { id: "my-near-wallet", name: "MyNearWallet", color: "#2563EB" },
  { id: "intear-wallet", name: "Intear Wallet", color: "#14B8A6" },
] as const;

let selectorPromise: Promise<WalletSelector> | null = null;

export function getSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = (async () => {
      const [{ setupWalletSelector }, { setupMeteorWallet }, { setupMyNearWallet }, { setupHotWallet }, { setupIntearWallet }] = await Promise.all([
        import("@near-wallet-selector/core"),
        import("@near-wallet-selector/meteor-wallet"),
        import("@near-wallet-selector/my-near-wallet"),
        import("@near-wallet-selector/hot-wallet"),
        import("@near-wallet-selector/intear-wallet"),
      ]);
      return setupWalletSelector({
        network: LIVE.network,
        modules: [setupMeteorWallet(), setupHotWallet(), setupMyNearWallet(), setupIntearWallet()],
      });
    })();
  }
  return selectorPromise;
}

export async function connect(walletId: string) {
  const selector = await getSelector();
  const wallet = await selector.wallet(walletId);
  await wallet.signIn({ contractId: LIVE.contract, methodNames: [], accounts: [] });
}

export async function disconnect() {
  const selector = await getSelector();
  if (!selector.isSignedIn()) return;
  const wallet = await selector.wallet();
  await wallet.signOut();
}

export async function connectedAccount(): Promise<string | null> {
  const selector = await getSelector();
  return selector.store.getState().accounts.find((a) => a.active)?.accountId ?? null;
}

export async function onAccountChange(cb: (account: string | null) => void): Promise<() => void> {
  const selector = await getSelector();
  const sub = selector.store.observable.subscribe((state) => cb(state.accounts.find((a) => a.active)?.accountId ?? null));
  return () => sub.unsubscribe();
}

export type Call = { receiverId: string; methodName: string; args: object; deposit?: bigint; gasTgas?: number };

/** Ask the wallet to sign and send one or more function calls (one transaction each). */
export async function send(calls: Call[]) {
  const selector = await getSelector();
  const wallet = await selector.wallet();
  const { actionCreators } = await import("@near-js/transactions");
  const txs = calls.map((c) => ({
    receiverId: c.receiverId,
    actions: [actionCreators.functionCall(c.methodName, c.args, BigInt(c.gasTgas ?? 100) * 10n ** 12n, c.deposit ?? 0n)],
  }));
  if (txs.length === 1) return [await wallet.signAndSendTransaction(txs[0])];
  return wallet.signAndSendTransactions({ transactions: txs });
}

export const ONE_YOCTO = 1n;
/** USDC storage registration costs 0.00125 NEAR. */
export const USDC_STORAGE = 1_250_000_000_000_000_000_000n;
