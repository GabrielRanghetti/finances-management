import { expect, test } from "vitest";

import { accounts } from "./schema";

test("accounts table carries user_id and no float money columns", () => {
  expect(accounts.userId.name).toBe("user_id");
  expect(Object.keys(accounts)).toEqual(
    expect.arrayContaining(["id", "userId", "name", "type", "currency", "createdAt"]),
  );
});
