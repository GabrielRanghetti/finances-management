import { expect, test } from "vitest";

import { accounts, categories, entities, transactions } from "./schema";

test("accounts table carries user_id and no float money columns", () => {
  expect(accounts.userId.name).toBe("user_id");
  expect(Object.keys(accounts)).toEqual(
    expect.arrayContaining([
      "id",
      "userId",
      "entityId",
      "name",
      "type",
      "currency",
      "institution",
      "archived",
      "createdAt",
    ]),
  );
});

test("entities table carries user_id", () => {
  expect(entities.userId.name).toBe("user_id");
  expect(Object.keys(entities)).toEqual(
    expect.arrayContaining([
      "id",
      "userId",
      "type",
      "name",
      "documentNumber",
      "createdAt",
    ]),
  );
});

test("transactions store money as integer cents", () => {
  expect(transactions.userId.name).toBe("user_id");
  expect(transactions.amountCents.name).toBe("amount_cents");
  expect(categories.userId.name).toBe("user_id");
});
