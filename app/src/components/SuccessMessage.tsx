import type { ReactNode } from 'react'

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-lg border border-success/50 bg-success/10 px-4 py-3 text-success"
    >
      {children}
    </p>
  )
}
