import "./patch"; // must be first — rebinds fetch to globalThis before SDK code snapshots it
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import "./index.css";
import { ZapProvider } from "@dngbuilds/zapkit-react";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZapProvider
      config={{
        network: "sepolia",
        bridging: {
          ethereumRpcUrl: "https://eth-sepolia.g.alchemy.com/v2/k4mUZQaaoEmLodC6B1iUK",
          solanaRpcUrl: "https://starknet-sepolia.g.alchemy.com/v2/k4mUZQaaoEmLodC6B1iUK",
        },
      }}
      showDevPanel
    >
      <RouterProvider router={router} />
    </ZapProvider>
  </StrictMode>,
);
