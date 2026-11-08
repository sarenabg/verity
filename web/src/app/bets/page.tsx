import type { Metadata } from "next";
import { Bets } from "@/components/Bets";

export const metadata: Metadata = { title: "My bets · Verity" };

export default function Page() {
  return <Bets />;
}
