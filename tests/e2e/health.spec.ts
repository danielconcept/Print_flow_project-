import { expect, test } from "@playwright/test";

test("health endpoint reports PrintFlow is running", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "printflow",
  });
});
