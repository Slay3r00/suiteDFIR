import { useState, useEffect } from 'react';

export interface Case {
    id: number;
    name: string;
    description: string;
    created_at: string;
    status: string;
}

export function useCases() {
    const [cases, setCases] = useState<Case[]>([]);
    const [currentCase, setCurrentCase] = useState<Case | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCases = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/cases');
                if (!response.ok) {
                    throw new Error('Failed to fetch cases');
                }
                const data = await response.json();
                setCases(data);

                // Default to first case if none selected
                // In a real app, we might persist selection in localStorage
                if (data.length > 0 && !currentCase) {
                    setCurrentCase(data[0]);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        cases,
        currentCase,
        setCurrentCase,
        isLoading,
        error
    };
}
