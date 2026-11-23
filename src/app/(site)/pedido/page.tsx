import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { availablePaymentMethods } from "@/lib/orders";
import { todayMadrid } from "@/lib/format";
import { CheckoutForm } from "@/components/site/CheckoutForm";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

export default async function CheckoutPage() {
  const s = await getSettings();
  const methods = availablePaymentMethods(s);
  return (
    <div className="page wrap">
      <h1>Tu pedido</h1>
      <CheckoutForm
        today={todayMadrid()}
        pickup={s.delivery.pickup}
        localities={s.delivery.localities
          .filter((l) => l.enabled)
          .map((l) => ({ id: l.id, name: l.name, feeCents: l.feeCents, minOrderCents: l.minOrderCents, notes: l.notes }))}
        slots={s.delivery.slots}
        minOrderCents={s.delivery.minOrderCents}
        conditions={s.delivery.conditions}
        methods={methods}
        whatsapp={s.business.whatsapp}
      />
    </div>
  );
}
