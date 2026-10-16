import { describe, expect, it } from 'vitest'
import {
  buildMeliShippingBoard,
  formatMeliPostingDeadlineUntil,
} from '@/lib/vendas/meli-shipping-board'

describe('buildMeliShippingBoard', () => {
  it('formata o prazo como Até XXh', () => {
    expect(formatMeliPostingDeadlineUntil('2026-10-16T21:00:00-03:00')).toBe('Até 21h')
    expect(formatMeliPostingDeadlineUntil('2026-10-16T12:30:00-03:00')).toBe('Até 12:30h')
  })

  it('agrupa próximos dias por método e data', () => {
    const board = buildMeliShippingBoard([
      {
        status: 'paid',
        ml_order_id: '1',
        ml_logistic_type: 'drop_off',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'pending',
        ml_shipment_substatus: 'buffered',
        ml_label_available_at: '2026-10-18T14:00:00.000Z',
        ml_shipping_method: 'Agência Mercado Livre',
      },
      {
        status: 'paid',
        ml_order_id: '2',
        ml_logistic_type: 'drop_off',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'pending',
        ml_shipment_substatus: 'buffered',
        ml_label_available_at: '2026-10-20T14:00:00.000Z',
        ml_shipping_method: 'Agência Mercado Livre',
      },
    ], '2026-10-16')

    expect(board.tabs.find((tab) => tab.id === 'today')?.count).toBe(0)
    expect(board.tabs.find((tab) => tab.id === 'upcoming')?.count).toBe(2)
    expect(board.cardsByTab.upcoming[0]).toMatchObject({
      sectionLabel: 'Para enviar',
      count: 2,
    })
    expect(board.cardsByTab.upcoming[0]?.lines).toEqual([
      {
        id: expect.any(String),
        title: 'Agência Mercado Livre',
        detail: '18/10',
        count: 1,
        lane: 'pending_shipment',
      },
      {
        id: expect.any(String),
        title: 'Agência Mercado Livre',
        detail: '20/10',
        count: 1,
        lane: 'pending_shipment',
      },
    ])
  })

  it('lista Para enviar de hoje como Flex / Mercado Envios com horário', () => {
    const board = buildMeliShippingBoard([
      {
        status: 'paid',
        ml_order_id: '1',
        ml_logistic_type: 'self_service',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'ready_to_ship',
        ml_shipment_substatus: 'ready_to_print',
        ml_label_available_at: '2026-10-16T12:00:00.000Z',
        ml_posting_deadline: '2026-10-16T21:00:00-03:00',
      },
      {
        status: 'paid',
        ml_order_id: '2',
        ml_logistic_type: 'self_service',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'ready_to_ship',
        ml_shipment_substatus: 'ready_to_print',
        ml_label_available_at: '2026-10-16T12:00:00.000Z',
        ml_posting_deadline: '2026-10-16T21:00:00-03:00',
      },
      {
        status: 'paid',
        ml_order_id: '3',
        ml_logistic_type: 'drop_off',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'ready_to_ship',
        ml_shipment_substatus: 'ready_to_print',
        ml_label_available_at: '2026-10-16T10:00:00.000Z',
        ml_posting_deadline: '2026-10-16T12:30:00-03:00',
      },
      {
        status: 'paid',
        ml_order_id: '4',
        ml_logistic_type: 'drop_off',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'ready_to_ship',
        ml_shipment_substatus: 'ready_to_print',
        ml_label_available_at: '2026-10-16T10:00:00.000Z',
        ml_posting_deadline: '2026-10-16T12:30:00-03:00',
      },
      {
        status: 'paid',
        ml_order_id: '5',
        ml_logistic_type: 'drop_off',
        ml_fulfillment_stage: 'preparing',
        ml_shipment_status: 'ready_to_ship',
        ml_shipment_substatus: 'ready_to_print',
        ml_label_available_at: '2026-10-16T10:00:00.000Z',
        ml_posting_deadline: '2026-10-16T12:30:00-03:00',
      },
    ], '2026-10-16')

    expect(board.tabs.find((tab) => tab.id === 'today')?.count).toBe(5)
    expect(board.cardsByTab.today[0]).toMatchObject({
      sectionLabel: 'Para enviar',
      count: 5,
    })
    expect(board.cardsByTab.today[0]?.lines).toEqual([
      {
        id: expect.any(String),
        title: 'Mercado Envios',
        detail: 'Até 12:30h',
        count: 3,
        lane: 'preparing',
      },
      {
        id: expect.any(String),
        title: 'Flex',
        detail: 'Até 21h',
        count: 2,
        lane: 'flex',
      },
    ])
  })
})
