import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

// Whitelist of allowed emails (only these emails can login)
const ALLOWED_EMAILS = [
  process.env.ALLOWED_EMAIL_1,
  process.env.ALLOWED_EMAIL_2,
  // Add more emails as needed
].filter(Boolean); // Remove undefined values

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Check credentials against environment variables
        const validUsers = [
          {
            id: '1',
            name: 'Norberto',
            username: process.env.USER_1_USERNAME,
            password: process.env.USER_1_PASSWORD,
          },
          {
            id: '2',
            name: 'Spouse',
            username: process.env.USER_2_USERNAME,
            password: process.env.USER_2_PASSWORD,
          }
        ];

        const user = validUsers.find(
          u => u.username === credentials.username && u.password === credentials.password
        );

        if (user && user.username) {
          return {
            id: user.id,
            name: user.name,
            username: user.username,
          };
        }

        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow credentials login (username/password)
      if (account?.provider === 'credentials') {
        return true;
      }

      // For Google login, check if email is whitelisted
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase();
        if (email && ALLOWED_EMAILS.map(e => e?.toLowerCase()).includes(email)) {
          return true;
        }
        // Reject login if email not in whitelist
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };