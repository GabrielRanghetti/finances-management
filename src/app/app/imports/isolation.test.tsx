import { migrate } from "drizzle-orm/pglite/migrator";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

const { getSession, notFound } = vi.hoisted(() => ({
  getSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import ImportsPage from "./page";
import CsvImportPage from "./csv/page";
import OfxImportPage from "./ofx/page";
import PdfImportPage from "./pdf/page";
import { createAccount } from "@/db/accounts";
import { getDb } from "@/db/index";
import { user } from "@/db/schema";

beforeAll(async () => {
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "./drizzle" });
});

async function createUser(id: string, email: string) {
  const now = new Date();
  await getDb().insert(user).values({
    id,
    name: id,
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  return { id, email, name: id };
}

function asSession(u: { id: string; email: string; name: string }) {
  return {
    user: u,
    session: { id: `session-${u.id}`, userId: u.id },
  };
}

describe("imports route isolation", () => {
  test("OFX import page only lists the caller's accounts", async () => {
    const userA = await createUser("import-route-a", "import-a@example.com");
    const userB = await createUser("import-route-b", "import-b@example.com");

    await createAccount(userA.id, {
      name: "Conta Import A",
      type: "bank",
      currency: "BRL",
    });
    await createAccount(userB.id, {
      name: "Conta Import B",
      type: "bank",
      currency: "BRL",
    });

    getSession.mockResolvedValue(asSession(userA));
    const html = renderToStaticMarkup(await OfxImportPage());
    expect(html).toContain("Conta Import A");
    expect(html).not.toContain("Conta Import B");

    getSession.mockResolvedValue(asSession(userB));
    const htmlCsv = renderToStaticMarkup(await CsvImportPage());
    expect(htmlCsv).toContain("Conta Import B");
    expect(htmlCsv).not.toContain("Conta Import A");

    getSession.mockResolvedValue(asSession(userA));
    const htmlPdf = renderToStaticMarkup(await PdfImportPage());
    expect(htmlPdf).toContain("Conta Import A");
    expect(htmlPdf).not.toContain("Conta Import B");

    const htmlIndex = renderToStaticMarkup(await ImportsPage());
    expect(htmlIndex).toContain("OFX");
    expect(htmlIndex).toContain("CSV");
    expect(htmlIndex).toContain("PDF");
  });
});
