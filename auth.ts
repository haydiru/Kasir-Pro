import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { z } from "zod";

// Extend the built-in session types
declare module "next-auth" {
  interface User {
    role?: string;
    storeId?: string;
    storeName?: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      storeId: string;
      storeName: string;
    } & DefaultSession["user"];
  }
}

// How often the JWT's role/storeId is re-validated against the database
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const { auth, signIn, signOut, handlers: { GET, POST } } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.storeId = user.storeId;
        token.storeName = user.storeName;
        token.refreshedAt = Date.now();
        return token;
      }

      const refreshedAt = typeof token.refreshedAt === "number" ? token.refreshedAt : 0;
      if (token.sub && Date.now() - refreshedAt > TOKEN_REFRESH_INTERVAL_MS) {
        const { prisma } = await import("@/lib/prisma");
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, storeId: true, store: { select: { name: true } } },
        });

        // User was removed: invalidate the session
        if (!dbUser) return null;

        token.role = dbUser.role;
        token.storeId = dbUser.storeId;
        token.storeName = dbUser.store?.name || "KasirPro Store";
        token.refreshedAt = Date.now();
      }

      return token;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), pin: z.string().min(4) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, pin } = parsedCredentials.data;
          
          try {
            const { prisma } = await import("@/lib/prisma");
            const bcrypt = await import("bcryptjs");
            const { logActivitySafe } = await import("@/lib/activity-log");

            const user = await prisma.user.findUnique({
              where: { email },
              include: { store: true }
            });

            if (!user) {
              console.log("Authorize: User not found", email);
              await logActivitySafe(prisma, {
                action: "LOGIN_FAILED",
                entityType: "User",
                summary: `Login gagal: email tidak terdaftar (${email})`,
              });
              return null;
            }

            const passwordsMatch = await bcrypt.compare(pin, user.pin);
            const actor = { id: user.id, name: user.name, role: user.role, storeId: user.storeId };

            if (!passwordsMatch) {
              // Pelaku belum terbukti pemilik akun, jadi tidak dicatat sebagai actor
              await logActivitySafe(prisma, {
                storeId: user.storeId,
                action: "LOGIN_FAILED",
                entityType: "User",
                entityId: user.id,
                summary: `Login gagal: PIN salah untuk ${user.email}`,
              });
            }

            if (passwordsMatch) {
              await logActivitySafe(prisma, {
                actor,
                action: "LOGIN",
                entityType: "User",
                entityId: user.id,
                summary: `${user.name} login`,
              });
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                storeId: user.storeId,
                storeName: user.store?.name || "KasirPro Store",
              };
            }
          } catch (error) {
            console.error("Authorize error:", error);
            return null;
          }
        }

        console.log("Invalid credentials or parsing failed");
        return null;
      },
    }),
  ],
});
