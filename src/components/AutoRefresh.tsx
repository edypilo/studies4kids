'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Vuelve a pedir la página cada pocos segundos mientras hay un trabajo de IA en marcha. */
export function AutoRefresh({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
