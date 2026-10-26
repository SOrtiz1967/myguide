import { useId, type ReactNode } from 'react'

/** Un bloque del inicio, con su título; cada bloque carga y falla por su cuenta. */
export function HomeSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}
