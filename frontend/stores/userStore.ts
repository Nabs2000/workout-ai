import { create } from 'zustand';
import { UserProfile } from '../types';
import { storage } from '../services/storage';

interface UserState {
  userId: string | null;
  profile: UserProfile | null;
  isOnboarded: boolean;
  isLoading: boolean;
  setProfile: (profile: UserProfile) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  profile: null,
  isOnboarded: false,
  isLoading: true,

  setProfile: async (profile) => {
    await storage.saveUser(profile);
    await storage.setOnboarded();
    set({ profile, userId: profile.userId, isOnboarded: true });
  },

  loadFromStorage: async () => {
    const [profile, onboarded] = await Promise.all([
      storage.getUser(),
      storage.isOnboarded(),
    ]);
    set({
      profile,
      userId: profile?.userId ?? null,
      isOnboarded: onboarded,
      isLoading: false,
    });
  },

  reset: async () => {
    await storage.clear();
    set({ profile: null, userId: null, isOnboarded: false });
  },
}));
