import { z } from "zod";
import { isWeakPassword } from "@/lib/auth/password.policy";

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  /** Redis 启用时必填；未启用 Redis 时可省略 */
  captchaId: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional(),
}).superRefine((val, ctx) => {
  if (isWeakPassword(val.password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "密码过于简单",
    });
  }
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;

