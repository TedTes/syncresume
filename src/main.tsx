import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { getClerkPublishableKey } from "./lib/clerk/client";
import "./styles.css";

const clerkPublishableKey = getClerkPublishableKey();
const routerBasename = import.meta.env.BASE_URL === "/app/" ? "/app" : undefined;

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
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);
