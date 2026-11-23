# Vercel: vista previa privada, datos persistentes, Stripe y paso a producción

> **Estado (19/11/2026):** solo existe una **vista previa** para revisión. No se ha conectado el dominio oficial, no se ha tocado el DNS, la web actual (Webador) sigue igual y **no hay cobros reales activos**. El lanzamiento oficial requiere autorización expresa del propietario.

---

## 1. Cómo se protege la vista previa

| Capa | Qué hace | Plan |
|---|---|---|
| **Vercel Authentication** (Deployment Protection › *Standard Protection*) | Las URL de vista previa y las URL únicas de cada despliegue exigen iniciar sesión con una cuenta de Vercel con acceso al proyecto. Se activa por defecto en proyectos nuevos. | Todos (incluido Hobby) |
| **Enlace compartible** (*Shareable Link*) | Un enlace con un parámetro secreto que deja entrar a una persona sin cuenta (Juani). Se crea y **se revoca** desde el panel de Vercel. | Todos; en Hobby el número de enlaces está muy limitado |
| `noindex` | Cabecera `X-Robots-Tag`, metaetiqueta y `robots.txt` que prohíben indexar la vista previa. | Código |
| Panel de Juani | Contraseña propia (hash scrypt) e independiente de Vercel. | Código |

**Una URL difícil de adivinar no es privada.** Por eso la vista previa queda tras Vercel Authentication y Juani entra con el enlace compartible. Límites:

- Quien tenga el enlace compartible puede entrar mientras no se revoque: compártelo solo con Juani y revócalo al terminar la revisión.
- *Password Protection* (contraseña única para la vista previa) **no está disponible en Hobby**; solo en Pro con un complemento de pago o en Enterprise.
- En Hobby solo puede añadirse **una persona externa** con Vercel Authentication; la alternativa es el enlace compartible.
- El plan Hobby es **solo para uso no comercial**. Para la web oficial de la pastelería hará falta **Vercel Pro** (≈ 20 $/mes por miembro).

### Crear el enlace para Juani (lo hace el propietario de la cuenta)

1. vercel.com › proyecto **candu-alta-pasteleria** › **Deployments** › abre el despliegue de vista previa.
2. Botón **Share** (o *Settings › Deployment Protection › Shareable Links*) › **Create link**.
3. Copia el enlace y envíaselo a Juani por un canal privado. Para revocarlo: el mismo sitio › **Revoke**.

---

## 2. Datos persistentes (obligatorio antes de usar el panel de verdad)

En Vercel el disco de cada función es temporal: **sin estos dos servicios, los productos, pedidos y fotos que se guarden pueden desaparecer** al reiniciarse el servidor. El panel lo avisa con un recuadro «Almacenamiento temporal».

| Qué | Servicio | Cómo se crea | Variables (las crea Vercel) | Coste |
|---|---|---|---|---|
| Base de datos (libSQL, la misma tecnología que en local) | **Turso** desde el Marketplace de Vercel | Proyecto › **Storage** › *Create Database* › **Turso** › aceptar condiciones › conectar al proyecto (Preview y Production) | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Plan gratuito suficiente para empezar; producción desde ≈ 5 $/mes según uso |
| Fotos y vídeos | **Vercel Blob** en modo **privado** | Proyecto › **Storage** › *Create* › **Blob** › acceso **Private** › conectar al proyecto | `BLOB_READ_WRITE_TOKEN` | Incluye una cuota gratuita; después, según almacenamiento y transferencia |

- Las tablas se crean solas en el primer arranque (migraciones en `src/lib/db.ts`).
- Las fotos se suben **directamente del móvil a Blob** (sin el límite de 4,5 MB de las funciones) y el servidor comprueba el tipo real del archivo. Nada es accesible por URL directa: la web entrega enlaces firmados de 1 hora (versiones web) o de 5 minutos (originales, solo en el panel).
- Conviene usar **bases de datos distintas** para vista previa y producción (crear dos en Turso y asignar cada una a su entorno), para que las pruebas no se mezclen con pedidos reales.
- Copias de seguridad: Turso permite restaurar a un punto anterior; para Blob, descargar periódicamente la carpeta `originals/`.

---

## 3. Variables de entorno

Se configuran en vercel.com › proyecto › **Settings › Environment Variables**, marcando el entorno (**Preview** o **Production**). Son privadas: no se ven en el navegador ni en el código ni en Git. Lista completa con explicación: `.env.example`.

| Variable | Preview | Production |
|---|---|---|
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | Generadas con `npm run admin:password -- --print` | **Otras distintas** generadas igual |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos de pruebas | Base de datos real |
| `BLOB_READ_WRITE_TOKEN` | La pone la integración | La pone la integración |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `sk_test_…` / `whsec_…` del modo prueba | Al lanzar: `sk_live_…` / `whsec_…` del modo real |
| `ALLOW_LIVE_PAYMENTS` | No se pone (en vista previa los cobros reales están bloqueados siempre) | `1` **solo cuando el propietario autorice el lanzamiento** |
| `PUBLIC_BASE_URL` | Opcional (se usa la URL del despliegue) | `https://www.candualtapasteleria.com` |

No hay contraseñas por defecto: sin `ADMIN_PASSWORD_HASH` el panel no deja entrar.

