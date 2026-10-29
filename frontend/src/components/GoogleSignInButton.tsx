import { useEffect, useRef } from "react";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          theme: "filled_black";
          size: "large";
          shape: "pill";
          text: "continue_with";
          width: number;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let googleScriptPromise: Promise<void> | undefined;
let initializedClientId: string | undefined;
let activeCredentialHandler: ((credential: string) => void) | undefined;
let activeErrorHandler: ((message: string) => void) | undefined;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript =
      document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    const script = existingScript ?? document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = GOOGLE_SCRIPT_URL;
    script.onload = () => {
      if (window.google) resolve();
      else reject(new Error("Google sign-in could not be loaded."));
    };
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    if (!existingScript) document.head.appendChild(script);
  });

  return googleScriptPromise;
}

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}

function GoogleSignInButton({
  disabled = false,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let isMounted = true;
    activeCredentialHandler = onCredential;
    activeErrorHandler = onError;

    if (!clientId) {
      onError("Google sign-in is not configured for this app.");
      return () => {
        isMounted = false;
      };
    }

    void loadGoogleIdentityServices()
      .then(() => {
        if (!isMounted || !buttonRef.current || !window.google) return;
        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: ({ credential }) => {
              if (credential) activeCredentialHandler?.(credential);
              else {
                activeErrorHandler?.(
                  "Google did not return an ID token. Please try again.",
                );
              }
            },
          });
          initializedClientId = clientId;
        }
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Google sign-in could not be loaded.";
        onError(message);
      });

    return () => {
      isMounted = false;
    };
  }, [clientId, onCredential, onError]);

  return (
    <div
      className={`google-signin${disabled ? " is-disabled" : ""}`}
      aria-disabled={disabled}
    >
      <div ref={buttonRef} aria-label="Continue with Google" />
    </div>
  );
}

export default GoogleSignInButton;
