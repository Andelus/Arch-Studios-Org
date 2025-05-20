# Arch Studios Theme-Aware Organization Management

This document outlines the implementation of theme-aware UI components for Arch Studios organization management features.

## Implementation Overview

We've implemented a comprehensive theming system that automatically adapts the UI based on the user's system preferences (light/dark mode). The implementation includes:

1. **System Theme Detection**: Using a custom hook to detect and respond to OS theme preferences
2. **Theme-Aware Components**: Making all organization-related UI adapt to the detected theme
3. **Consistent Theme Application**: Ensuring a uniform appearance across all components
4. **Responsive Design**: Components adapt to both theme changes and screen sizes

## Key Components

### 1. `useSystemTheme` Hook (src/hooks/useSystemTheme.ts)

A custom React hook that:
- Detects the user's system theme preference using `prefers-color-scheme` media query
- Handles SSR by properly initializing on the client side
- Returns the appropriate Clerk theme object for dark mode or undefined for light mode
- Listens for theme changes in real-time and updates components accordingly
- Persists user theme preferences in localStorage
- Provides isDark boolean for easy theme condition checking

### 2. `ThemeProvider` Component (src/components/ThemeProvider.tsx)

A wrapper component that:
- Provides theme context to the entire application
- Integrates with Clerk's theming system
- Sets appropriate appearance properties for each theme
- Handles the transition between themes with smooth CSS animations
- Exposes toggleTheme function for manual theme switching

### 3. `AnimatedProfileIcon` Component (src/components/AnimatedProfileIcon.tsx)

A reusable profile icon component that:
- Dynamically generates user avatars with initials based on name
- Creates consistent color assignment based on username
- Adapts to light and dark themes automatically
- Includes animated status indicators (online, offline, away)
- Features smooth hover animations
- Fully supports accessibility with ARIA attributes and keyboard navigation
- Available in multiple sizes (small, medium, large)

### 3. Theme-Aware Clerk Components

We've updated all Clerk components to be theme-aware:
- **CreateOrganization**: For creating new organizations
- **OrganizationList**: For displaying and managing organizations
- **OrganizationSwitcher**: For switching between organizations
- **Organization Modals**: Accessed through `window.Clerk`

### 4. CSS Modules with Theme Variables

CSS modules have been updated to use variables that change based on the theme:
- **Light Mode**: Clean, bright interface with subtle shadows
- **Dark Mode**: Dark interface with proper contrast and reduced eye strain

## Usage

The theme system works automatically based on the user's system preferences, but also provides manual theme toggle functionality through the useTheme hook.

To use the theme system in a new component:

```tsx
// Import the system theme hook
import { useSystemTheme } from "../hooks/useSystemTheme";

// In your component
const MyComponent = () => {
  // Get the current system theme
  const systemTheme = useSystemTheme();
  
  return (
    <ClerkComponent
      appearance={{
        // Pass the system theme to Clerk components
        baseTheme: systemTheme,
        variables: {
          colorPrimary: "#4facfe",
        },
        elements: {
          // Light mode styles (default)
          card: {
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
          },
          // Dark mode styles
          "card.dark": {
            backgroundColor: "#0d0d0d",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          }
        }
      }}
    />
  );
};
```

For CSS modules, use media queries for theme-specific styles:

```css
.container {
  background: linear-gradient(to bottom, var(--background-gradient-start, #f8f8f8), var(--background-gradient-end, #e8e8e8));
  color: var(--foreground, #171717);
}

/* Dark mode styles */
@media (prefers-color-scheme: dark) {
  .container {
    background: linear-gradient(to bottom, #0a0a0a, #1a1a1a);
    color: #ffffff;
  }
}
```

### Using the AnimatedProfileIcon Component

The AnimatedProfileIcon component can be used throughout the application to display user avatars with theme awareness:

```tsx
import AnimatedProfileIcon from "@/components/AnimatedProfileIcon";

// Basic usage with just a name
<AnimatedProfileIcon name="John Doe" />

// With status indicator
<AnimatedProfileIcon 
  name="Jane Smith" 
  status="online" // or "offline" or "away"
/>

// Custom size
<AnimatedProfileIcon 
  name="Alex Johnson" 
  size="large" // or "medium" or "small"
/>

// Disable animations
<AnimatedProfileIcon 
  name="Sam Wilson" 
  animated={false}
/>

// With additional class names
<AnimatedProfileIcon 
  name="Taylor Swift" 
  className="my-custom-class"
/>
```

### Using the Theme Toggle

To add a theme toggle to your component:

```tsx
import { useTheme } from "@/components/ThemeProvider";

const MyComponent = () => {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    </button>
  );
};
```

## Testing

Test the theme implementation by changing your system's theme preference in your OS settings. The application should respond automatically without requiring a refresh.

Key pages to test:
- `/onboarding`: For new users setting up their account
- `/dashboard`: Main dashboard with organization banner
- `/setup-organization`: Dedicated page for organization setup
- All components with AnimatedProfileIcon implementation
- Theme toggle functionality

See the `test-theme-verification.md` file for detailed verification steps.
