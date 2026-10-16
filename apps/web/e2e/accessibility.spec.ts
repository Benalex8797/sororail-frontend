import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  ["/", "Overview"],
  ["/payroll", "Payroll"],
  ["/streams", "Streams"],
  ["/vesting", "Vesting"],
  ["/escrow", "Escrow"],
] as const;

for (const [route, heading] of routes) {
  test(`${route} has no serious or critical accessibility violations`, async ({
    page,
  }) => {
    await page.route(/soroban-testnet\.stellar\.org/, async (request) => {
      const body = request.request().postDataJSON() as {
        id: number;
        method: string;
      };
      if (body.method === "getNetwork") {
        await request.fulfill({
          json: {
            jsonrpc: "2.0",
            id: body.id,
            result: { passphrase: "Test SDF Network ; September 2015" },
          },
        });
        return;
      }
      await request.continue();
    });
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    );

    expect(
      violations,
      `${route}: ${JSON.stringify(violations.map(({ id, help }) => ({ id, help })))}`,
    ).toEqual([]);
  });
}