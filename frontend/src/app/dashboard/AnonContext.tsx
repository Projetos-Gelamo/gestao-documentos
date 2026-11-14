"use client";
import { createContext, useContext, useEffect, useState } from "react";

type AnonContextType = { anonimizado: boolean; toggleAnon: () => void };

const AnonContext = createContext<AnonContextType>({
  anonimizado: false,
  toggleAnon: () => {},
});

export function AnonProvider({ children }: { children: React.ReactNode }) {
  const [anonimizado, setAnonimizado] = useState(false);

  useEffect(() => {
    try {
      setAnonimizado(localStorage.getItem("global_anon") === "1");
    } catch {}
  }, []);

  function toggleAnon() {
    const next = !anonimizado;
    setAnonimizado(next);
    try {
      next
        ? localStorage.setItem("global_anon", "1")
        : localStorage.removeItem("global_anon");
    } catch {}
  }

  return (
    <AnonContext.Provider value={{ anonimizado, toggleAnon }}>
      {children}
    </AnonContext.Provider>
  );
}

export const useAnon = () => useContext(AnonContext);
