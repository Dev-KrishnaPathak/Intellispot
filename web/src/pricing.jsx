import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function Pricing() {
  const [billing, setBilling] = useState('monthly') // 'monthly' | 'yearly'

  const plans = useMemo(() => ([
    {
      name: 'Free',
      priceMonthly: 0,
      cta: 'Choose Free',
      features: [
        'Conflict detection',
        'Basic calendar integration',
        '1-click event creation',
      ],
    },
    {
      name: 'Pro',
      priceMonthly: 9,
      cta: 'Choose Pro',
      popular: true,
      features: [
        'Everything in Free',
        'AI suggestions',
        'Weather/location context',
        'Unlimited events',
        'Priority support',
      ],
    },
    {
      name: 'Team',
      priceMonthly: 29,
      cta: 'Choose Team',
      features: [
        'Everything in Pro',
        'Team calendars',
        'Collaboration',
        'Admin dashboard',
        'API access',
      ],
    },
  ]), [])

  const formatPrice = (n) => (Number.isInteger(n) ? n.toString() : n.toFixed(2))

  return (
  <main className="min-h-screen max-w-6xl mx-auto px-6 py-3 md:py-7">

  <section className="text-center mt-3 md:mt-5">
        <h1 className="text-4xl md:text-5xl font-bold text-black tracking-tight">Simple, transparent pricing</h1>
        <p className="text-gray-600 mt-3">Pick a plan that fits your team. Upgrade any time.</p>

        {/* Billing Toggle */}
  <div className="mt-3 md:mt-5 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 text-sm rounded-full transition ${billing === 'monthly' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={`px-4 py-1.5 text-sm rounded-full transition ${billing === 'yearly' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Yearly <span className="ml-1 text-[11px] text-gray-500">(save 20%)</span>
          </button>
        </div>
      </section>

  <section className="grid md:grid-cols-3 gap-6 md:gap-8 mt-5 md:mt-7 items-stretch">
        {plans.map((plan) => {
          const monthly = plan.priceMonthly
          const perMonth = billing === 'monthly' ? monthly : +(monthly * 0.8).toFixed(2)
          return (
            <div
              key={plan.name}
              className={`relative h-full rounded-2xl border p-6 md:p-8 bg-white flex flex-col min-h-[420px] ${
                plan.popular ? 'border-black shadow-xl ring-1 ring-black' : 'border-gray-200 shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-6">
                  <span className="inline-flex items-center rounded-full bg-black text-white text-xs px-3 py-1">Most Popular</span>
                </div>
              )}
              <div className="text-lg font-semibold text-black">{plan.name}</div>
              <div className="mt-2 flex items-end gap-2">
                <div className="text-4xl font-bold text-black">
                  ${formatPrice(perMonth)}
                </div>
                <div className="text-base font-normal text-gray-500">/month</div>
              </div>
              {billing === 'yearly' && (
                <div className="text-xs text-gray-500 mt-1">Billed yearly</div>
              )}

              <ul className="text-sm text-gray-700 mt-5 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-auto inline-flex items-center justify-center w-full rounded-full px-5 py-2 text-sm font-medium transition ${
                  plan.popular ? 'bg-black text-white hover:opacity-90' : 'bg-black text-white hover:opacity-90'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          )
        })}
      </section>
    </main>
  )
}

export default Pricing
