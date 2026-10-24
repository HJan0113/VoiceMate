type ErrorNoticeProps = {
  message: string | null;
};

export function ErrorNotice({ message }: ErrorNoticeProps) {
  if (!message) return null;
  return (
    <p className="error-notice" role="alert">
      {message}
    </p>
  );
}
