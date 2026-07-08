import { Metadata } from "next";
import { RequireWallet } from "@/components/layout/require-wallet";
import { CreateForm } from "./create-form";

export const metadata: Metadata = {
  title: "Create a Token Stream",
  description:
    "Create a new token stream on FlowStar with customizable schedules, cliffs, and cancellation options.",
};

export default function CreatePage() {
  return (
    <RequireWallet>
      <CreateForm />
    </RequireWallet>
  );
}
