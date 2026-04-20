import { prisma } from "@/lib/prisma";

export async function createSession(input: { id: string; userId: number; expiresAt: Date; csrfToken: string }) {
  return prisma.session.create({ data: input });
}

export async function deleteSessionById(id: string) {
  return prisma.session.deleteMany({ where: { id } });
}

export async function updateSessionById(id: string, input: { expiresAt: Date; csrfToken: string }) {
  return prisma.session.updateMany({
    where: { id },
    data: input,
  });
}

export async function findValidSession(id: string, now: Date) {
  return prisma.session.findFirst({
    where: { id, expiresAt: { gt: now } },
    select: { id: true, userId: true, expiresAt: true, csrfToken: true },
  });
}

export async function findValidSessionWithUser(id: string, now: Date) {
  return prisma.session.findFirst({
    where: { id, expiresAt: { gt: now } },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

