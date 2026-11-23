# Integraciones: pagos, WhatsApp, mapas y ubicación

Todas las claves van **solo** en variables de entorno del servidor (`.env.production`), nunca en el código ni en el panel. Si faltan, la web no ofrece ese servicio y el panel lo muestra como «no conectado».

---

## 1. Pagos

### Recomendación: Stripe (una sola integración para tarjeta, Bizum y PayPal)

Stripe Checkout es una página de pago alojada por Stripe: la web **nunca ve ni guarda** datos de tarjeta. Stripe admite en España tarjeta, Apple Pay/Google Pay, **Bizum** y **PayPal**, que se activan desde su panel sin tocar el código.

Qué tiene que hacer Candú:

1. Crear cuenta en stripe.com con los datos fiscales del negocio y una cuenta bancaria española (verificación de identidad).
2. En *Configuración › Métodos de pago*, activar **Tarjetas**, **Bizum** y **PayPal** (según disponibilidad para su cuenta).
3. *Desarrolladores › Claves de API*: copiar la clave secreta → `STRIPE_SECRET_KEY`.
   - `sk_test_…` = **modo prueba** (la web muestra «MODO PRUEBA» y no se cobra dinero real).
   - `sk_live_…` = cobros reales.
4. *Desarrolladores › Webhooks* › Añadir endpoint: `https://www.candualtapasteleria.com/api/payments/stripe` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`. Copiar el secreto de firma → `STRIPE_WEBHOOK_SECRET`.
5. Opcional: en Panel › Ajustes › Pagos, cambiar el nombre a «Tarjeta o Bizum».

Costes: comisión por transacción según la tarifa vigente de Stripe para tarjetas europeas, Bizum y PayPal (consultar stripe.com/es/pricing; no hay cuota mensual).

**Cómo se confirma un pago:** al volver de Stripe, el servidor consulta la sesión a la API de Stripe y comprueba pedido e importe. Además, el webhook firmado lo confirma aunque el cliente cierre la página. Volver a la página de confirmación **no** marca nada como pagado.

### PayPal directo (opcional)

Solo si se prefiere cobrar en la cuenta de PayPal en lugar de activar PayPal dentro de Stripe.

1. developer.paypal.com › *Apps & Credentials* › crear app (primero en **Sandbox**).
2. `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox` (o `live`).
3. Webhook: `https://www.candualtapasteleria.com/api/payments/paypal` con `PAYMENT.CAPTURE.COMPLETED` y `PAYMENT.CAPTURE.DENIED` → `PAYPAL_WEBHOOK_ID`.

El cobro se confirma con una **captura desde el servidor** (respuesta oficial de PayPal) y el webhook se verifica con la API de PayPal.

### Bizum: opciones

| Opción | Qué contratar | Credenciales | Estado en el proyecto |
|---|---|---|---|
| **Bizum vía Stripe** (recomendada) | Activarlo en el panel de Stripe | Las mismas de Stripe | Funciona en cuanto Stripe lo active para la cuenta |
| Bizum vía TPV virtual del banco (Redsys) | Contratar con su banco un TPV virtual con Bizum | Código de comercio (FUC), terminal y clave secreta SHA-256 | No implementado; la capa de pagos (`src/lib/payments/`) admite añadir un proveedor más |

### Pago al recibir (contra reembolso)

Desactivado por defecto. Se activa en Panel › Ajustes › Pagos **solo si Candú lo confirma**.

---

## 2. WhatsApp

### Lo que NO es posible

- **Leer los Estados de WhatsApp** de una cuenta: ninguna API oficial de Meta lo permite. No se usa scraping ni herramientas no oficiales.
- Que la web envíe mensajes «solos» desde el WhatsApp normal del móvil de Juani.

### Lo que funciona ya, sin contratar nada

- Botón **«Avisar a Candú por WhatsApp»** en la página de seguimiento del cliente y **«Abrir WhatsApp con el resumen»** en el panel: abren WhatsApp con el texto preparado. **No se envía nada hasta pulsar «Enviar»**. El pedido queda siempre guardado en el panel (WhatsApp nunca es el único registro).
- **Subir o compartir** fotos y vídeos a la bandeja del panel. En Android, con la web instalada en la pantalla de inicio, aparece «Candú» en el menú *Compartir* de la galería y de WhatsApp.

### Integración oficial: WhatsApp Business Platform (Cloud API de Meta)

Ya está programada (`src/lib/whatsapp.ts`, `src/lib/notify.ts`, `src/app/api/whatsapp/route.ts`); solo falta configurarla:

1. **Meta Business** (business.facebook.com) verificado con los datos del negocio.
2. **Número de teléfono para la API.** Importante: el aviso de pedido se envía *desde* el número de la tienda *hacia* el móvil de Juani, así que deben ser **números distintos**.
   - Opción práctica: un número nuevo (línea barata o virtual) dado de alta como «Candú pedidos» en la Cloud API, que envía los avisos al 630 758 193.
   - Existe el modo *coexistencia* (usar el mismo número en la app WhatsApp Business y en la API), útil para avisar a clientes desde el número conocido; requiere un proveedor o el registro integrado de Meta y tiene limitaciones (por ejemplo, listas de difusión de la app en solo lectura).
