'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface FollowDetail {
  href?: string;
  external?: boolean;
}

type FollowHandler = (event: CustomEvent<FollowDetail>) => void;

/** Cloudscape links and buttons with href navigate client-side through the Next router. */
export function useFollow(): FollowHandler {
  const router = useRouter();
  return useCallback(
    (event: CustomEvent<FollowDetail>) => {
      const href = event.detail.href;
      if (!href || event.detail.external || href.startsWith('http') || href === '#') return;
      event.preventDefault();
      router.push(href);
    },
    [router],
  );
}
