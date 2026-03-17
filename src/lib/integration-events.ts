export type IntegrationProvider =
  | "google"
  | "microsoft"
  | "slack"
  | "notion"
  | "hubspot"
  | "onoff";

const INTEGRATION_CONNECTION_EVENT = "wellcom:integration-connection-changed";

export function emitIntegrationConnectionChanged(provider: IntegrationProvider) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(INTEGRATION_CONNECTION_EVENT, {
    detail: { provider },
  }));
}

export function subscribeIntegrationConnectionChanges(
  provider: IntegrationProvider,
  listener: () => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ provider?: IntegrationProvider }>;

    if (customEvent.detail?.provider === provider) {
      listener();
    }
  };

  window.addEventListener(INTEGRATION_CONNECTION_EVENT, handleEvent as EventListener);

  return () => {
    window.removeEventListener(INTEGRATION_CONNECTION_EVENT, handleEvent as EventListener);
  };
}
