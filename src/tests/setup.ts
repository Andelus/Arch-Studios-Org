// src/tests/setup.ts
import { vi, expect } from 'vitest';
import '@testing-library/jest-dom';

// Add custom matchers directly
import { 
  toBeInTheDocument,
  toHaveTextContent,
  toBeVisible,
  toBeDisabled
} from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect method with jest-dom matchers
expect.extend({ 
  toBeInTheDocument,
  toHaveTextContent,
  toBeVisible,
  toBeDisabled
});

// Mock the next/image module
vi.mock('next/image', () => ({
  default: (props: any) => {
    return {
      type: 'img',
      props: {
        ...props,
        src: props.src,
        alt: props.alt || '',
        width: props.width,
        height: props.height
      }
    };
  },
}));

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
