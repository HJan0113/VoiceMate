type EmptyStateProps = {
  children: string;
};

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="empty-line">{children}</p>;
}
