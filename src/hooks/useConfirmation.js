"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useConfirmation() {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((confirmed) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const requestConfirmation = useCallback((options) => new Promise((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setRequest(options);
  }), []);

  useEffect(() => () => resolverRef.current?.(false), []);

  return {
    requestConfirmation,
    confirmationProps: {
      isOpen: Boolean(request),
      title: request?.title,
      message: request?.message,
      confirmLabel: request?.confirmLabel,
      cancelLabel: request?.cancelLabel,
      intent: request?.intent,
      onConfirm: () => close(true),
      onCancel: () => close(false),
    },
  };
}
