import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnCashier = nextUrl.pathname.startsWith("/cashier");
      const isOnAttendance = nextUrl.pathname.startsWith("/attendance");

      if (isOnLogin) {
        if (isLoggedIn) {
          // If already logged in, redirect based on role
          const role = auth.user.role as string;
          if (role === "admin" || role === "super_admin") {
            return Response.redirect(new URL("/admin/dashboard", nextUrl));
          } else {
            return Response.redirect(new URL("/attendance", nextUrl));
          }
        }
        return true;
      }

      if (!isLoggedIn && (isOnAdmin || isOnCashier || isOnAttendance || nextUrl.pathname === "/")) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (isLoggedIn) {
        const role = auth.user.role as string;

        // Admin blocks
        if (isOnAdmin && role !== "super_admin" && role !== "admin") {
          return Response.redirect(new URL("/attendance", nextUrl));
        }

        // Cashier blocks (Admin can view cashier if needed, but Kasir/Pramuniaga cannot view Admin)
        if ((isOnCashier || isOnAttendance) && (role === "super_admin" || role === "admin")) {
          // Admin shouldn't really be doing cashier duties, but we allow view.
          return true;
        }
      }

      return true;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      if (token.role && session.user) {
        session.user.role = token.role as string;
      }
      if (token.storeId && session.user) {
        session.user.storeId = token.storeId as string;
      }
      if (token.storeName && session.user) {
        session.user.storeName = token.storeName as string;
      }
      return session;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.storeId = user.storeId;
        token.storeName = user.storeName;
      }
      // If we update session later (e.g., override role to act as cashier)
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
  },
  providers: [], // configure in auth.ts
} satisfies NextAuthConfig;
