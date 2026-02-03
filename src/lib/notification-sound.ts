// Notification sound player with user preference support
const STORAGE_KEY = 'notification-sound-enabled';

let notificationAudio: HTMLAudioElement | null = null;
let newCustomerAudio: HTMLAudioElement | null = null;

// Preload sounds for instant playback
export const preloadNotificationSounds = () => {
  if (typeof window === 'undefined') return;
  
  notificationAudio = new Audio('/sounds/notification.mp3');
  newCustomerAudio = new Audio('/sounds/new-customer.mp3');
  notificationAudio.volume = 0.5;
  newCustomerAudio.volume = 0.6;
  
  // Preload the audio files
  notificationAudio.load();
  newCustomerAudio.load();
};

export const isSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
};

export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
};

export const playMessageNotification = (): void => {
  if (!isSoundEnabled()) return;
  if (notificationAudio) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {
      // Browser may block autoplay - that's fine
    });
  }
};

export const playNewCustomerNotification = (): void => {
  if (!isSoundEnabled()) return;
  if (newCustomerAudio) {
    newCustomerAudio.currentTime = 0;
    newCustomerAudio.play().catch(() => {
      // Browser may block autoplay - that's fine
    });
  }
};
