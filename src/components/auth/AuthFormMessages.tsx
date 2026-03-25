type AuthFormMessagesProps = {
  errorMessage: string | null
  message: string | null
}

export function AuthFormMessages({ errorMessage, message }: AuthFormMessagesProps) {
  return (
    <>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </>
  )
}
