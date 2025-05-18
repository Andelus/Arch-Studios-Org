# Theme-Aware Organization Management Features - Verification Steps

This document outlines steps to verify that all components properly adapt to the user's system theme preferences (light/dark mode).

## Prerequisites
- A browser that supports system theme preferences
- Access to the Arch Studios application

## Verification Steps

### 1. System Theme Detection
- Verify that the `useSystemTheme` hook correctly detects the system's theme preference
- Test by changing the system theme (light/dark) in your OS settings and reload the application
- The hook should return the `dark` theme object when in dark mode and `undefined` (which means light mode in Clerk) when in light mode

### 2. Onboarding Page
- Visit `/onboarding` route and observe the theme
- In light mode: The page should show light background with dark text
- In dark mode: The page should show dark background with light text
- The CreateOrganization component should adapt to the system theme
- The OrganizationList component should adapt to the system theme

### 3. Dashboard Page
- Visit `/dashboard` route
- The organization creation banner should reflect the current system theme
- Clicking "Create Organization" should open Clerk's modal with the appropriate theme

### 4. Setup Organization Page
- Visit `/setup-organization` route
- The page background and content should adapt to the system theme
- The CreateOrganization component should follow the system theme

### 5. Organization Switching
- Test the OrganizationSwitcher in the navigation bar
- The dropdown should properly reflect the system theme
- The organization creation interface within the switcher should follow the system theme

### 6. Theme Transitions
- If possible, test theme changes while the application is running
- The components should respond to theme changes without requiring a refresh

## Common Theme-Related Issues

1. **Fixed Theme Values**: Check for hardcoded theme values that might override the system theme detection
2. **Theme Mismatch**: Components appearing in the wrong theme compared to the rest of the application
3. **Delayed Theme Application**: Theme changes not being applied immediately upon system theme change
4. **Inconsistent Styling**: Some components following the theme while others don't

## Further Testing

When testing with different browsers, pay attention to how each handles:
- The `prefers-color-scheme` media query
- Transitions between light and dark mode
- How quickly the theme changes are reflected in the UI
