import { useWallet } from "@dngbuilds/zapkit-react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSpeed01Icon,
  PieChartIcon,
  CreditCardIcon,
  MapsIcon,
  LogoutIcon,
  UnfoldMoreIcon,
  ShuffleIcon,
  Recycle01Icon,
} from "@hugeicons/core-free-icons";

const NAV_ITEMS: { path: string; title: string; icon: typeof DashboardSpeed01Icon }[] = [
  { path: "/", title: "Dashboard", icon: DashboardSpeed01Icon },
  { path: "/bridge", title: "Deposit to Starknet", icon: MapsIcon },
  { path: "/staking", title: "Staking", icon: PieChartIcon },
  { path: "/lending", title: "Lending/Borrowing", icon: CreditCardIcon },
  { path: "/swap", title: "Swap", icon: ShuffleIcon },
  { path: "/dca", title: "DCA", icon: Recycle01Icon },
];

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppSidebar({
  isConnected,
  ...props
}: {
  isConnected: boolean;
} & React.ComponentProps<typeof Sidebar>) {
  const { wallet, disconnect } = useWallet();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                ⚡
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ZapKit Demo</span>
                <span className="truncate text-xs text-muted-foreground">Starknet SDK</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  render={<Link to={item.path} />}
                  isActive={currentPath === item.path}
                  tooltip={item.title}
                >
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {isConnected ? (
              <DropdownMenu>
                <DropdownMenuTrigger className={"w-full"}>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                        {wallet ? String(wallet.address).slice(2, 4).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {wallet ? shortenAddress(String(wallet.address)) : "Connected"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">Cartridge</span>
                    </div>
                    <HugeiconsIcon
                      icon={UnfoldMoreIcon}
                      strokeWidth={2}
                      className="ml-auto size-4"
                    />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side="right"
                  align="end"
                  sideOffset={4}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                        {wallet ? String(wallet.address).slice(2, 4).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium font-mono text-xs">
                        {wallet ? String(wallet.address) : "—"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Connected via Cartridge
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (wallet) {
                        void navigator.clipboard.writeText(String(wallet.address));
                      }
                    }}
                  >
                    Copy Address
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => disconnect()}>
                    <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} className="mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
