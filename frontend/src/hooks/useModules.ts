import { useState, useEffect } from 'react';
import { ileappApi } from '../services/ileappApi';
import { Module } from '../app/ileapp/types';

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchModules = async () => {
    setIsLoading(true);
    try {
      const data = await ileappApi.modules.getAll();
      setModules(data.modules);
      const initiallySelected = new Set<string>(
        data.modules.filter((m: Module) => m.selected).map((m: Module) => m.name)
      );
      setSelectedModules(initiallySelected);
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModule = async (name: string, selected: boolean) => {
    const newSelected = new Set<string>(selectedModules);
    if (selected) {
      newSelected.add(name);
    } else {
      newSelected.delete(name);
    }
    setSelectedModules(newSelected);

    try {
      await ileappApi.modules.select({ [name]: selected });
    } catch (error) {
      console.error('Failed to update module:', error);
    }
  };

  const selectAll = async () => {
    const allModuleNames = modules.map(m => m.name);
    const newSelected = new Set<string>(allModuleNames);
    setSelectedModules(newSelected);

    const selectionUpdates: Record<string, boolean> = {};
    modules.forEach(m => {
      selectionUpdates[m.name] = true;
    });

    try {
      await ileappApi.modules.select(selectionUpdates);
    } catch (error) {
      console.error('Failed to update modules:', error);
    }
  };

  const selectNone = async () => {
    setSelectedModules(new Set<string>());

    const selectionUpdates: Record<string, boolean> = {};
    modules.forEach(m => {
      selectionUpdates[m.name] = false;
    });

    try {
      await ileappApi.modules.select(selectionUpdates);
    } catch (error) {
      console.error('Failed to update modules:', error);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  return {
    modules,
    selectedModules,
    isLoading,
    fetchModules,
    toggleModule,
    selectAll,
    selectNone,
  };
}