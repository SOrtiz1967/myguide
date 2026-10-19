// T020 (spec 003, FR-003, FR-004, FR-005): cantidad, porciones y cálculo de valores.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { entryErrorMessage } from '../../src/features/meals/errors'
import { quantityFormSchema } from '../../src/features/meals/schema'
import { scaleValue } from '../../src/features/meals/scale'

const parse = (values: { portion: string; amount: string }) => quantityFormSchema.safeParse(values)

describe('quantityFormSchema: gramos o mililitros (FR-003)', () => {
  it('acepta una cantidad con punto o con coma', () => {
    expect(parse({ portion: '', amount: '150' }).data).toEqual({ quantity: 150 })
    expect(parse({ portion: '', amount: '12,5' }).data).toEqual({ quantity: 12.5 })
    expect(parse({ portion: '', amount: ' 80.25 ' }).data).toEqual({ quantity: 80.25 })
  })

  it('rechaza 0, negativos, más de 5.000, texto y vacío con el mensaje del rango', () => {
    for (const amount of ['0', '-3', '5000,01', '5001', 'abc', '', '  ', '1,2,3']) {
      const result = parse({ portion: '', amount })
      expect(result.success, amount).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['amount'])
      expect(result.error?.issues[0]?.message).toBe(es.meals.errors.quantity)
    }
  })

  it('admite exactamente 5.000', () => {
    expect(parse({ portion: '', amount: '5000' }).success).toBe(true)
  })
})

describe('quantityFormSchema: porciones (FR-002, FR-003)', () => {
  it('con una porción elegida, la cantidad es el número de porciones', () => {
    expect(parse({ portion: 'p1', amount: '1,5' }).data).toEqual({
      portion_id: 'p1',
      portion_count: 1.5,
    })
    expect(parse({ portion: 'p1', amount: '50' }).data).toEqual({
      portion_id: 'p1',
      portion_count: 50,
    })
  })

  it('rechaza 0, más de 50 y texto con su propio mensaje', () => {
    for (const amount of ['0', '50,1', '51', 'x', '']) {
      const result = parse({ portion: 'p1', amount })
      expect(result.success, amount).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(es.meals.errors.portionCount)
    }
  })
})

describe('scaleValue (FR-004, FR-005)', () => {
  it('calcula el valor proporcional a la cantidad, con 2 decimales', () => {
    expect(scaleValue(130, 150)).toBe(195)
    expect(scaleValue(3.33, 33)).toBe(1.1)
    expect(scaleValue(2.7, 150)).toBe(4.05)
  })

  it('un valor que falta sigue faltando: null, nunca 0', () => {
    expect(scaleValue(null, 150)).toBeNull()
  })

  it('un cero real sigue siendo cero', () => {
    expect(scaleValue(0, 150)).toBe(0)
  })
})

describe('entryErrorMessage: errores conocidos del servidor', () => {
  const error = (message: string) => ({ message, code: '22023' })

  it('traduce cada motivo a un mensaje claro', () => {
    expect(entryErrorMessage(error('not_found: el alimento no existe'))).toBe(
      es.meals.errors.foodGone,
    )
    expect(entryErrorMessage(error('invalid_entry:invalid_quantity:quantity'))).toBe(
      es.meals.errors.quantity,
    )
    expect(entryErrorMessage(error('invalid_entry:invalid_portion_count:portion_count'))).toBe(
      es.meals.errors.portionCount,
    )
    expect(entryErrorMessage(error('invalid_entry:invalid_date:log_date'))).toBe(
      es.meals.errors.invalidDate,
    )
    expect(entryErrorMessage(error('session_expired: la sesion vencio'))).toBe(
      es.auth.sessionExpired,
    )
  })

  it('cualquier otro motivo de validación da el mensaje general de no guardado', () => {
    expect(entryErrorMessage(error('invalid_entry:negative_value:protein_g'))).toBe(
      es.meals.errors.saveFailed,
    )
  })

  it('un error desconocido no se traduce (el llamador usa el mensaje general)', () => {
    expect(entryErrorMessage(error('duplicate key value violates unique constraint'))).toBeNull()
    expect(entryErrorMessage(null)).toBeNull()
    expect(entryErrorMessage('texto')).toBeNull()
  })
})
