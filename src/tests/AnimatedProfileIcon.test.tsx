import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnimatedProfileIcon from '../components/AnimatedProfileIcon';
import { useSystemTheme } from '../hooks/useSystemTheme';

// Mock the theme hook
vi.mock('../hooks/useSystemTheme', () => ({
  useSystemTheme: vi.fn()
}));

describe('AnimatedProfileIcon Component', () => {
  beforeEach(() => {
    // Default mock implementation
    (useSystemTheme as any).mockReturnValue({
      theme: 'light',
      isDark: false,
      setTheme: vi.fn(),
      toggleTheme: vi.fn()
    });
  });

  it('renders correctly with name and generates proper initials', () => {
    render(<AnimatedProfileIcon name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByTestId('animated-profile-icon')).toBeInTheDocument();
  });

  it('handles single name correctly', () => {
    render(<AnimatedProfileIcon name="Madonna" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('applies different size classes', () => {
    const { rerender } = render(<AnimatedProfileIcon name="John Doe" size="small" />);
    expect(screen.getByTestId('animated-profile-icon').classList.contains('small')).toBeTruthy();
    
    rerender(<AnimatedProfileIcon name="John Doe" size="large" />);
    expect(screen.getByTestId('animated-profile-icon').classList.contains('large')).toBeTruthy();
  });

  it('shows status indicator when status is provided', () => {
    render(<AnimatedProfileIcon name="John Doe" status="online" />);
    const icon = screen.getByTestId('animated-profile-icon');
    expect(icon.querySelector('.statusIndicator')).toBeInTheDocument();
    expect(icon.querySelector('.online')).toBeInTheDocument();
  });

  it('handles animations on hover when animated is true', () => {
    render(<AnimatedProfileIcon name="John Doe" animated={true} />);
    const icon = screen.getByTestId('animated-profile-icon');
    
    fireEvent.mouseEnter(icon);
    expect(icon.querySelector('.animatedInitials')).toBeInTheDocument();
    
    fireEvent.mouseLeave(icon);
    expect(icon.querySelector('.animatedInitials')).not.toBeInTheDocument();
  });

  it('applies dark mode styling when theme is dark', () => {
    (useSystemTheme as any).mockReturnValue({
      theme: 'dark',
      isDark: true,
      setTheme: vi.fn(),
      toggleTheme: vi.fn()
    });
    
    render(<AnimatedProfileIcon name="John Doe" />);
    expect(screen.getByTestId('animated-profile-icon').classList.contains('dark')).toBeTruthy();
  });
});
