import { useState, useEffect } from 'react';
import { ileappApi } from '../services/ileappApi';
import { Profile } from '../app/ileapp/types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await ileappApi.profiles.getAll();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = async (profileId: number) => {
    try {
      const data = await ileappApi.profiles.load(profileId);
      await fetchProfiles();
      return data.message;
    } catch (error) {
      console.error('Failed to load profile:', error);
      throw error;
    }
  };

  const saveProfile = async (name: string, modules: string[]) => {
    try {
      const data = await ileappApi.profiles.save(name, modules);
      await fetchProfiles();
      return data.name;
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw error;
    }
  };

  const deleteProfile = async (profileId: number) => {
    try {
      const data = await ileappApi.profiles.delete(profileId);
      await fetchProfiles();
      return data.message;
    } catch (error) {
      console.error('Failed to delete profile:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return {
    profiles,
    isLoading,
    fetchProfiles,
    loadProfile,
    saveProfile,
    deleteProfile,
  };
}