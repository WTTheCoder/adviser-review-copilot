import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/demo/seedDemoData.js";

const prisma = new PrismaClient();

try {
  await prisma.$transaction((transaction) => seedDemoData(transaction));
  console.log("Seeded fictional Alex Taylor demo data.");
} finally {
  await prisma.$disconnect();
}
