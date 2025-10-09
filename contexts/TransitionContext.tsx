import React, { createContext, useContext, useState } from 'react';

interface TransitionPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TransitionContextType {
  transitionPosition: TransitionPosition | null;
  setTransitionPosition: (position: TransitionPosition | null) => void;
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined);

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitionPosition, setTransitionPosition] = useState<TransitionPosition | null>(null);

  return (
    <TransitionContext.Provider value={{ transitionPosition, setTransitionPosition }}>
      {children}
    </TransitionContext.Provider>
  );
}

export function useTransition() {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition must be used within a TransitionProvider');
  }
  return context;
}

