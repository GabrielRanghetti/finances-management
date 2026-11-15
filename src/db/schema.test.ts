import { expect, test } from "vitest";

import { accounts, entities } from "./schema";

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
