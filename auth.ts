import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Extend the built-in session types
declare module "next-auth" {
  interface User {
    role?: string;
    storeId?: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string;
    } & DefaultSession["user"];
  }
}

export const { auth, signIn, signOut, handlers: { GET, POST } } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), pin: z.string().min(4) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, pin } = parsedCredentials.data;
          
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) return null;

          const passwordsMatch = await bcrypt.compare(pin, user.pin);

          if (passwordsMatch) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              storeId: user.storeId,
            };
          }
        }

        console.log("Invalid credentials");
        return null;
      },
    }),
  ],
});
