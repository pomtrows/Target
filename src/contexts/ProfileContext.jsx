import { createContext, useContext, useState, useEffect } from 'react';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  // Try to load from localStorage, default to 'perso'
  const [currentProfile, setCurrentProfile] = useState(() => {
    return localStorage.getItem('target_current_profile') || 'perso';
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('target_current_profile', currentProfile);
  }, [currentProfile]);

  return (
    <ProfileContext.Provider value={{ currentProfile, setCurrentProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
