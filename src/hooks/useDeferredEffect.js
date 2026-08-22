"use client";

import { useEffect, useRef } from "react";

export function useDeferredEffect(effect, dependencyKey = "mount") {
  const effectRef = useRef(effect);

  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    let cleanup;
    const timeoutId = window.setTimeout(() => {
      cleanup = effectRef.current?.();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      cleanup?.();
    };
  }, [dependencyKey]);
}
