import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware() {
    // This middleware runs for all protected routes
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/signin (signin page)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|auth/signin).*)',
  ],
};
