import { useState, useEffect } from 'react';
import { inventoryServices } from '@/api/services';
import { useAuth } from '@/contexts/AuthContext';

export const usePendingAdjustmentsCount = () => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const { user } = useAuth();

  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');

  const fetchCount = async () => {
    if (!isSuperAdmin) {
      setCount(0);
      return;
    }

    try {
      setLoading(true);
      const response = await inventoryServices.getPendingStockAdjustmentsCount();
      setCount(response.data.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch pending adjustments count:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();

    // Poll every 30 seconds for updates
    const interval = setInterval(fetchCount, 30000);

    return () => clearInterval(interval);
  }, [isSuperAdmin]);

  return { count, loading, refetch: fetchCount };
};
