import { prisma } from "@/lib/prisma";

export async function findUserForLogin(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function userExistsByEmail(email: string) {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!existing;
}

export async function createUser(input: { email: string; password: string; name?: string }) {
  return prisma.user.create({
    data: { email: input.email, password: input.password, name: input.name },
    select: { id: true, email: true, name: true },
  });
}

