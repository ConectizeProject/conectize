type AuthFormMessagesProps = {
  errorMessage: string | null
  message: string | null
}

export function AuthFormMessages({ errorMessage, message }: AuthFormMessagesProps) {
  return (
    <div className="space-y-1 min-h-[1.25rem]">
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  )
}
