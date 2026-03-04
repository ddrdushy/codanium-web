import bcrypt from 'bcryptjs';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  image: string | null;
}

// Pre-hashed passwords for demo accounts
// user@demo.com → password123
// admin@demo.com → admin123
const HASHED_USER_PW = bcrypt.hashSync('password123', 10);
const HASHED_ADMIN_PW = bcrypt.hashSync('admin123', 10);

export const mockUsers: MockUser[] = [
  {
    id: 'usr-001',
    name: 'Demo User',
    email: 'user@demo.com',
    password: HASHED_USER_PW,
    role: 'user',
    image: null,
  },
  {
    id: 'usr-002',
    name: 'Admin User',
    email: 'admin@demo.com',
    password: HASHED_ADMIN_PW,
    role: 'admin',
    image: null,
  },
];

export function findUserByEmail(email: string): MockUser | undefined {
  return mockUsers.find(u => u.email === email);
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  return bcrypt.compareSync(password, hashedPassword);
}
