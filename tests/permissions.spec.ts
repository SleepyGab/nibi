import { expect, test, type Page } from "@playwright/test";

type PermissionTest = {
  accessibility: boolean;
  microphone: boolean;
  error: boolean;
  hang: boolean;
  initError: boolean;
  completed: number;
  calls: string[];
  maxConcurrent: number;
};
async function update(page: Page, patch: Partial<PermissionTest>) {
  await page.evaluate((value) => {
    Object.assign(
      (window as unknown as { permissionTest: PermissionTest }).permissionTest,
      value,
    );
    window.dispatchEvent(new Event("focus"));
  }, patch);
}
async function state(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { permissionTest: PermissionTest }).permissionTest,
  );
}

test("detects a grant made outside its own button and completes once", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html");
  await expect(
    page.getByRole("button", { name: "Allow", exact: true }),
  ).toBeVisible();
  await update(page, { accessibility: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible();
  const result = await state(page);
  expect(result.completed).toBe(1);
  expect(
    result.calls.filter((call) => call === "initialize_enigo"),
  ).toHaveLength(1);
  expect(
    result.calls.filter((call) => call === "initialize_shortcuts"),
  ).toHaveLength(1);
});

test("negative polling times out to recovery controls and notices a later grant", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/tests/fixtures/permissions.html");
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  expect((await state(page)).calls).toContain("open_accessibility_settings");
  await expect(page.getByText("Waiting", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await page.clock.fastForward(16000);
  await expect(page.getByText("Waiting", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "remove the old nibi entry",
  );
  await page.getByRole("button", { name: "Restart nibi" }).click();
  expect((await state(page)).calls).toContain("plugin:process|restart");
  await update(page, { accessibility: true });
  await page.clock.fastForward(1000);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible();
});

test("a failed IPC check remains recoverable instead of silently stopping polling", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html?error");
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await update(page, { error: false, accessibility: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible();
});

test("a hung IPC check exits the spinner and can be retried", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/tests/fixtures/permissions.html?hang");
  await expect
    .poll(async () => (await state(page)).calls.length)
    .toBeGreaterThan(1);
  await page.clock.fastForward(5500);
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await update(page, { hang: false, accessibility: true });
  await page.clock.fastForward(1500);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible();
});

test("slow checks do not overlap and unmounted polling stops", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html?slow");
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await update(page, { accessibility: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible({ timeout: 7000 });
  // StrictMode starts and cancels the first mount; active interval polls must
  // never add further overlap after that initial double invocation.
  const before = await state(page);
  expect(before.maxConcurrent).toBeLessThanOrEqual(2);
  await page.clock.install();
  await page.clock.fastForward(5000);
  expect((await state(page)).calls).toEqual(before.calls);
});

test("input initialization failures show retry controls rather than false completion", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html?granted&initerror");
  await expect(page.getByRole("status")).toContainText(
    "input setup has not completed",
  );
  await expect(page.getByTestId("complete")).toHaveCount(0);
  await update(page, { initError: false });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible();
});

test("Windows only requests microphone permission and detects later grants", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html?os=windows&nomic");
  await expect(page.getByText("Accessibility", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  expect((await state(page)).calls).toContain(
    "open_microphone_privacy_settings",
  );
  await update(page, { microphone: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("complete")).toBeVisible();
});

test("preview is inert and does not check, request, initialize or restart", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html?preview");
  await page
    .getByRole("button", { name: "Allow", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Check again" }).click();
  expect(
    (await state(page)).calls.every((call) => call === "get_app_settings"),
  ).toBe(true);
});

test("returning permission recovery opens settings and accepts a focus recheck", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html");
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  expect((await state(page)).calls).toContain("open_accessibility_settings");
  await update(page, { accessibility: true });
  await expect(
    page.getByRole("button", { name: "Allow", exact: true }),
  ).toHaveCount(0);
});

test("Chinese recovery instructions are localized", async ({ page }) => {
  await page.goto("/tests/fixtures/permissions.html?lang=zh&error");
  await expect(page.getByRole("button", { name: "重新检查" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "重新添加“应用程序”里的 nibi",
  );
});

for (const language of ["en", "zh"]) {
  test(`permission recovery controls fit the native minimum window (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 720, height: 600 });
    await page.goto(`/tests/fixtures/permissions.html?lang=${language}&error`);
    await expect(page.getByRole("status")).toBeVisible();
    const restart = await page
      .getByRole("button", {
        name: language === "zh" ? "重启 nibi" : "Restart nibi",
        exact: true,
      })
      .boundingBox();
    const footer = await page
      .getByRole("button", {
        name: language === "zh" ? "继续" : "Continue",
        exact: true,
      })
      .boundingBox();
    expect(restart).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(restart!.y + restart!.height).toBeLessThanOrEqual(footer!.y);
  });
}
