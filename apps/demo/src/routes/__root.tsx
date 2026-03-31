import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useWallet, useNetwork } from "@dngbuilds/zapkit-react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/sonner";
import { HeaderActionsProvider, HeaderActionsSlot } from "@/contexts/header-actions";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/staking": "Staking",
  "/bridge": "Deposit to Starknet",
  "/lending": "Lending/Borrowing",
  "/swap": "Swap",
  "/dca": "DCA Orders",
};

function RootLayout() {
  const { status, connectCartridge, isLoading: isConnecting } = useWallet();
  const network = useNetwork();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const networkColor = network === "mainnet" ? "default" : "secondary";

  return (
    <HeaderActionsProvider>
      <SidebarProvider>
        <AppSidebar isConnected={status === "connected"} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-lg font-medium">
                    {PAGE_TITLES[currentPath] ?? "Dashboard"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <HeaderActionsSlot />
              {status !== "connected" && (
                <Button size="sm" disabled={isConnecting} onClick={() => connectCartridge()}>
                  {isConnecting ? (
                    <>
                      <Spinner className="mr-1.5 h-3.5 w-3.5" />
                      Connecting…
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </Button>
              )}
              <Badge variant={networkColor} className="capitalize">
                {network}
              </Badge>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </HeaderActionsProvider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
