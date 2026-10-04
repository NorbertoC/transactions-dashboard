import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isAllowedEmail, isAuthorizedIdentity } from '@/lib/auth-policy';

export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  })],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/auth/signin' },
  callbacks: {
    async signIn({ user, account, profile }) {
      return account?.provider === 'google' && (profile as { email_verified?: unknown } | undefined)?.email_verified === true && isAllowedEmail(user.email);
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
        token.emailVerified = account.provider === 'google' && (profile as { email_verified?: unknown } | undefined)?.email_verified === true;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.provider = token.provider;
      session.user.emailVerified = token.emailVerified === true;
      session.user.authorized = isAuthorizedIdentity(session.user);
      return session;
    },
  },
  logger: {
    error(code) { console.error('Authentication failed:', code); },
    warn(code) { console.warn('Authentication warning:', code); },
    debug() {},
  },
  secret: process.env.NEXTAUTH_SECRET,
};
