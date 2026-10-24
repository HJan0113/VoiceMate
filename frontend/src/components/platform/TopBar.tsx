import type { ReactNode } from "react";
import type { ConnectionState } from "../../domain/types";
import { StatusBadge } from "./StatusBadge";

type TopBarProps = {
  state: ConnectionState;
  actions?: ReactNode;
};

export function TopBar({ state, actions }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◌
          </span>
          <span>VOICEMATE</span>
        </div>
        <span className="topbar-divider" aria-hidden="true" />
        <span className="companion-tag">芙宁娜 · Furina</span>
        <StatusBadge state={state} />
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </header>
  );
}
