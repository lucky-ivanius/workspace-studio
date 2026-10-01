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

function zoomTrigger(page: Page) {
  return page.locator('[data-slot="dropdown-menu-trigger"]');
}

async function zoomLevel(page: Page) {
  return (await zoomTrigger(page).innerText()).trim();
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

test("dragging the floor moves the camera, not the room", async ({ page }) => {
  const { canvas, problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();

  const desk = await findSprite(page, canvas);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no box");

  // Empty space below the floor. Pressing here grabs the camera, not an item.
  const empty = { x: box.x + box.width * 0.1, y: box.y + box.height * 0.95 };
  expect(await cursorOver(page, empty)).toBe("move");

  const shift = Math.round(box.width * 0.3);
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(empty.x + (shift * step) / 10, empty.y);
  }
  await page.mouse.up();

  // Everything in the room slid right with the camera, by the drag distance.
  await expect
    .poll(() => cursorOver(page, { x: desk.x + shift, y: desk.y }), {
      message: "the desk should have travelled with the camera",
    })
    .toBe("grab");

  expect(await cursorOver(page, desk)).not.toBe("grab");
  expect(problems).toEqual([]);
});

test("the zoom menu offers every level and reports the current one", async ({
  page,
}) => {
  const { problems } = await openStudio(page);

  // An empty room opens zoomed to fit, which is below 100%.
  const fitted = await zoomLevel(page);
  expect(Number.parseInt(fitted, 10)).toBeGreaterThan(0);
  expect(Number.parseInt(fitted, 10)).toBeLessThan(100);

  await zoomTrigger(page).click();
  await expect(page.getByRole("menuitem", { name: "Zoom in" })).toBeVisible();
  expect(await page.getByRole("menuitem").allInnerTexts()).toEqual([
    "Zoom in\n+",
    "Zoom out\n-",
    "Zoom to 50%",
    "Zoom to 100%\n⇧0",
    "Zoom to 200%",
    "Zoom to fit\n⇧1",
  ]);

  await page.getByRole("menuitem", { name: "Zoom to 200%" }).click();
  await expect.poll(() => zoomLevel(page)).toBe("200%");

  await zoomTrigger(page).click();
  await page.getByRole("menuitem", { name: "Zoom to fit" }).click();
  await expect.poll(() => zoomLevel(page)).toBe(fitted);

  expect(problems).toEqual([]);
});

test("zoom shortcuts and the zoom limits work", async ({ page }) => {
  const { problems } = await openStudio(page);

  await page.keyboard.press("Shift+Digit0");
  await expect.poll(() => zoomLevel(page)).toBe("100%");

  await page.keyboard.press("Equal");
  await expect.poll(() => zoomLevel(page)).toBe("125%");

  await page.keyboard.press("Minus");
  await expect.poll(() => zoomLevel(page)).toBe("100%");

  // Past the top of the range the command stops and the menu item disables.
  for (let step = 0; step < 12; step++) await page.keyboard.press("Equal");
  await expect.poll(() => zoomLevel(page)).toBe("400%");

  await zoomTrigger(page).click();
  await expect(page.getByRole("menuitem", { name: "Zoom in" })).toBeDisabled();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Shift+Digit1");
  await expect.poll(() => zoomLevel(page)).not.toBe("400%");

  expect(problems).toEqual([]);
});

test("a pinch zooms about the pointer while a scroll only pans", async ({
  page,
}) => {
  const { canvas, problems } = await openStudio(page);

  await addButton(page, "Electrical Adjustable Desk").click();

  const desk = await findSprite(page, canvas);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no box");

  // A trackpad pinch reaches the browser as ctrl + wheel. Anchored on the desk,
  // it must zoom in and leave the desk under the pointer.
  const before = await zoomLevel(page);
  await page.mouse.move(desk.x, desk.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");

  await expect.poll(() => zoomLevel(page)).not.toBe(before);
  expect(await cursorOver(page, desk)).toBe("grab");

  // A plain two-finger scroll pans instead: the desk moves, the zoom does not.
  const zoomed = await zoomLevel(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);

  await expect
    .poll(() => cursorOver(page, { x: desk.x, y: desk.y - 200 }), {
      message: "the desk should have scrolled up with the camera",
    })
    .toBe("grab");
  expect(await zoomLevel(page)).toBe(zoomed);

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
