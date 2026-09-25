import { Metadata } from "next";
import { RequireWallet } from "@/components/layout/require-wallet";
import { Dashboard } from "./dashboard";
import { dashboardCopy } from "@/lib/copy/dashboard";

export const metadata: Metadata = {
  title: dashboardCopy.metadata.title,
  description: dashboardCopy.metadata.description,
};

export default function DashboardPage() {
  return (
    <RequireWallet>
      <Dashboard />
    </RequireWallet>
  );
}
