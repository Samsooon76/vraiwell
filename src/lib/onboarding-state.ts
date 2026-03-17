const ONBOARDING_REDIRECT_STORAGE_KEY_PREFIX = "wellcom:onboarding-redirect:";

function getOnboardingRedirectStorageKey(userId: string) {
  return `${ONBOARDING_REDIRECT_STORAGE_KEY_PREFIX}${userId}`;
}

export function hasPendingOnboardingRedirect(userId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(getOnboardingRedirectStorageKey(userId)) === "1";
}

export function markPendingOnboardingRedirect(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getOnboardingRedirectStorageKey(userId), "1");
}

export function clearPendingOnboardingRedirect(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getOnboardingRedirectStorageKey(userId));
}
