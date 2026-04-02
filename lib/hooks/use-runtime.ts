'use client';

import { createContext, useContext } from 'react';

export type RuntimeState = { status: string; loading: boolean };

export const RuntimeContext = createContext<{
  runtime: RuntimeState;
  toggleRuntime: () => void;
}>({
  runtime: { status: 'paused', loading: false },
  toggleRuntime: () => {},
});

export const useRuntime = () => useContext(RuntimeContext);
