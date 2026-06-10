import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware() {
    // This middleware runs for all protected routes
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes including auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico / icon.svg (favicons)
     * - manifest.webmanifest (PWA manifest, must be public for install)
     * - auth (all auth pages)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|auth).*)',
  ],
};
