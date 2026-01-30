import { useRef, useEffect, useCallback } from 'react';

interface UseEventSourceOptions {
    onMessage?: (data: string) => void;
    onError?: () => void;
    onClose?: () => void;
}

/**
 * Hook for managing EventSource (SSE) connections.
 * 
 * @param url - URL to connect to (null to disconnect)
 * @param options - Callbacks for message, error, and close events
 * @returns Object with connection state and control functions
 */
export function useEventSourceConnection(
    url: string | null,
    options: UseEventSourceOptions = {}
) {
    const sourceRef = useRef<EventSource | null>(null);
    const optionsRef = useRef(options);

    // Keep options ref updated to avoid stale closures
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const connect = useCallback((targetUrl: string) => {
        // Close existing connection
        if (sourceRef.current) {
            sourceRef.current.close();
        }

        const eventSource = new EventSource(targetUrl);
        sourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            optionsRef.current.onMessage?.(event.data);
        };

        eventSource.addEventListener('close', () => {
            eventSource.close();
            sourceRef.current = null;
            optionsRef.current.onClose?.();
        });

        eventSource.onerror = () => {
            eventSource.close();
            sourceRef.current = null;
            optionsRef.current.onError?.();
        };

        return eventSource;
    }, []);

    const disconnect = useCallback(() => {
        if (sourceRef.current) {
            sourceRef.current.close();
            sourceRef.current = null;
        }
    }, []);

    // Auto-connect when URL changes
    useEffect(() => {
        if (url) {
            connect(url);
        } else {
            disconnect();
        }
        return () => disconnect();
    }, [url, connect, disconnect]);

    return {
        isConnected: sourceRef.current !== null,
        connect,
        disconnect
    };
}
