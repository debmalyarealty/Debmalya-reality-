export const SIGNIN_PROMPT_STORAGE_KEY = 'signinPromptShown';

export function dashboardCoachmarkKey(userId: string): string {
  return `dashboardCoachmarkShown:${userId}`;
}

export function isLocalStorageAvailable(storage?: Storage | null): boolean {
  try {
    const target =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
        ? window.localStorage
        : null;
    if (!target) return false;
    const probeKey = '__dr_storage_probe__';
    target.setItem(probeKey, '1');
    target.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function hasShownSignInPrompt(storage?: Storage | null): boolean {
  if (!isLocalStorageAvailable(storage)) {
    // Requirement: if browser blocks localStorage, skip silently (treat as already handled)
    return true;
  }
  try {
    const target = storage ?? window.localStorage;
    return target.getItem(SIGNIN_PROMPT_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markSignInPromptShown(storage?: Storage | null): void {
  if (!isLocalStorageAvailable(storage)) return;
  try {
    const target = storage ?? window.localStorage;
    target.setItem(SIGNIN_PROMPT_STORAGE_KEY, '1');
  } catch {
    // ignore storage errors silently
  }
}

export function hasShownDashboardCoachmark(
  userId: string,
  storage?: Storage | null
): boolean {
  if (!userId || !isLocalStorageAvailable(storage)) {
    return true;
  }
  try {
    const target = storage ?? window.localStorage;
    return target.getItem(dashboardCoachmarkKey(userId)) === '1';
  } catch {
    return true;
  }
}

export function markDashboardCoachmarkShown(
  userId: string,
  storage?: Storage | null
): void {
  if (!userId || !isLocalStorageAvailable(storage)) return;
  try {
    const target = storage ?? window.localStorage;
    target.setItem(dashboardCoachmarkKey(userId), '1');
  } catch {
    // ignore storage errors silently
  }
}

export function isDisallowedPromptRoute(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/my-account') ||
    pathname.startsWith('/owner-dashboard') ||
    pathname.startsWith('/owner-login') ||
    pathname === '/privacy-policy' ||
    pathname === '/terms' ||
    pathname === '/disclaimer'
  );
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface CoachmarkLayout {
  anchorVisible: boolean;
  cardWidth: number;
  cardLeft: number;
  cardTop: number;
  arrowLeftInCard: number;
}

export function computeCoachmarkLayout(
  anchorRect: RectLike | null,
  viewportWidth: number,
  viewportHeight: number
): CoachmarkLayout {
  if (
    !anchorRect ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    anchorRect.width <= 0 ||
    anchorRect.height <= 0 ||
    anchorRect.bottom <= 0 ||
    anchorRect.top >= viewportHeight ||
    anchorRect.right <= 0 ||
    anchorRect.left >= viewportWidth
  ) {
    return {
      anchorVisible: false,
      cardWidth: 300,
      cardLeft: 8,
      cardTop: 64,
      arrowLeftInCard: 150,
    };
  }

  const margin = 8;
  const cardWidth = Math.min(316, Math.max(220, viewportWidth - margin * 2));
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const maxCardLeft = Math.max(margin, viewportWidth - cardWidth - margin);
  const cardLeft = Math.max(
    margin,
    Math.min(maxCardLeft, anchorCenterX - cardWidth / 2)
  );
  const cardTop = Math.max(margin, anchorRect.bottom + 12);
  const arrowLeftInCard = Math.max(
    18,
    Math.min(cardWidth - 18, anchorCenterX - cardLeft)
  );

  return {
    anchorVisible: true,
    cardWidth,
    cardLeft,
    cardTop,
    arrowLeftInCard,
  };
}
