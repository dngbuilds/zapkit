import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>⚡ ZapKit</span>,
      }}
      githubUrl="https://github.com/DngBuilds/zapkit"
      links={[
        {
          type: "custom",
          children: (
            <a target="_blank" href="https://zapkit-demo.vercel.app">
              <Button variant={"default"} className="w-full">
                Open demo app
              </Button>
            </a>
          ),
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
