# Offline Sync

The web app supports offline stock updates:

1. When offline, stock updates are queued in localStorage
2. When connectivity is restored, the queue is automatically synced to the API
3. The sync endpoint accepts batch updates for a PHC

## Implementation
- `useOfflineSync` hook in `apps/web/src/hooks/useOfflineSync.ts`
- Queued updates are stored under `phc_sync_queue` in localStorage
- Sync triggers on `online` event
