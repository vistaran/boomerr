import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  initializeReverbListeners,
  disconnectReverb,
  getConnectedworkspaceId,
} from '../realtime';

type UseReverbOptions = {
  /** The authentication token */
  token: string | null;
  /** The company ID to subscribe to */
  workspaceId: string | number | null | undefined;
  /** Called when connection fails */
  onConnectionError?: (error: unknown) => void;

  userId?: number | null;
};

export function useReverb({ token, workspaceId, onConnectionError, userId }: UseReverbOptions): void {
  const queryClient = useQueryClient();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Skip if not authenticated or no company
    if (!token || !workspaceId) {
      // Disconnect if was previously connected
      if (hasInitialized.current) {
        disconnectReverb();
        hasInitialized.current = false;
      }
      return;
    }

    // Skip if already connected to the same company
    if (String(getConnectedworkspaceId()) === String(workspaceId)) {
      return;
    }

    // Initialize connection
    initializeReverbListeners({
      token,
      workspaceId: workspaceId as string | number,
      userId: userId ?? null,
      queryClient,
      onConnectionError,
    });

    hasInitialized.current = true;

    // Cleanup on unmount
    return () => {
      // Only disconnect if this is the component that initialized
      // This prevents disconnection on re-renders
    };
  }, [token, workspaceId, userId, queryClient, onConnectionError]);

  // Disconnect on logout (token becomes null)
  useEffect(() => {
    if (!token && hasInitialized.current) {
      disconnectReverb();
      hasInitialized.current = false;
    }
  }, [token]);
}
