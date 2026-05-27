import * as React from 'react'

/** Evita renderizar UI que depende de useId (Radix) antes da hidratação concluir. */
export function useHasMounted () {
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  return hasMounted
}
