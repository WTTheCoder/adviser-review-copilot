import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://client_review:local_demo_password@localhost:5432/client_review_prep?schema=public";

export const prisma = new PrismaClient();
