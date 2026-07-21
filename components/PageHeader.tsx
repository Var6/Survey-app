"use client";

import { createContext, useContext, useEffect } from "react";

export interface PageHeaderInfo {
  title?: string;
  subtitle?: string;
}

/** AppShell provides the setter; pages publish their header into the top bar. */
export const PageHeaderContext = createContext<{ set: (h: PageHeaderInfo) => void }>({
  set: () => {},
});

/** Invisible: publishes the page's title/subtitle to the shell top bar. */
export function PageHeaderBroadcast({ title, subtitle }: PageHeaderInfo) {
  const { set } = useContext(PageHeaderContext);
  useEffect(() => {
    set({ title, subtitle });
    return () => set({});
  }, [title, subtitle, set]);
  return null;
}
