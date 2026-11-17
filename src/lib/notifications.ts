export type BrowserPushStatus = NotificationPermission | 'unsupported';

export function isBrowserPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserPushPermission(): BrowserPushStatus {
  if (!isBrowserPushSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestBrowserPushPermission(): Promise<BrowserPushStatus> {
  if (!isBrowserPushSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return getBrowserPushPermission();
  }
}

export function sendBrowserNotification(
  title: string,
  body: string,
  tag?: string,
  onClick?: () => void
): boolean {
  if (!isBrowserPushSupported()) return false;
  try {
    if (Notification.permission !== 'granted') return false;
    const notification = new Notification(title, {
      body,
      tag,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore focus restrictions in iframe
      }
      notification.close();
      onClick?.();
    };
    return true;
  } catch {
    return false;
  }
}
