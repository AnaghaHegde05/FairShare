// Displays a request-level error (bad credentials, server unreachable,
// validation failure returned by the API) above a form. Field-level errors
// use TextField's own `error` prop instead — this is for the rest.
export default function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-brick/30 bg-brick-light px-3.5 py-2.5 text-sm text-brick-dark">
      {message}
    </div>
  );
}
