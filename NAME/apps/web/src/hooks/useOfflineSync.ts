import { useState, useEffect } from 'react';
import axios from 'axios';

export interface OfflineUpdate {
  medicine: string;
  quantity: number;
  expiry_date: string;
  updated_at: string;
}

export function useOfflineSync(apiUrl: string, token: string | null) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState<OfflineUpdate[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize online status and load queue from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const savedQueue = localStorage.getItem('phc_sync_queue');
      if (savedQueue) {
        setSyncQueue(JSON.parse(savedQueue));
      }

      const handleOnline = () => {
        setIsOnline(true);
      };
      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Trigger sync when going online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0 && token && !isSyncing) {
      syncOfflineData();
    }
  }, [isOnline, syncQueue, token]);

  const addToQueue = (update: Omit<OfflineUpdate, 'updated_at'>) => {
    const fullUpdate: OfflineUpdate = {
      ...update,
      updated_at: new Date().toISOString()
    };
    const newQueue = [...syncQueue, fullUpdate];
    setSyncQueue(newQueue);
    localStorage.setItem('phc_sync_queue', JSON.stringify(newQueue));
  };

  const syncOfflineData = async () => {
    if (!token || syncQueue.length === 0) return;
    setIsSyncing(true);
    
    // Read the user's PHC from stored auth user
    let phcId = 1;
    const storedUser = localStorage.getItem('phc_user');
    if (storedUser) {
      phcId = JSON.parse(storedUser).phc_id || 1;
    }

    try {
      const response = await axios.post(
        `${apiUrl}/api/v1/stock/sync/offline-batch`,
        {
          phc_id: phcId,
          updates: syncQueue
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200) {
        console.log('Offline queue synced successfully!');
        setSyncQueue([]);
        localStorage.removeItem('phc_sync_queue');
      }
    } catch (error) {
      console.error('Failed to sync offline queue:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const clearQueue = () => {
    setSyncQueue([]);
    localStorage.removeItem('phc_sync_queue');
  };

  return {
    isOnline,
    queueLength: syncQueue.length,
    isSyncing,
    addToQueue,
    syncOfflineData,
    clearQueue
  };
}
