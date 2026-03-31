// ─── Dev-only error panel — automatically hidden in production ─────

interface ZapDevPanelProps {
  error: Error | null;
  status: string;
  address: string | null;
}

export function ZapDevPanel({ error, status, address }: ZapDevPanelProps) {
  if (!error && status !== "error") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: 400,
        background: "#1a1a1a",
        color: "#ff4444",
        borderRadius: 8,
        padding: "12px 16px",
        fontFamily: "monospace",
        fontSize: 13,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        border: "1px solid #ff4444",
      }}
    >
      <strong>⚡ ZapKit Dev Panel</strong>
      <div style={{ marginTop: 8, color: "#fff" }}>
        Status: <span style={{ color: status === "error" ? "#ff4444" : "#4caf50" }}>{status}</span>
      </div>
      {address && (
        <div style={{ color: "#aaa", marginTop: 4 }}>
          Address: {address.slice(0, 10)}…{address.slice(-6)}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, color: "#ff4444", wordBreak: "break-word" }}>
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