---

## 4. Stripe en modo prueba (sin dinero real)

### 4.1 Lo que hace Juani (o quien ella autorice), una sola vez

1. Crear o abrir su cuenta en **stripe.com** (los datos fiscales y bancarios los introduce ella; nadie más debe tenerlos).
2. Activar el **modo prueba** (interruptor *Test mode* / *Sandbox* arriba a la derecha).
3. *Developers › API keys* › copiar la **Secret key** que empieza por `sk_test_`.
4. En Vercel › *Settings › Environment Variables* › añadir `STRIPE_SECRET_KEY` = esa clave, solo en **Preview**. Guardar.
5. Webhook de prueba:
   - En Vercel › *Settings › Deployment Protection* › **Protection Bypass for Automation** › generar el secreto (sirve para que Stripe pueda llamar a la vista previa protegida).
   - En Stripe (modo prueba) › *Developers › Webhooks* › **Add endpoint**:
     `https://<url-de-la-vista-previa>/api/payments/stripe?x-vercel-protection-bypass=<secreto-de-bypass>`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
   - Copiar el **Signing secret** (`whsec_…`) a `STRIPE_WEBHOOK_SECRET` en **Preview**.
6. Volver a desplegar la vista previa (Vercel › Deployments › ⋯ › *Redeploy*) para que lea las variables.

### 4.2 Cómo probar

1. Panel › Ajustes › Integraciones debe mostrar **Stripe · Modo prueba**. La web muestra el aviso «Pagos con tarjeta en modo prueba: no se cobra dinero real».
2. Publicar un producto de prueba (con precio) y activar una localidad o la recogida en Ajustes › Entregas.
3. Hacer un pedido y pagar con la tarjeta de prueba de Stripe **4242 4242 4242 4242**, cualquier fecha futura y cualquier CVC. Para probar un rechazo: **4000 0000 0000 0002**.
4. Comprobar en el panel que el pedido pasa a **Pagado (prueba)** y que el webhook aparece como entregado en Stripe.
5. Bizum y PayPal: se activan en Stripe › *Settings › Payment methods* si la cuenta los admite; la web no fuerza métodos y Stripe muestra los activos.

Las pruebas automáticas (`npm test`) cubren la firma del webhook (válida, alterada, caducada, con rotación) y el cálculo de importes; la prueba real contra Stripe queda pendiente de que existan las claves de prueba.

### 4.3 Pasar a cobros reales (solo con autorización del propietario)

1. Stripe: completar la activación de la cuenta (identidad, IBAN) y desactivar el modo prueba.
2. Copiar la clave `sk_live_…` y crear un webhook **real** apuntando a `https://www.candualtapasteleria.com/api/payments/stripe` con los mismos eventos.
3. Vercel › variables **Production**: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live) y `ALLOW_LIVE_PAYMENTS=1`.
4. Redesplegar producción y hacer un pedido real de importe mínimo para comprobarlo; reembolsarlo desde Stripe.

Sin `ALLOW_LIVE_PAYMENTS=1`, una clave `sk_live_` se ignora (el panel avisa de que está bloqueada). En vistas previas se ignora siempre. Un aviso de Stripe en modo prueba nunca puede confirmar un pedido real (se comprueba `livemode`).

---

## 5. Conectar candualtapasteleria.com a producción (más adelante)

**No hacer hasta que el propietario lo autorice.** La web actual sigue en Webador hasta entonces.

1. Contratar Vercel **Pro** (uso comercial) y configurar las variables de *Production* (apartado 3) con Turso y Blob de producción.
2. Desplegar a producción (`vercel deploy --prod` o desde Git) y revisar la URL `*.vercel.app` de producción.
3. Vercel › *Settings › Domains* › añadir `www.candualtapasteleria.com` y `candualtapasteleria.com` (redirigir el dominio sin www a www). Vercel mostrará los registros exactos.
4. En el panel DNS del dominio (hoy en Webador/Openprovider, ver `DOMINIO-Y-DESPLIEGUE.md`):
   - cambiar **solo** los registros de la web (`www` → CNAME que indique Vercel; `@` → registro A que indique Vercel);
   - **no tocar MX ni SPF**, para que el correo info@ siga funcionando.
5. Esperar a que Vercel emita el certificado HTTPS y comprobar la web, el panel y un pedido de prueba.
6. Marcha atrás: volver a poner los registros anteriores de Webador (anotarlos antes del cambio).
7. Después: Stripe en modo real (apartado 4.3), quitar `PREVIEW_MODE` si se hubiera puesto y revisar los textos legales.

---

## 6. Cosas que no hace una web en Vercel

- **Tareas programadas:** el borrado de ubicaciones antiguas se hace al terminar cada reparto (y los repartos abandonados se cierran al consultar el panel). Si se quiere una limpieza diaria adicional, se puede añadir un *Cron Job* de Vercel en producción.
- **Límites en memoria** (intentos de acceso, envío de pedidos): en Vercel cada instancia tiene los suyos. La protección principal del panel es la contraseña (mínimo 12 caracteres, hash scrypt).
- **Compartir desde Android** a la web instalada sube los archivos por la función, con un límite de 4,5 MB por envío: para vídeos usar «Subir fotos o vídeos» del panel (subida directa a Blob).
