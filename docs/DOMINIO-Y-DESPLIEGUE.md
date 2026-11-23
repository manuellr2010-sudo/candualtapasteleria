# Dominio y publicación de la nueva web

> Nada de esto se ha ejecutado. No se ha cambiado ningún DNS ni se ha publicado nada. Estos pasos los debe autorizar y hacer la propietaria del dominio (o alguien con su acceso).

## 1. Situación actual (consultada el 18/11/2026 con DNS públicos)

| Qué | Valor actual | Qué significa |
|---|---|---|
| Web `www.candualtapasteleria.com` | CNAME → `website-rendering.webador.com` (IP 35.204.150.5) | La web actual está hecha y alojada en **Webador** (antes JouwWeb). |
| Dominio sin www | A → 35.204.150.5 | También apunta a Webador. |
| Servidores DNS (NS) | `ns1.openprovider.nl`, `ns2.openprovider.be`, `ns3.openprovider.eu` | El DNS lo gestiona **Openprovider**, el registrador que usa Webador para los dominios que vende. |
| Correo (MX) | `mail.webador.com` | **El correo info@candualtapasteleria.com también lo da Webador.** |
| SPF (TXT) | `v=spf1 include:_spf.webador.com ~all` | Autoriza a Webador a enviar correo del dominio. |

**Conclusión:** casi seguro el dominio se contrató junto con Webador. Sí puede reutilizarse para la nueva web, pero hay que cuidar el correo: si se cambian los servidores DNS o se da de baja Webador sin preparar el correo, **info@ dejaría de funcionar**.

## 2. Qué hace falta para publicar en el dominio actual

Necesitamos que la propietaria confirme o consiga:

1. **Acceso a la cuenta de Webador** (correo y contraseña de la propietaria; no se comparten aquí).
2. Saber **quién es el titular del dominio** (en Webador: *Dominio* › *Datos del dominio*). Debe ser Candú/Juani. Si figura otra persona o empresa, hay que pedir que se cambie antes de nada.
3. Ver si Webador permite **editar registros DNS** (A, CNAME, TXT) del dominio. Muchos planes lo permiten en *Configuración › Dominio › DNS*.
4. Decidir el **alojamiento** de la nueva web (apartado 4).
5. Decidir qué hacer con el **correo** (apartado 5).

## 3. Opciones con el dominio (decide la propietaria)

| Opción | Cómo | Ventajas | Inconvenientes |
|---|---|---|---|
| **A. Mantener el dominio en Webador y apuntar la web a otro sitio** (recomendada para empezar) | Desde el panel DNS de Webador, cambiar solo los registros de la web (`@` y `www`) y dejar MX/SPF como están. | Correo intacto. Cambio reversible en minutos. | Hay que mantener un plan de Webador que incluya el dominio y el correo. |
| **B. Transferir el dominio a otro registrador** | Pedir a Webador el *código de autorización (EPP)*, desbloquear el dominio y transferirlo (por ejemplo a Cloudflare, OVH, IONOS o DonDominio). | Independencia de Webador. | Antes hay que mover el correo (si no, se pierde). La transferencia de un `.com` tarda hasta 5–7 días y cuesta una renovación anual (≈ 10–15 €). |
| **C. Si el dominio no es de Candú o no se puede recuperar** | Hablar con quien lo tenga o, como último recurso, usar otro dominio. | — | Se pierde la dirección conocida. **No se ha comprado ni registrado ningún dominio.** |

## 4. Alojamiento recomendado

La web necesita un servidor Node.js con disco persistente (base de datos y fotos) y HTTPS.

