import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "./index";
import { categories, type CategoryKind } from "./schema";

const DEFAULT_TREE: {
  kind: CategoryKind;
  name: string;
  children: string[];
}[] = [
  {
    kind: "income",
    name: "Receitas",
    children: [
      "Salário",
      "Pró-labore",
      "Distribuição de lucros",
      "Rendimentos",
      "Outras receitas",
    ],
  },
  {
    kind: "expense",
    name: "Despesas",
    children: [
      "Moradia",
      "Alimentação",
      "Transporte",
      "Saúde",
      "Educação",
      "Lazer",
      "Impostos",
      "Juros",
      "Outras despesas",
    ],
  },
];

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listCategories(userId: string, kind?: CategoryKind) {
  const uid = requireUserId(userId);
  if (kind) {
    return getDb()
      .select()
      .from(categories)
      .where(and(eq(categories.userId, uid), eq(categories.kind, kind)));
  }
  return getDb().select().from(categories).where(eq(categories.userId, uid));
}

export async function getCategory(userId: string, categoryId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(categories)
    .where(and(eq(categories.userId, uid), eq(categories.id, categoryId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findCategoryByName(
  userId: string,
  name: string,
  kind?: CategoryKind,
) {
  const uid = requireUserId(userId);
  const conditions = [eq(categories.userId, uid), eq(categories.name, name)];
  if (kind) {
    conditions.push(eq(categories.kind, kind));
  }
  const rows = await getDb()
    .select()
    .from(categories)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

export async function ensureDefaultCategories(userId: string) {
  const uid = requireUserId(userId);
  const existing = await getDb()
    .select()
    .from(categories)
    .where(and(eq(categories.userId, uid), isNull(categories.parentId)))
    .limit(1);
  if (!existing[0]) {
    for (const group of DEFAULT_TREE) {
      const [parent] = await getDb()
        .insert(categories)
        .values({
          userId: uid,
          name: group.name,
          kind: group.kind,
          parentId: null,
        })
        .returning();
      for (const childName of group.children) {
        await getDb().insert(categories).values({
          userId: uid,
          name: childName,
          kind: group.kind,
          parentId: parent.id,
        });
      }
    }
  }

  await ensureNamedCategory(uid, "Juros", "expense");
  return listCategories(uid);
}

export async function ensureNamedCategory(
  userId: string,
  name: string,
  kind: CategoryKind,
) {
  const uid = requireUserId(userId);
  const found = await findCategoryByName(uid, name, kind);
  if (found) {
    return found;
  }

  const parents = await getDb()
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, uid),
        eq(categories.kind, kind),
        isNull(categories.parentId),
      ),
    )
    .limit(1);
  const parent = parents[0];
  if (!parent) {
    return null;
  }

  const [created] = await getDb()
    .insert(categories)
    .values({
      userId: uid,
      name,
      kind,
      parentId: parent.id,
    })
    .returning();
  return created;
}
