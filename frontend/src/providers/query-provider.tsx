import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../query/query-client';

type QueryProviderProps = {
    children: React.ReactNode;
};

// QueryProvider wraps the app with React Query's QueryClientProvider and includes DevTools in development mode.
export function QueryProvider({ children }: QueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* DevTools only in development */}
            {import.meta.env.DEV && (

                <ReactQueryDevtools
                    initialIsOpen={false}
                    buttonPosition="bottom-left"
                />
            )}
        </QueryClientProvider>
    );
}