3. **App en developers.facebook.com** con el producto WhatsApp. Crear un **usuario del sistema** con token permanente y permiso `whatsapp_business_messaging` → `WHATSAPP_TOKEN`; el ID del número → `WHATSAPP_PHONE_NUMBER_ID`; el secreto de la app → `WHATSAPP_APP_SECRET`.
4. **Plantillas** (categoría *Utilidad*, idioma `es`), a aprobar por Meta:
   - `WHATSAPP_TEMPLATE_NEW_ORDER` (aviso a Candú), 6 variables:
     `Nuevo pedido {{1}}. Productos: {{2}}. Fecha: {{3}}. Entrega en {{4}} ({{5}}). Pago: {{6}}. Revísalo en el panel.`
   - `WHATSAPP_TEMPLATE_ORDER_STATUS` (aviso al cliente), 3 variables:
     `Hola, tu pedido {{1}} de Candú está ahora: {{2}}. Puedes seguirlo aquí: {{3}}`
   - Los avisos no incluyen nombre, teléfono ni dirección del cliente.
5. `WHATSAPP_OWNER_NUMBERS=34630758193` (quién recibe el aviso de pedido; Juani debe haber aceptado recibirlos).
6. **Webhook** (para recibir fotos en la bandeja): URL `https://www.candualtapasteleria.com/api/whatsapp`, un texto secreto inventado en `WHATSAPP_VERIFY_TOKEN`, suscribir el campo `messages`. Números autorizados a enviar fotos: `WHATSAPP_INBOX_ALLOWED_NUMBERS`. Las fotos llegan como **borrador**, nunca se publican solas.

**Avisos a clientes:** solo si el cliente marca la casilla opcional de avisos por WhatsApp al pedir (se guarda la fecha del consentimiento). Se envían al confirmar, salir a reparto y entregar.

**Costes:** Meta cobra por mensaje de plantilla según país y categoría. Para España, los de *utilidad* rondan un par de céntimos de euro por mensaje según tarifas publicadas por proveedores en 2026, y son gratuitos dentro de las 24 h siguientes a un mensaje del cliente; consultar la tarifa oficial de Meta antes de presupuestar. Recibir mensajes no tiene coste.

**Errores:** si un envío falla, el panel lo explica en lenguaje claro (token caducado, plantilla no aprobada, número no válido…) en Ajustes › Registro y en la ficha del pedido.

---

## 3. Mapas y rutas

| Pieza | Por defecto | Para mejorar | Variables |
|---|---|---|---|
| Mapa | OpenStreetMap (gratis, uso ligero, con atribución) | MapTiler, Stadia u otro proveedor con clave si el uso crece | `MAP_TILES=osm`, `none` o una URL `https://…/{z}/{x}/{y}.png?key=…` |
| Localizar direcciones | Desactivado: se usa el centro aproximado de la localidad (editable en Ajustes) | `GEOCODER=nominatim` (gratis, 1 consulta/s; **envía la dirección a OpenStreetMap**: indicarlo en la política de privacidad) | `GEOCODER` |
| Distancias | Línea recta (suficiente para 4 localidades cercanas) | openrouteservice.org (plan gratuito con límite diario) para tiempos de conducción reales | `ORS_API_KEY` |

Sin mapa conectado, el reparto muestra la lista ordenada con un botón **Navegar** que abre Google Maps / la app de mapas del móvil.

**Cómo se ordenan las paradas:** primero la franja horaria más temprana; dentro de cada franja, los pedidos prioritarios; después siempre la parada más cercana a la anterior, con una mejora que prueba a invertir tramos para recorrer menos. Cada parada explica por qué está en su posición y se puede mover con flechas.

---

## 4. Ubicación del reparto desde el navegador: límites

- Requiere **HTTPS** y **permiso explícito** en el móvil (el panel explica antes qué se comparte, con quién y hasta cuándo).
- Funciona **mientras la pantalla de reparto está abierta**. Si se bloquea la pantalla, se cambia de app o se pierde cobertura, el navegador (sobre todo Safari en iPhone) **pausa la ubicación**. La web intenta mantener la pantalla encendida (Wake Lock) y avisa al volver.
- No hay seguimiento continuo en segundo plano desde una web: para eso haría falta una app nativa.
- Los clientes **nunca** ven una posición antigua como actual: si la última tiene más de 2 minutos (configurable), se oculta del mapa y se muestra la hora de la última actualización.
- Si se deniega el permiso o no hay señal, Juani puede marcar la localidad a mano; los clientes lo ven como «dato aproximado».
- Solo se guarda la **última posición** (no el recorrido). Se borra al pulsar «Terminar reparto» (o a las 24 h, configurable). Los repartos abandonados se cierran solos tras 6 h sin datos.
