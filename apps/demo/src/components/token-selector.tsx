"use no memo"; // useVirtualizer is incompatible with React Compiler memoization
import { useState, useMemo, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Token } from "@dngbuilds/zapkit-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── Token Avatar ─────────────────────────────────────────────────────────────

// Deterministic palette: pick a stable color from the token symbol so each
// token has its own hue even when no logo is available.
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-indigo-500",
];

function symbolColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function TokenAvatar({ token, size = "md" }: { token: Token; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  const [imgErr, setImgErr] = useState(false);
  const logoSrc = token.metadata?.logoUrl?.toString?.();
  if (logoSrc && !imgErr) {
    return (
      <img
        src={logoSrc}
        alt={token.symbol}
        className={cn(cls, "rounded-full object-cover shrink-0")}
        onError={() => setImgErr(true)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-white font-bold shrink-0",
        symbolColor(token.symbol),
        cls,
      )}
    >
      {token.symbol.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Token Selector ───────────────────────────────────────────────────────────

interface TokenSelectorProps {
  tokens: Token[];
  /** Currently selected token. Pass `null` to show the placeholder. */
  selected: Token | null;
  onChange: (token: Token) => void;
  /** Text shown when no token is selected. Defaults to "Select token". */
  placeholder?: string;
  /** Align the dropdown. Defaults to "start". */
  align?: "start" | "center" | "end";
}

/**
 * Virtualized token picker. Renders a trigger button showing the selected token
 * and a searchable dropdown list. Safe to mount many times — uses refs to avoid
 * unnecessary re-renders.
 */
export function TokenSelector({
  tokens,
  selected,
  onChange,
  placeholder = "Select token",
  align = "start",
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return tokens;
    const s = search.toLowerCase();
    return tokens.filter(
      (t) => t.symbol.toLowerCase().includes(s) || t.name?.toLowerCase().includes(s),
    );
  }, [tokens, search]);

  const rowHeight = 40;
  const listHeight = Math.min(filtered.length * rowHeight, 240);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Remeasure after the popover opens so the virtualizer sees the real container
  // dimensions. Without this, the first open always shows an empty list because
  // scrollRef.current is null until the popover mounts.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => virtualizer.measure());
    return () => cancelAnimationFrame(id);
  }, [open, virtualizer]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="flex items-center gap-2 rounded-lg border bg-background px-2.5 h-10 font-semibold text-sm hover:bg-muted/50 transition-colors shrink-0">
        {selected ? (
          <>
            <TokenAvatar token={selected} />
            <span>{selected.symbol}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <HugeiconsIcon
          icon={open ? ArrowUp01Icon : ArrowDown01Icon}
          strokeWidth={2}
          className="h-4 w-4 text-muted-foreground"
        />
      </PopoverTrigger>

      <PopoverContent className="p-0 w-64" align={align}>
        {/* shouldFilter=false — we manage filtering ourselves for virtualizer compat */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search token…" value={search} onValueChange={setSearch} />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>No tokens found.</CommandEmpty>
            ) : (
              <div ref={scrollRef} style={{ height: listHeight, overflow: "auto" }}>
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((vi) => {
                    const t = filtered[vi.index];
                    return (
                      <CommandItem
                        key={String(t.address ?? t.symbol)}
                        value={t.symbol}
                        style={{
                          position: "absolute",
                          top: vi.start,
                          left: 0,
                          right: 0,
                          height: vi.size,
                        }}
                        className="flex items-center gap-2 px-3 cursor-pointer"
                        onSelect={() => {
                          onChange(t);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        <TokenAvatar token={t} size="sm" />
                        <span className="font-medium">{t.symbol}</span>
                        <span className="ml-auto text-xs text-muted-foreground truncate max-w-[5rem]">
                          {t.name}
                        </span>
                      </CommandItem>
                    );
                  })}
                </div>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
