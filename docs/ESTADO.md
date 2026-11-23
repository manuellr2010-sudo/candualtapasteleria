# Estado de cada parte (19/11/2026)

Leyenda: ✅ funciona · 🧪 funciona en modo prueba al poner claves de prueba · ⏳ preparado, espera cuenta, contratación o credenciales · ✋ paso manual

| Parte | Estado | Notas |
|---|---|---|
| Portada nueva: presentación breve de Candú y Juani + tienda | ✅ | Paleta nata/cacao/frambuesa. Solo datos publicados por Candú. |
| Pieza 3D (entremet con vista de capas al hacer scroll, plato, granada y limón) | ✅ | Ilustración procedural + modelos CC0 (ver CREDITOS-3D.md). Foto real en modo ligero o sin WebGL; respeta «reducir movimiento». |
| Catálogo estacional con escaparate vacío | ✅ | Sin productos inventados. Los agotados se muestran como no comprables. |
| Cinco plantillas de ficha (Atelier, Editorial, Galería, Esencial, Temporada) | ✅ | Se eligen en Panel › Productos › (producto) › «Diseño de la ficha». Muestrario en Panel › Productos › «Ver las 5 plantillas». |
| Vista previa de la ficha desde el panel | ✅ | «Ver la ficha (vista previa)»: muestra lo guardado, sin poder comprar. |
| Alérgenos editables (14 de la UE) | ✅ | «Sin confirmar» por defecto: la web pide consultar antes de pedir. |
| Cesta y pedido (datos mínimos, fechas, franjas, validación, reserva de unidades) | ✅ | |
| Pago al recibir | ✅ | Desactivado hasta que Candú lo confirme (Panel › Ajustes › Pagos). |
| Stripe (tarjeta; Bizum y PayPal si se activan en Stripe) | 🧪 / ⏳ | Código completo, webhook firmado y comprobación de `livemode`; pruebas automáticas. Faltan la cuenta y las claves de prueba (VERCEL.md §4). Cobros reales bloqueados sin `ALLOW_LIVE_PAYMENTS=1`. |
| PayPal directo | 🧪 / ⏳ | Opcional; falta la app de PayPal (sandbox). |
| Bizum vía TPV del banco (Redsys) | ⏳ | No implementado; recomendado Bizum vía Stripe. |
| Seguimiento privado del pedido (5 estados editables) | ✅ | Enlace secreto (solo se guarda su hash). Muestra localidad, nunca la dirección. |
| Ubicación en directo durante el reparto | ✅ (requiere HTTPS) | Solo con la página abierta y el reparto activo; se borra al terminar. Ver INTEGRACIONES.md §4. |
| Panel móvil: acceso, pedidos, estados, pagos, prioridad, enlaces | ✅ | Sin contraseña por defecto. Comprobación de sesión en cada página. |
| Bandeja de fotos/vídeos → borrador → revisar → publicar | ✅ | En Vercel, subida directa a Blob privado. Original conservado; versión web sin metadatos GPS. |
| Recibir fotos reenviadas a un número de WhatsApp | ⏳ | Programado; falta la Cloud API de Meta. |
| Importar Estados de WhatsApp | ✋ | No existe API oficial. Se suben los mismos archivos. |
| Aviso de pedido por WhatsApp | ✋ / ⏳ | Hoy: botón que abre WhatsApp con el texto (no se envía solo). Automático con la Cloud API. |
| Reparto: orden sugerido, mapa numerado, reordenar, navegar, entregado/incidencia | ✅ | |
| Distancias reales por carretera | ⏳ | Opcional con clave de openrouteservice. |
| Localidades y condiciones | ✋ | Baza, Cortes de Baza, Zújar y Los Laneros **desactivadas y sin costes** hasta que Candú las confirme. |
| Vista previa en Vercel | ⏳ / ✅ | Ver VERCEL.md. Protegida con Vercel Authentication + enlace compartible; noindex. |
| Base de datos y fotos persistentes en Vercel | ⏳ | Falta crear Turso y Blob en la cuenta de Vercel del propietario (VERCEL.md §2). Mientras tanto el panel avisa de «Almacenamiento temporal». |
| Textos legales | ✋ | Borradores con campos [PENDIENTE]. Revisión profesional obligatoria. |
| Publicación en el dominio oficial | ⏳ | No se ha tocado el DNS ni la web actual. Requiere autorización (VERCEL.md §5). |
