import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      email?: string;
      image?: string;
    };
  }

  interface User {
    id: string;
    name: string;
    username: string;
    email?: string;
    image?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string;
  }
}