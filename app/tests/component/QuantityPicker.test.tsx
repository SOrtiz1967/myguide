// T021 (spec 003, FR-002 a FR-005): elegir la cantidad en g o ml, o en porciones, con vista previa.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import type { PickerFood } from '../../src/features/meals/api'
import { QuantityPicker } from '../../src/features/meals/QuantityPicker'
import type { QuantityFormInput } from '../../src/features/meals/schema'

const rice: PickerFood = {
  reference_basis: '100g',
  energy_kcal: 130,
  protein_g: 2.8,
  carbs_g: 28,
  sugars_g: null,
  fat_g: 0.3,
  saturated_fat_g: null,
  fiber_g: null,
  sodium_mg: 1,
  portions: [{ id: 'p1', name: '1 taza', quantity: 158 }],
}

function Harness({
  food = rice,
  initial = { portion: '', amount: '100' },
  error,
}: {
  food?: PickerFood
  initial?: QuantityFormInput
  error?: string
}) {
  const [value, setValue] = useState(initial)
  return <QuantityPicker food={food} value={value} onChange={setValue} error={error} />
}

const preview = () => screen.getByRole('table', { name: es.meals.quantity.preview })

describe('QuantityPicker', () => {
  it('ofrece gramos y cada porción del alimento, con la cantidad que equivale', () => {
    render(<Harness />)
    const select = screen.getByLabelText(es.meals.quantity.measure)
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual(['Gramos (g)', '1 taza (158 g)'])
    expect(screen.getByLabelText(es.meals.quantity.amountGrams)).toHaveValue('100')
  })

  it('para un líquido usa mililitros', () => {
    render(
      <Harness
        food={{
          ...rice,
          reference_basis: '100ml',
          portions: [{ id: 'v', name: '1 vaso', quantity: 200 }],
        }}
      />,
    )
    const select = screen.getByLabelText(es.meals.quantity.measure)
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Mililitros (ml)', '1 vaso (200 ml)'])
    expect(screen.getByLabelText(es.meals.quantity.amountMilliliters)).toBeVisible()
  })

  it('con una porción, la cantidad es el número de porciones y se muestra lo que equivale', async () => {
    render(<Harness />)
    await userEvent.selectOptions(screen.getByLabelText(es.meals.quantity.measure), 'p1')
    const amount = screen.getByLabelText(es.meals.quantity.amountPortions)
    await userEvent.clear(amount)
    await userEvent.type(amount, '1,5')
    expect(screen.getByText(es.meals.quantity.equivalent('237 g'))).toBeVisible()
  })

  it('FR-004: previsualiza los valores para la cantidad, con unidad', () => {
    render(<Harness initial={{ portion: '', amount: '150' }} />)
    expect(within(preview()).getByRole('row', { name: /^Energía/ })).toHaveTextContent('195 kcal')
    expect(within(preview()).getByRole('row', { name: /^Proteínas/ })).toHaveTextContent('4,2 g')
    expect(within(preview()).getByRole('row', { name: /^Sodio/ })).toHaveTextContent('1,5 mg')
  })

  it('FR-005: un valor que falta dice "sin dato" y nunca 0', () => {
    render(<Harness initial={{ portion: '', amount: '150' }} />)
    const fiber = within(preview()).getByRole('row', { name: /^Fibra/ })
    expect(fiber).toHaveTextContent('sin dato')
    expect(fiber).not.toHaveTextContent(/\b0\b/)
  })

  it('la vista previa se actualiza al cambiar la cantidad', async () => {
    render(<Harness initial={{ portion: '', amount: '100' }} />)
    expect(within(preview()).getByRole('row', { name: /^Energía/ })).toHaveTextContent('130 kcal')
    const amount = screen.getByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(amount)
    await userEvent.type(amount, '200')
    expect(within(preview()).getByRole('row', { name: /^Energía/ })).toHaveTextContent('260 kcal')
  })

  it('con una cantidad inválida no muestra valores y señala el error en el campo', () => {
    render(<Harness initial={{ portion: '', amount: 'abc' }} error={es.meals.errors.quantity} />)
    expect(screen.queryByRole('table', { name: es.meals.quantity.preview })).toBeNull()
    const amount = screen.getByLabelText(es.meals.quantity.amountGrams)
    expect(amount).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(es.meals.errors.quantity)).toBeVisible()
  })

  it('un alimento sin porciones ofrece solo gramos o mililitros', () => {
    render(<Harness food={{ ...rice, portions: [] }} />)
    const select = screen.getByLabelText(es.meals.quantity.measure)
    expect(within(select).getAllByRole('option')).toHaveLength(1)
  })
})
