import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types.ts';

export const DEMO_PRESET_USERS: AppUser[] = [
  {
    id: 'user_a_tester',
    name: 'Kavya Sri',
    email: '24951a05e0@gmail.com',
    role: 'Student (Owner)',
    phone: '9640526975',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_b_finder',
    name: 'Alex Taylor',
    email: 'alex.finder@campus.edu',
    role: 'Student (Finder)',
    phone: '9876543210',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_security_admin',
    name: 'Officer Martinez',
    email: 'security.desk@campus.edu',
    role: 'Campus Security',
    createdAt: new Date().toISOString(),
  },
];

interface AuthContextType {
  currentUser: AppUser | null;
  login: (email: string, name?: string, phone?: string) => AppUser;
  register: (email: string, name: string, phone?: string) => AppUser;
  logout: () => void;
  switchUser: (user: AppUser) => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'campusfind_auth_user_v4';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem('campusfind_auth_user_v3') || localStorage.getItem('campusfind_auth_user_v2') || localStorage.getItem('campusfind_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email && (parsed.email.toLowerCase().includes('24951805e0') || parsed.email.toLowerCase().includes('24951ao5e9') || parsed.email.toLowerCase().includes('24951a05e0'))) {
          parsed.email = '24951a05e0@gmail.com';
        }
        return parsed;
      }
    } catch (e) {
      // ignore
    }
    // Default to User A for seamless testing
    return DEMO_PRESET_USERS[0];
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      // ignore
    }
  }, [currentUser]);

  const login = (email: string, name?: string, phone?: string): AppUser => {
    const cleanEmail = email.trim();
    const existing = DEMO_PRESET_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail.toLowerCase()
    );
    const user: AppUser = {
      id: existing ? existing.id : 'usr_' + Date.now(),
      name: name?.trim() || existing?.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: existing?.role || 'Student',
      phone: phone || existing?.phone || '',
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    return user;
  };

  const register = (email: string, name: string, phone?: string): AppUser => {
    return login(email, name, phone);
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUser = (user: AppUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        register,
        logout,
        switchUser,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
