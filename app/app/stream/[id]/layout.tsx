import type { ReactNode } from "react";

export { generateMetadata } from "./metadata";

export default function StreamDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
