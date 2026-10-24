import type { ConnectionState } from "../../domain/types";

const labels: Record<ConnectionState, string> = {
  idle: "未连接",
  connecting: "呼叫中",
  ready: "在线",
  calling: "通话中",
  listening: "倾听中",
  processing: "处理中",
  speaking: "说话中",
  error: "连接异常",
};

type StatusBadgeProps = {
  state: ConnectionState;
};

export function StatusBadge({ state }: StatusBadgeProps) {
  return (
    <div className="status" aria-live="polite">
      <i className={`status-dot ${state}`} aria-hidden="true" />
      <span>{labels[state]}</span>
    </div>
  );
}

export function getStatusLabel(state: ConnectionState): string {
  return labels[state];
}
