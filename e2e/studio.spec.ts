import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Fails the test on any console error or uncaught exception. This is what makes
 * the asset-size guard in engine/assets.ts act as a test: art that drifts from
 * its registry entry turns the whole suite red.
 */
async function openStudio(page: Page) {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto("/");

  // The scene is a client-only chunk that also has to boot WebGL and load every
  // texture, so give it room on a cold machine.
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Preparing your workspace")).toBeHidden();

  return { canvas, problems };
}

function money(text: string): number {
  return Number(text.replace(/[^0-9.]/g, ""));
}

/**
 * Finds a point over a sprite by scanning for the "grab" cursor Pixi sets on
 * hover. Avoids duplicating the camera transform in the test.
 */
async function findSprite(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("canvas has no box");

  for (let row = 1; row < 10; row++) {
    for (let column = 1; column < 10; column++) {
      const point = {
        x: box.x + (box.width * column) / 10,
        y: box.y + (box.height * row) / 10,
      };
      await page.mouse.move(point.x, point.y);
      if ((await cursorOver(page, point)) === "grab") return point;
    }
  }

  throw new Error("no draggable sprite found on the canvas");
}

async function cursorOver(page: Page, point: { x: number; y: number }) {
  await page.mouse.move(point.x, point.y);
  return page.locator("canvas").evaluate((element) => element.style.cursor);
}

function addButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: false }).first();
}

test("an empty studio shows the room and nothing to rent", async ({ page }) => {
  const { canvas, problems } = await openStudio(page);

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(200);
  expect(box?.height).toBeGreaterThan(200);

  await expect(page.getByText("Pick a desk to start")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rent this setup" }),
  ).toBeDisabled();

  expect(problems).toEqual([]);
});

test("a desk accessory cannot be added before there is a desk", async ({
  page,
}) => {
  const { problems } = await openStudio(page);

  await addButton(page, '27" 4K Multimedia Monitor').click();

  await expect(page.getByText("Pick a desk to start")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rent this setup" }),
  ).toBeDisabled();

  expect(problems).toEqual([]);
});

test("adding a desk, a chair and a monitor builds the bill", async ({
  page,
}) => {
  const { problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();
  await addButton(page, "Ergonomic Office Chair").click();
  await addButton(page, '27" 4K Multimedia Monitor').click();

  const summary = page
    .getByRole("complementary")
    .filter({ hasText: "Your setup" });
  await expect(summary.getByText("Electrical Adjustable Desk")).toBeVisible();
  await expect(summary.getByText("Ergonomic Office Chair")).toBeVisible();
  await expect(summary.getByText('27" 4K Multimedia Monitor')).toBeVisible();

  const perWeek = money(await summary.getByText(/^\$/).first().innerText());
  expect(perWeek).toBeGreaterThan(0);

  await expect(
    page.getByRole("button", { name: "Rent this setup" }),
  ).toBeEnabled();

  expect(problems).toEqual([]);
});

test("the total is the weekly rate for the whole stay plus the deposit", async ({
  page,
}) => {
  const { problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();
  await addButton(page, "Ergonomic Office Chair").click();

  const amount = async (name: string) =>
    money(await page.getByTestId(`summary-${name}`).innerText());

  for (const weeks of [1, 2, 4, 12]) {
    await page.getByRole("button", { name: `${weeks}w`, exact: true }).click();
    await expect(page.getByText(`Total for ${weeks} weeks`)).toBeVisible();

    const perWeek = await amount("per-week");
    const deposit = await amount("deposit");

    expect(perWeek).toBeGreaterThan(0);
    expect(await amount("total")).toBe(perWeek * weeks + deposit);
  }

  expect(problems).toEqual([]);
});

test("dragging a desk moves it to a new tile", async ({ page }) => {
  const { canvas, problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();

  const from = await findSprite(page, canvas);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no box");

  // Straight down the screen moves the desk towards the camera.
  const to = { x: from.x, y: from.y + box.height * 0.25 };

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(from.x, from.y + ((to.y - from.y) * step) / 10);
  }
  await page.mouse.up();

  await expect
    .poll(() => cursorOver(page, to), {
      message: "desk should now be under the drop point",
    })
    .toBe("grab");

  expect(await cursorOver(page, from)).not.toBe("grab");
  expect(problems).toEqual([]);
});

test("removing the selected item takes it off the bill", async ({ page }) => {
  const { problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();
  await addButton(page, "Ergonomic Office Chair").click();

  // Adding selects the new item, so the chair is the one that goes.
  await page.getByRole("button", { name: "Remove selected" }).click();

  const summary = page
    .getByRole("complementary")
    .filter({ hasText: "Your setup" });
  await expect(summary.getByText("Ergonomic Office Chair")).toBeHidden();
  await expect(summary.getByText("Electrical Adjustable Desk")).toBeVisible();

  expect(problems).toEqual([]);
});

test("clearing empties the studio", async ({ page }) => {
  const { problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();
  await addButton(page, '27" 4K Multimedia Monitor').click();

  const summary = page
    .getByRole("complementary")
    .filter({ hasText: "Your setup" });
  await expect(summary.getByText('27" 4K Multimedia Monitor')).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();

  await expect(page.getByText("Pick a desk to start")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rent this setup" }),
  ).toBeDisabled();

  expect(problems).toEqual([]);
});

test("staging items never reach the bill", async ({ page }) => {
  const { problems } = await openStudio(page);

  await addButton(page, "Monstera").click();

  await expect(page.getByText("Pick a desk to start")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rent this setup" }),
  ).toBeDisabled();

  expect(problems).toEqual([]);
});
