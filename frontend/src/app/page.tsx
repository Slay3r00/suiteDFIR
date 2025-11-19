'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Redirect to the iLEAPP interface
    window.location.href = '/ileapp';
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-yellow-400 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl mb-4">🔄</div>
        <h1 className="text-2xl font-bold mb-2">iLEAPP Web Interface</h1>
        <p className="text-gray-400">Redirecting to iLEAPP interface...</p>
      </div>
    </div>
  );
}
