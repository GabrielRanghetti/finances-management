import { expect, test } from "vitest";

import {
  accounts,
  categories,
  connectionAccountMaps,
  connections,
  csvImportMappings,
  entities,
  fxRates,
  loanTerms,
  transactions,
  valuations,
} from "./schema";

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
      "closingDay",
      "acquisitionCostCents",
      "acquisitionDate",
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

test("loan_terms stores principal as cents and rate as numeric", () => {
  expect(loanTerms.userId.name).toBe("user_id");
  expect(loanTerms.principalCents.name).toBe("principal_cents");
  expect(loanTerms.monthlyInterestRate.name).toBe("monthly_interest_rate");
});

test("valuations store value as integer cents", () => {
  expect(valuations.userId.name).toBe("user_id");
  expect(valuations.valueCents.name).toBe("value_cents");
});

test("csv_import_mappings carries user_id", () => {
  expect(csvImportMappings.userId.name).toBe("user_id");
  expect(csvImportMappings.accountId.name).toBe("account_id");
});

test("connections and maps carry user_id", () => {
  expect(connections.userId.name).toBe("user_id");
  expect(connectionAccountMaps.userId.name).toBe("user_id");
});

test("fx_rates has no user_id and stores rates as numeric", () => {
  expect(Object.keys(fxRates)).toEqual(
    expect.arrayContaining([
      "id",
      "currency",
      "date",
      "buyRate",
      "sellRate",
      "createdAt",
    ]),
  );
  expect(Object.keys(fxRates)).not.toContain("userId");
  expect(fxRates.buyRate.name).toBe("buy_rate");
  expect(fxRates.sellRate.name).toBe("sell_rate");
});
