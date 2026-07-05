import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  // Exclude: api, _next/static, _next/image, .png files, and /share (public pages)
  matcher: ['/((?!api|_next/static|_next/image|share|.*\\.png$).*)'],
};
