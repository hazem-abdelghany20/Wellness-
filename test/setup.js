import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock import.meta.env for tests
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// jsdom doesn't implement matchMedia; some components query it
window.matchMedia = window.matchMedia || (() => ({
  matches: false, addListener: vi.fn(), removeListener: vi.fn(),
}));
