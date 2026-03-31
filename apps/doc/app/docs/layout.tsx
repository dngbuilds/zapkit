import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>⚡ ZapKit</span>,
      }}
      githubUrl="https://github.com/DngBuilds/zapkit"
    >
      {children}
    </DocsLayout>
  );
}
