import type { ElementType, ReactNode } from 'react'

export type CardTone = 'base' | 'calorie' | 'training' | 'body'

const TONE_CLASS: Record<CardTone, string> = {
  base: '',
  calorie: 'card-calorie',
  training: 'card-training',
  body: 'card-body',
}

interface CardProps {
  children: ReactNode
  tone?: CardTone
  as?: ElementType
  className?: string
  'aria-labelledby'?: string
  'aria-label'?: string
}

/** Bloque base del sistema (spec 017): un tono por tema. Con `as="section"` lleva su título como etiqueta. */
export function Card({
  children,
  tone = 'base',
  as: Tag = 'div',
  className = '',
  ...aria
}: CardProps) {
  return (
    <Tag className={`card ${TONE_CLASS[tone]} ${className}`.trim()} {...aria}>
      {children}
    </Tag>
  )
}
