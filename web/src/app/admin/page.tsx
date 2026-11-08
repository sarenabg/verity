import type { Metadata } from "next";
import { Admin } from "@/components/Admin";

export const metadata: Metadata = { title: "Set up live markets · Verity", robots: { index: false } };

export default function Page() {
  return <Admin />;
}
