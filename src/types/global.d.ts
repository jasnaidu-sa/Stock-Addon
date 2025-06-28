export {};

declare global {
  interface Window {
    handleClerkSignOut?: () => void;
  }
}
