import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
    };
  }

  interface User {
    id: string;
    name: string;
    username: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string;
  }
}