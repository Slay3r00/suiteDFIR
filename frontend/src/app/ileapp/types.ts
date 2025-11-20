export interface Module {
  name: string;
  category: string;
  display_name: string;
  module_name: string;
  enabled: boolean;
  selected: boolean;
}

export interface Profile {
  id: number;
  name: string;
  modules: string[];
  created_at: string;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type Status = 'idle' | 'processing' | 'completed' | 'error' | 'stopped';