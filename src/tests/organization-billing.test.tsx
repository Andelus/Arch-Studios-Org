import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrganizationBillingClient from '@/app/organization-billing/OrganizationBillingClient';

// Mock hooks and fetch
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'test-user-id',
    isLoaded: true,
    isSignedIn: true,
  }),
  useOrganization: () => ({
    organization: {
      id: 'test-org-id',
      name: 'Test Organization',
      membersCount: 5
    },
    isLoaded: true,
  }),
}));

// Mock CSS modules
vi.mock('@/app/organization-billing/OrganizationBilling.module.css', () => {
  return {
    default: {
      container: 'mock-container',
      contentWrapper: 'mock-contentWrapper',
      mainTitle: 'mock-mainTitle',
      errorMessage: 'mock-errorMessage',
      successMessage: 'mock-successMessage',
      loading: 'mock-loading',
      currentSubscriptionBox: 'mock-currentSubscriptionBox',
      subscriptionHeader: 'mock-subscriptionHeader',
      subscriptionInfo: 'mock-subscriptionInfo',
      orgName: 'mock-orgName',
      subscriptionStatus: 'mock-subscriptionStatus',
      statusBadge: 'mock-statusBadge',
      statusActive: 'mock-statusActive',
      statusExpired: 'mock-statusExpired',
      statusPending: 'mock-statusPending',
      subscriptionDetails: 'mock-subscriptionDetails',
      detailsColumn: 'mock-detailsColumn',
      detailsItem: 'mock-detailsItem',
      detailsLabel: 'mock-detailsLabel',
      detailsValue: 'mock-detailsValue',
      actionButtons: 'mock-actionButtons',
      button: 'mock-button',
      primaryButton: 'mock-primaryButton',
      secondaryButton: 'mock-secondaryButton',
      planSection: 'mock-planSection',
      sectionTitle: 'mock-sectionTitle',
      divider: 'mock-divider',
      planCard: 'mock-planCard',
      planTitle: 'mock-planTitle',
      planDescription: 'mock-planDescription',
      planPrice: 'mock-planPrice',
      pricePeriod: 'mock-pricePeriod',
      featuresList: 'mock-featuresList',
      featureItem: 'mock-featureItem',
      checkmark: 'mock-checkmark',
      planActions: 'mock-planActions',
      customPricingSection: 'mock-customPricingSection',
      modalOverlay: 'mock-modalOverlay',
      modal: 'mock-modal',
      modalHeader: 'mock-modalHeader',
      closeButton: 'mock-closeButton',
      modalContent: 'mock-modalContent',
      form: 'mock-form',
      formGroup: 'mock-formGroup',
      formLabel: 'mock-formLabel',
      formInput: 'mock-formInput',
      formSelect: 'mock-formSelect',
      formTextarea: 'mock-formTextarea',
      formActions: 'mock-formActions',
      dangerButton: 'mock-dangerButton',
      formCheckboxGroup: 'mock-formCheckboxGroup',
      formCheckboxItem: 'mock-formCheckboxItem',
    }
  };
});

// Mock next/font
vi.mock('next/font/google', () => ({
  Inter: () => ({ 
    className: 'mock-inter-font',
    subsets: ['latin'] 
  })
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((param: string) => {
      if (param === 'success') return null;
      if (param === 'error') return null;
      return null;
    }),
  }),
}));

describe('OrganizationBillingClient', () => {
  let originalFetch: typeof global.fetch;
  
  // Setup and teardown
  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn() as any;
  });
  
  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should render the component with no subscription', async () => {
    // Mock subscription API response
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/organization/test-org-id/subscription')) {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: 'No subscription found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(<OrganizationBillingClient />);
    
    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    
    // Check that the subscribe button is rendered
    expect(screen.getByText('Subscribe to Unlimited Plan')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText('Unlimited Plan')).toBeInTheDocument();
  });

  it('should render active subscription details', async () => {
    // Mock active subscription
    const mockSubscription = {
      id: 'sub-123',
      status: 'active',
      plan_type: 'unlimited',
      amount: 200,
      start_date: '2025-05-01T00:00:00Z',
      end_date: '2025-06-01T00:00:00Z',
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/organization/test-org-id/subscription')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSubscription),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(<OrganizationBillingClient />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    
    expect(screen.getByText('Active')).toBeInTheDocument();
    // Use getAllByText and test the first instance for subscription status
    const unlimitedPlanTexts = screen.getAllByText('Unlimited Plan');
    expect(unlimitedPlanTexts[0]).toBeInTheDocument();
    expect(screen.getByText('$200.00/month')).toBeInTheDocument();
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
  });

  it('should handle subscription initialization', async () => {
    // Mock subscription API
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/organization/test-org-id/subscription')) {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: 'No subscription found' }),
        });
      }
      if (url.includes('/api/organization/subscription/initialize')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ paymentUrl: 'https://payment.example.com' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    // Mock window.location
    const originalLocation = window.location;
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      writable: true,
      value: mockLocation
    });

    render(<OrganizationBillingClient />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    
    // Click the subscribe button
    const subscribeButton = screen.getByText('Subscribe to Unlimited Plan');
    fireEvent.click(subscribeButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/organization/subscription/initialize', expect.any(Object));
      expect(window.location.href).toBe('https://payment.example.com');
    });

    // Restore window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
  });

  it('should handle custom pricing modal', async () => {
    // Mock subscription API
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/organization/test-org-id/subscription')) {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: 'No subscription found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(<OrganizationBillingClient />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    
    // Open custom pricing modal
    const customPricingButton = screen.getByText('Request Custom Pricing');
    fireEvent.click(customPricingButton);
    
    // Check that modal is open
    expect(screen.getByRole('heading', { name: 'Request Custom Pricing' })).toBeInTheDocument();
    
    // Mock form submission
    global.fetch = vi.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    ) as any;
    
    // Fill and submit form
    fireEvent.change(screen.getByLabelText('Contact Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Contact Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Team Size'), { target: { value: '11-50' } });
    fireEvent.change(screen.getByLabelText('Primary Use Case'), { target: { value: 'Architecture studio' } });
    fireEvent.change(screen.getByLabelText('Budget Range (USD/month)'), { target: { value: '501-1000' } });
    
    fireEvent.click(screen.getByText('Submit Request'));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/organization/custom-pricing', expect.any(Object));
      expect(screen.getByText('Your custom pricing request has been submitted. Our team will contact you shortly.')).toBeInTheDocument();
    });
  });
});
