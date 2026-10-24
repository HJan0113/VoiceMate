import type { ConnectionState } from "../../domain/types";
import { StatusBadge } from "./StatusBadge";

type TopBarProps = {
  state: ConnectionState;
};

export function TopBar({ state }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ◌
        </span>
        <span>VOICEMATE</span>
      </div>
      <span className="protocol">PLATFORM / REALTIME v1</span>
      <StatusBadge state={state} />
    </header>
  );
}