| Opción | Coste orientativo | Para quién |
|---|---|---|
| **VPS pequeño** (Hetzner, IONOS, OVH, Contabo…) con `docker compose` + Caddy (incluido en el proyecto) | 4–8 €/mes | Recomendado: todo en un sitio, HTTPS automático, copias de seguridad sencillas. Requiere un técnico para la puesta en marcha. |
| Plataforma gestionada (Railway, Render, Fly.io) con disco persistente | 5–20 €/mes | Menos mantenimiento del servidor. |
| **Vercel** (plan Pro para uso comercial) + Turso (base de datos) + Vercel Blob privado (fotos) | ≈ 20 $/mes + uso | El código ya está adaptado (19/11/2026) y es donde está la vista previa. Pasos completos en [VERCEL.md](VERCEL.md). |

Puesta en marcha en un VPS:

```bash
git clone <repositorio> candu && cd candu
cp .env.example .env.production   # rellenar en el servidor
npm run admin:password -- --print  # copiar ADMIN_PASSWORD_HASH y SESSION_SECRET a .env.production
docker compose up -d --build
```

Copias de seguridad: guardar a diario el volumen `candu-data` (contiene `candu.db` y `uploads/`). Programar también `npm run privacy:purge` a diario (cron).

## 5. El correo info@

Antes de tocar DNS, decidir:

- **Seguir con el correo de Webador** → con la opción A no hay que hacer nada: no se tocan MX ni SPF.
- **Moverlo a otro proveedor** (Google Workspace, Microsoft 365, Zoho, IONOS…) → crear allí el buzón, añadir sus registros MX/SPF/DKIM y comprobar que llega correo **antes** de dar de baja Webador.

## 6. Registros DNS para la nueva web (opción A)

Sustituye `IP_DEL_SERVIDOR` por la IP pública del VPS.

| Tipo | Nombre | Valor | Notas |
|---|---|---|---|
| A | `@` (candualtapasteleria.com) | `IP_DEL_SERVIDOR` | Sustituye al A actual 35.204.150.5 |
| CNAME | `www` | `candualtapasteleria.com.` | O un A a la misma IP |
| AAAA | `@` | IPv6 del servidor | Solo si el VPS tiene IPv6 |
| MX | `@` | `mail.webador.com` | **No tocar** mientras el correo siga en Webador |
| TXT | `@` | `v=spf1 include:_spf.webador.com ~all` | **No tocar** (añadir el proveedor de correo nuevo si se cambia) |
| CAA (opcional) | `@` | `0 issue "letsencrypt.org"` | Permite a Caddy obtener el certificado |

**HTTPS:** Caddy pide y renueva solo el certificado de Let's Encrypt en cuanto el DNS apunta al servidor (puertos 80 y 443 abiertos). No hay que comprar certificado. La geolocalización del reparto y los pagos solo funcionan con HTTPS.

## 7. Cambio sin cortes (paso a paso)

1. **Preparar** el servidor y publicar la web en un subdominio de prueba, por ejemplo `nueva.candualtapasteleria.com` (un registro A nuevo; la web actual sigue igual). Cambiar `Caddyfile` y `PUBLIC_BASE_URL` a ese subdominio mientras dure la prueba.
2. **Probar** allí: catálogo, pedido con pago en modo prueba, panel, reparto con el móvil, textos legales revisados.
3. **Bajar el TTL** de los registros `@` y `www` a 300 s un día antes del cambio.
4. **Cambiar** `@` y `www` a la IP nueva (tabla del apartado 6). Restaurar `Caddyfile` y `PUBLIC_BASE_URL=https://www.candualtapasteleria.com`.
5. **Comprobar** que carga con candado (HTTPS) y que las direcciones antiguas redirigen: `/nuestros-postres` → catálogo, `/quien-somos` → Juani, `/contactanos` → contacto (ya configurado en `next.config.ts`).
6. **Mantener Webador** activo al menos 2–4 semanas por si hay que volver atrás (basta con restaurar los registros anteriores: A `@` 35.204.150.5 y CNAME `www` → `website-rendering.webador.com`).
7. **Registrar los webhooks** de Stripe, PayPal y WhatsApp con la URL definitiva (Panel › Ajustes › Conexiones).
8. Dar de alta la web en Google Search Console y actualizar el enlace en Instagram.
