import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends DefaultUser {
    role?: 'user' | 'admin';
  }

  interface Session {
    user: {
      id?: string;
      role?: 'user' | 'admin';
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role?: 'user' | 'admin';
    id?: string;
  }
}
