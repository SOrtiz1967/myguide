import type { ReactNode } from 'react'

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-success"
    >
      {children}
    </p>
  )
}
