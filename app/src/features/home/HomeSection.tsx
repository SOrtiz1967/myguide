import { useId, type ReactNode } from 'react'
import { Card, type CardTone } from '../../components/Card'

const TITLE_TONE: Record<CardTone, string> = {
  base: 'text-muted',
  calorie: 'text-tone-calorie-ink',
  training: 'text-tone-training-ink',
  body: 'text-tone-body-ink',
}

/** Un bloque del inicio, con su título; cada bloque carga y falla por su cuenta. */
export function HomeSection({
  title,
  tone = 'base',
  className = '',
  children,
}: {
  title: string
  tone?: CardTone
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <Card
      as="section"
      tone={tone}
      aria-labelledby={id}
      className={`flex flex-col gap-3 ${className}`}
    >
      <h2 id={id} className={`text-sm font-bold ${TITLE_TONE[tone]}`}>
        {title}
      </h2>
      {children}
    </Card>
  )
}
