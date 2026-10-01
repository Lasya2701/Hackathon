export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'admin';
  studentId?: string;
  createdAt: string;
}

const AUTH_STORAGE_KEY = 'campusfind_auth_current_user';
const USERS_STORAGE_KEY = 'campusfind_registered_users';

// Pre-configured test accounts for development & demo testing
export const TEST_PERSONAS: AppUser[] = [
  {
    id: 'user_owner_demo',
    name: 'Student Owner',
    email: '24951805E0@gmail.com',
    role: 'student',
    studentId: 'STU-249518',
    createdAt: '2026-09-28T09:00:00Z',
  },
  {
    id: 'user_finder_demo',
    name: 'Campus Finder',
    email: 'campus.finder@gmail.com',
    role: 'student',
    studentId: 'STU-882143',
    createdAt: '2026-09-28T10:00:00Z',
  },
  {
    id: 'user_security_admin',
    name: 'Officer Martinez',
    email: 'security.officer@campusfind.edu',
    role: 'admin',
    studentId: 'STAFF-ADM-01',
    createdAt: '2026-09-20T08:00:00Z',
  },
];

export function getStoredUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const parsed: AppUser[] = raw ? JSON.parse(raw) : [];
    // Ensure test personas are present in users list
    const combined = [...parsed];
    for (const persona of TEST_PERSONAS) {
      if (!combined.some(u => u.email.toLowerCase() === persona.email.toLowerCase())) {
        combined.push(persona);
      }
    }
    return combined;
  } catch {
    return TEST_PERSONAS;
  }
}

export function getCurrentUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AppUser | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    // Dispatch custom event for reactive UI updates
    window.dispatchEvent(new Event('campusfind_auth_changed'));
  } catch (e) {
    console.error('Failed to set current user:', e);
  }
}

export function registerUser(params: {
  name: string;
  email: string;
  password?: string;
  role?: 'student' | 'staff';
  studentId?: string;
}): AppUser {
  const email = params.email.trim().toLowerCase();
  const existing = getStoredUsers();

  const found = existing.find(u => u.email.toLowerCase() === email);
  if (found) {
    setCurrentUser(found);
    return found;
  }

  const newUser: AppUser = {
    id: 'user_' + Date.now(),
    name: params.name.trim(),
    email,
    role: params.role || 'student',
    studentId: params.studentId || `STU-${Math.floor(100000 + Math.random() * 900000)}`,
    createdAt: new Date().toISOString(),
  };

  const updated = [newUser, ...existing];
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save registered users:', e);
  }

  setCurrentUser(newUser);
  return newUser;
}

export function loginUser(email: string, _password?: string): AppUser {
  const cleanEmail = email.trim().toLowerCase();
  const users = getStoredUsers();
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    // Auto-create profile for smooth student experience
    const derivedName = cleanEmail.split('@')[0].replace(/[._]/g, ' ');
    const formattedName = derivedName
      ? derivedName.charAt(0).toUpperCase() + derivedName.slice(1)
      : 'Campus Member';

    user = {
      id: 'user_' + Date.now(),
      name: formattedName,
      email: cleanEmail,
      role: cleanEmail.includes('admin') || cleanEmail.includes('security') ? 'admin' : 'student',
      studentId: `STU-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([user, ...users]));
    } catch (e) {
      console.error(e);
    }
  }

  setCurrentUser(user);
  return user;
}

export function logoutUser(): void {
  setCurrentUser(null);
}
