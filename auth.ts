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
          
          console.log("Attempting to find user with email:", email);
          try {
            const user = await prisma.user.findUnique({
              where: { email },
            });

            if (!user) {
              console.log("Auth: User not found in database.");
              return null;
            }

            console.log("Auth: User found, comparing PIN...");
            const passwordsMatch = await bcrypt.compare(pin, user.pin);

            if (passwordsMatch) {
              console.log("Auth: PIN matches, logging in...");
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                storeId: user.storeId,
              };
            } else {
              console.log("Auth: PIN does not match.");
            }
          } catch (dbError) {
            console.error("Auth Database Error:", dbError);
            throw dbError;
          }
        }

        console.log("Invalid credentials or parsing failed");
        return null;
      },
    }),
  ],
});
