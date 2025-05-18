// src/tests/organization-asset-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getOrganizationAssets, 
  checkOrganizationSubscription, 
  getOrganizationStorageUsage 
} from '../lib/organization-asset-manager';

// Mock modules
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn()
    }
  };
});

// Import after mocking
import { supabase } from '../lib/supabase';

describe('Organization Asset Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkOrganizationSubscription', () => {
    it('should return hasActiveSubscription: true when subscription exists', async () => {
      // Setup the mock chain
      const mockSingle = vi.fn().mockResolvedValue({
        data: { 
          id: 'sub123', 
          status: 'active',
          plan_type: 'unlimited'
        }, 
        error: null
      });
      
      const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      
      // Apply the mock
      (supabase.from as any).mockImplementation(mockFrom);

      const result = await checkOrganizationSubscription('org123');
      
      expect(result.hasActiveSubscription).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription.id).toBe('sub123');
    });

    it('should return hasActiveSubscription: false when no subscription exists', async () => {
      // Setup the mock chain
      const mockSingle = vi.fn().mockResolvedValue({
        data: null, 
        error: { code: 'PGRST116' }
      });
      
      const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      
      // Apply the mock
      (supabase.from as any).mockImplementation(mockFrom);

      const result = await checkOrganizationSubscription('org123');
      
      expect(result.hasActiveSubscription).toBe(false);
      expect(result.subscription).toBeUndefined();
    });
  });

  describe('getOrganizationStorageUsage', () => {
    it('should return storage usage stats when available', async () => {
      // Mock the response
      (supabase.rpc as any).mockResolvedValue({
        data: {
          totalAssets: 100,
          totalStorageUsed: 1024 * 1024 * 500, // 500 MB
          lastUpdated: new Date().toISOString()
        },
        error: null
      });

      const result = await getOrganizationStorageUsage('org123');
      
      expect(result.totalAssets).toBe(100);
      expect(result.totalStorage).toBe(1024 * 1024 * 500);
      expect(result.error).toBeUndefined();
    });

    it('should return zero values when error occurs', async () => {
      // Mock the error response
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await getOrganizationStorageUsage('org123');
      
      expect(result.totalAssets).toBe(0);
      expect(result.totalStorage).toBe(0);
      expect(result.error).toBeDefined();
    });
  });
});
