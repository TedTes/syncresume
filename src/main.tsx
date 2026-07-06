import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { getClerkPublishableKey } from "./lib/clerk/client";
import "./styles.css";

const clerkPublishableKey = getClerkPublishableKey();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      __internal_bypassMissingPublishableKey={!clerkPublishableKey}
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: "Sign in to SyncResume" } },
        signUp: { start: { title: "Create your SyncResume account" } },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);
