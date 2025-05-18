// src/tests/organization-asset-manager.test.fixed.corrected.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getOrganizationAssets, 
  checkOrganizationSubscription, 
  getOrganizationStorageUsage 
} from '../lib/organization-asset-manager';
import { supabase } from '../lib/supabase';

// Mock the Supabase client
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn()
    }
  };
});

describe('Organization Asset Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkOrganizationSubscription', () => {
    it('should return hasActiveSubscription: true when subscription exists', async () => {
      // Mock the response
      (supabase.from as any).mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: () => Promise.resolve({ 
                    data: { 
                      id: 'sub123', 
                      status: 'active',
                      plan_type: 'unlimited'
                    }, 
                    error: null 
                  })
                })
              })
            })
          })
        })
      }));

      const result = await checkOrganizationSubscription('org123');
      
      expect(result.hasActiveSubscription).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription.id).toBe('sub123');
    });

    it('should return hasActiveSubscription: false when no subscription exists', async () => {
      // Mock the response for no subscription
      (supabase.from as any).mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: () => Promise.resolve({ 
                    data: null, 
                    error: { code: 'PGRST116' } 
                  })
                })
              })
            })
          })
        })
      }));

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
