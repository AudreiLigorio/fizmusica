"use client"

import React, { useState } from "react"

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]

export type ShippingData = {
  shipping_name: string
  shipping_cep: string
  shipping_address: string
  shipping_number: string
  shipping_complement: string
  shipping_neighborhood: string
  shipping_city: string
  shipping_state: string
  shipping_phone: string
}

const EMPTY: ShippingData = {
  shipping_name: "", shipping_cep: "", shipping_address: "", shipping_number: "",
  shipping_complement: "", shipping_neighborhood: "", shipping_city: "",
  shipping_state: "", shipping_phone: "",
}

function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2")
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "")
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "")
}

export function isShippingValid(d: ShippingData): boolean {
  const cepOk = d.shipping_cep.replace(/\D/g, "").length === 8
  const phoneOk = d.shipping_phone.replace(/\D/g, "").length >= 10
  return Boolean(
    d.shipping_name.trim().length >= 3 &&
    cepOk &&
    d.shipping_address.trim() &&
    d.shipping_number.trim() &&
    d.shipping_neighborhood.trim() &&
    d.shipping_city.trim() &&
    d.shipping_state &&
    phoneOk
  )
}

export default function ShippingForm({
  value, onChange,
}: { value: ShippingData; onChange: (d: ShippingData) => void }) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)

  const set = (patch: Partial<ShippingData>) => onChange({ ...value, ...patch })

  async function lookupCep(rawCep: string) {
    const clean = rawCep.replace(/\D/g, "")
    if (clean.length !== 8) return
    setCepLoading(true)
    setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const data = await res.json()
      if (data.erro) {
        setCepError("CEP não encontrado.")
        return
      }
      onChange({
        ...value,
        shipping_cep:          maskCep(clean),
        shipping_address:      data.logradouro ?? value.shipping_address,
        shipping_neighborhood: data.bairro ?? value.shipping_neighborhood,
        shipping_city:         data.localidade ?? value.shipping_city,
        shipping_state:        data.uf ?? value.shipping_state,
      })
    } catch {
      setCepError("Erro ao buscar CEP.")
    } finally {
      setCepLoading(false)
    }
  }

  const baseInput =
    "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500"

  const phoneDigits = value.shipping_phone.replace(/\D/g, "").length
  const cepDigits = value.shipping_cep.replace(/\D/g, "").length

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-300 mb-1.5 block">Nome completo do destinatário *</label>
        <input
          value={value.shipping_name}
          onChange={(e) => set({ shipping_name: e.target.value })}
          className={baseInput}
          placeholder="Quem vai receber"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-300 mb-1.5 block">CEP *</label>
          <input
            value={value.shipping_cep}
            onChange={(e) => {
              const masked = maskCep(e.target.value)
              set({ shipping_cep: masked })
              if (masked.replace(/\D/g, "").length === 8) lookupCep(masked)
            }}
            onBlur={(e) => lookupCep(e.target.value)}
            className={baseInput}
            placeholder="00000-000"
            inputMode="numeric"
          />
          {cepLoading && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
          {cepError && <p className="text-xs text-red-400 mt-1">{cepError}</p>}
          {cepDigits > 0 && cepDigits < 8 && (
            <p className="text-xs text-yellow-400 mt-1">CEP incompleto</p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-300 mb-1.5 block">Telefone *</label>
          <input
            value={value.shipping_phone}
            onChange={(e) => set({ shipping_phone: maskPhone(e.target.value) })}
            className={baseInput}
            placeholder="(11) 99999-9999"
            inputMode="tel"
          />
          {phoneDigits > 0 && phoneDigits < 10 && (
            <p className="text-xs text-yellow-400 mt-1">Telefone incompleto</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-300 mb-1.5 block">Endereço *</label>
        <input
          value={value.shipping_address}
          onChange={(e) => set({ shipping_address: e.target.value })}
          className={baseInput}
          placeholder="Rua / Avenida"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-300 mb-1.5 block">Número *</label>
          <input
            value={value.shipping_number}
            onChange={(e) => set({ shipping_number: e.target.value })}
            className={baseInput}
            placeholder="123"
          />
        </div>
        <div>
          <label className="text-xs text-gray-300 mb-1.5 block">Complemento</label>
          <input
            value={value.shipping_complement}
            onChange={(e) => set({ shipping_complement: e.target.value })}
            className={baseInput}
            placeholder="Apto, bloco…"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-300 mb-1.5 block">Bairro *</label>
        <input
          value={value.shipping_neighborhood}
          onChange={(e) => set({ shipping_neighborhood: e.target.value })}
          className={baseInput}
        />
      </div>

      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div>
          <label className="text-xs text-gray-300 mb-1.5 block">Cidade *</label>
          <input
            value={value.shipping_city}
            onChange={(e) => set({ shipping_city: e.target.value })}
            className={baseInput}
          />
        </div>
        <div>
          <label className="text-xs text-gray-300 mb-1.5 block">UF *</label>
          <select
            value={value.shipping_state}
            onChange={(e) => set({ shipping_state: e.target.value })}
            className={baseInput}
          >
            <option value="">--</option>
            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

export { EMPTY as EMPTY_SHIPPING }
