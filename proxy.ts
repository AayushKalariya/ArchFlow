import { clerkMiddleware } from "@clerk/nextjs/server";

const publicPaths = [
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in",
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up",
].map((path) => path.replace(/\/+$/, ""));

export const proxy = clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const isPublicRoute = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!isPublicRoute) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
