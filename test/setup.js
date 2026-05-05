import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Vitest 4: import.meta.env is non-assignable; use stubEnv instead of direct mutation.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// jsdom doesn't implement matchMedia. Modern libraries (Radix, Framer) call the
// EventTarget API (addEventListener/removeEventListener/dispatchEvent), so cover
// both the legacy MediaQueryList and the modern surface.
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => false),
}));
