import { test, expect, type Page } from "@playwright/test";

const DEMO_ADDRESS =
  "GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR";
const FIXED_NOW = 1720000000000; // 2024-10-?? UTC; keep dates stable for screenshots

async function preparePage(
  page: Page,
  options: { theme?: "light" | "dark"; connect?: boolean } = {},
) {
  const theme = options.theme ?? "light";
  await page.addInitScript(
    ({ theme, connect, walletAddress, now }) => {
      localStorage.setItem("theme", theme);
      if (connect) {
        localStorage.setItem("walletId", "xbull");
        (window as any).xBullSDK = {
          connect: async () => ({ publicKey: walletAddress }),
          signXDR: async () => "AAAAAgAAAAA...dummy-signature...",
        };
      }
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(now);
          } else {
            // Date has multiple overloaded constructors; a variadic args array
            // can't be typed as a fixed tuple, so this spread can't type-check.
            // @ts-expect-error
            super(...args);
          }
        }

        static now() {
          return now;
        }

        static parse(value: string) {
          return OriginalDate.parse(value);
        }

        static UTC(...args: Parameters<typeof OriginalDate.UTC>) {
          return OriginalDate.UTC(...args);
        }
      }
      // @ts-ignore
      window.Date = MockDate;
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    {
      theme,
      connect: options.connect ?? false,
      walletAddress: DEMO_ADDRESS,
      now: FIXED_NOW,
    },
  );
}

for (const theme of ["light", "dark"] as const) {
  test(`landing page screenshot (${theme})`, async ({ page }) => {
    await preparePage(page, { theme });
    await page.goto("/");
    await expect(page.locator("text=FlowStar")).toBeVisible();
    await expect(page).toHaveScreenshot(`landing-${theme}.png`, {
      fullPage: true,
    });
  });
}

test.describe("Dashboard visual states", () => {
  test("dashboard empty state", async ({ page }) => {
    await preparePage(page, { theme: "light" });
    await page.goto("/app");
    await expect(page.locator("text=Connect your wallet")).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-empty.png", {
      fullPage: true,
    });
  });

  test("dashboard connected with streams", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app");
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=New stream")).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-with-streams.png", {
      fullPage: true,
    });
  });

  test("dashboard tabs: receiving and sent", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app");
    await expect(page.locator("text=Dashboard")).toBeVisible();

    await page.locator('button:has-text("Receiving")').first().click();
    await expect(page.locator("text=Receiving")).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-receiving-tab.png", {
      fullPage: true,
    });

    await page.locator('button:has-text("Sending")').first().click();
    await expect(page.locator("text=Sending")).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-sent-tab.png", {
      fullPage: true,
    });
  });
});

test.describe("Create stream form", () => {
  test("empty form screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/create");
    await expect(page.locator("text=Create a stream")).toBeVisible();
    await expect(page).toHaveScreenshot("create-stream-empty.png", {
      fullPage: true,
    });
  });

  test("filled form screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/create");
    await page.fill("#recipient", "GD7HQZX4...PAYROLL...4FJ2K");
    await page.fill("#amount", "1234");
    await page.fill("#startDate", "2025-01-01T00:00");
    await page.fill("#endDate", "2025-12-31T23:59");
    await page.click('button:has-text("Create stream")');
    await expect(
      page
        .locator("text=Review transaction")
        .or(page.locator("text=Create stream")),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("create-stream-filled.png", {
      fullPage: true,
    });
  });

  test("validation error screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/create");
    await page.fill("#recipient", "invalid-address");
    await page.fill("#amount", "1234");
    await page.click('button:has-text("Create stream")');
    await expect(
      page
        .locator("text=Invalid recipient address")
        .or(page.locator("text=invalid")),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("create-stream-validation.png", {
      fullPage: true,
    });
  });
});

test.describe("Stream detail pages", () => {
  test("active stream screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/stream/2");
    await expect(
      page.locator("text=Stream details").or(page.locator("text=Withdraw")),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("stream-detail-active.png", {
      fullPage: true,
    });
  });

  test("completed stream screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/stream/3");
    await expect(page.locator("text=Stream not found")).not.toBeVisible();
    await expect(
      page.locator("text=Stream details").or(page.locator("text=Withdraw")),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("stream-detail-completed.png", {
      fullPage: true,
    });
  });

  test("cancelled stream screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/stream/5");
    await expect(
      page.locator("text=Cancelled").or(page.locator("text=Stream details")),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("stream-detail-cancelled.png", {
      fullPage: true,
    });
  });
});

test.describe("Batch create page", () => {
  test("empty batch create screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/create/batch");
    await expect(page.locator("text=Batch create streams")).toBeVisible();
    await expect(page).toHaveScreenshot("batch-create-empty.png", {
      fullPage: true,
    });
  });

  test("batch create with CSV screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/create/batch");
    const csv =
      "recipient,amount,start_time,end_time,cliff_time,cliff_amount\nGD7HQZX4...PAYROLL...4FJ2K,100,2025-01-01T00:00,2025-12-31T23:59,2025-01-01T00:00,0\n";
    await page.setInputFiles('input[type="file"]#csvFile', {
      name: "batch-streams.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });
    await expect(
      page
        .locator("text=CSV parse warnings")
        .or(page.locator("text=Preview rows")),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("batch-create-with-csv.png", {
      fullPage: true,
    });
  });
});

test.describe("Wallet and modal dialogs", () => {
  test("wallet connect dialog screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light" });
    await page.goto("/app");
    await page.click('button:has-text("Connect wallet")');
    await expect(page.locator("text=Connect a wallet")).toBeVisible();
    await expect(page).toHaveScreenshot("wallet-connect-dialog.png", {
      fullPage: true,
    });
  });

  test("withdraw dialog screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/stream/2");
    await page.locator('button:has-text("Withdraw")').first().click();
    await expect(page.locator("text=Withdraw funds")).toBeVisible();
    await expect(page).toHaveScreenshot("withdraw-dialog.png", {
      fullPage: true,
    });
  });

  test("cancel dialog screenshot", async ({ page }) => {
    await preparePage(page, { theme: "light", connect: true });
    await page.goto("/app/stream/1");
    await page.locator('button:has-text("Cancel")').first().click();
    await expect(page.locator("text=Cancel stream")).toBeVisible();
    await expect(page).toHaveScreenshot("cancel-dialog.png", {
      fullPage: true,
    });
  });
});
