import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

function renderTabs() {
  return render(
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account panel</TabsContent>
      <TabsContent value="password">Password panel</TabsContent>
      <TabsContent value="settings">Settings panel</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("renders all triggers and the active panel", () => {
    renderTabs();

    expect(
      screen.getByRole("tab", { name: "Account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Settings" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Account panel")).toBeInTheDocument();
    expect(screen.queryByText("Password panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings panel")).not.toBeInTheDocument();
  });

  it("switches panels when a trigger is clicked", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Password" }));

    expect(screen.getByText("Password panel")).toBeInTheDocument();
    expect(screen.queryByText("Account panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByText("Settings panel")).toBeInTheDocument();
    expect(screen.queryByText("Password panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Account panel")).not.toBeInTheDocument();
  });

  it("navigates between triggers with arrow keys", async () => {
    const user = userEvent.setup();
    renderTabs();

    const accountTab = screen.getByRole("tab", { name: "Account" });
    const passwordTab = screen.getByRole("tab", { name: "Password" });
    const settingsTab = screen.getByRole("tab", { name: "Settings" });

    accountTab.focus();
    expect(accountTab).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(passwordTab).toHaveFocus();
    expect(screen.getByText("Password panel")).toBeInTheDocument();
    expect(screen.queryByText("Account panel")).not.toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(settingsTab).toHaveFocus();
    expect(screen.getByText("Settings panel")).toBeInTheDocument();
    expect(screen.queryByText("Password panel")).not.toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(passwordTab).toHaveFocus();
    expect(screen.getByText("Password panel")).toBeInTheDocument();
    expect(screen.queryByText("Settings panel")).not.toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(accountTab).toHaveFocus();
    expect(screen.getByText("Account panel")).toBeInTheDocument();
    expect(screen.queryByText("Password panel")).not.toBeInTheDocument();
  });
});