# Candú Alta Pastelería · Web de pedidos y panel móvil

Web pública de pedidos y panel privado (pensado para el móvil de Juani) del obrador Candú, en Las Cucharetas, Cortes de Baza (Granada).

- **Tecnología:** Next.js 16 + React 19 + TypeScript, SQLite (libSQL), three.js (pieza 3D), GSAP (scroll), Leaflet (mapa).
- **Sin servicios obligatorios:** funciona en local sin ninguna cuenta. Pagos, WhatsApp y mapas avanzados se activan con variables de entorno.

## Puesta en marcha (local)

Requisitos: Node.js 22.18 o superior.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run admin:password
```

```bash
npm run dev
```

Abre http://localhost:3000 (web) y http://localhost:3000/admin (panel). La base de datos se crea sola en `data/candu.db`.

Otros comandos:

```bash
npm run build && npm start
```

```bash
npm test
```

```bash
npm run privacy:purge
```

## Páginas

| Ruta | Qué es |
|---|---|
| `/` | Portada: hero con pieza 3D interactiva, catálogo «Disponible esta temporada» con filtros, galería del obrador con lupa, historia de Juani, cómo pedir, contacto |
| `/producto/[slug]` | Ficha: fotos/vídeo, precio, disponibilidad, fechas, alérgenos (o aviso de consultar) |
| `/pedido` | Cesta y compra en una página |
| `/seguimiento/[enlace]` | Seguimiento privado: estados, hora, ubicación del reparto si está activa |
| `/aviso-legal`, `/privacidad`, `/cookies`, `/condiciones` | Textos legales (borradores editables) |
| `/admin` | Panel: Hoy, Pedidos, Productos (subir fotos → borrador → publicar), Reparto, Ajustes |

## Documentación

- [docs/ESTADO.md](docs/ESTADO.md): qué funciona, qué está en prueba y qué falta.
- [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md): Stripe, Bizum, PayPal, WhatsApp, mapas y límites de la ubicación web.
- [docs/DOMINIO-Y-DESPLIEGUE.md](docs/DOMINIO-Y-DESPLIEGUE.md): dominio actual (Webador), alojamiento, DNS, HTTPS y cambio sin cortes.
- [docs/VERCEL.md](docs/VERCEL.md): vista previa protegida, base de datos y fotos persistentes (Turso + Blob), Stripe en modo prueba, cobros reales y conexión del dominio.
- [docs/CREDITOS-3D.md](docs/CREDITOS-3D.md): procedencia y licencia de los modelos 3D.

**Plantillas de producto:** Panel › Productos › abre un producto › «Diseño de la ficha» (5 opciones). Muestrario: Panel › Productos › «Ver las 5 plantillas».

## Estructura

```
src/app/(site)/      web pública
src/app/admin/       panel privado (acciones de servidor en actions.ts)
src/app/api/         pedidos, seguimiento, webhooks de pago y WhatsApp, API del panel
src/lib/             datos, pagos, WhatsApp, rutas, privacidad, validación
src/components/      componentes de la web (site/) y del panel (admin/)
public/obrador/      fotos reales descargadas de la web actual de Candú
data/                base de datos y archivos subidos (no se sube a git)
```

## Seguridad y privacidad

- Secretos solo en variables de entorno del servidor. Sin contraseña por defecto.
- Sesión del panel firmada (HMAC), limitación de intentos, comprobación de origen en la API del panel.
- Archivos validados por su contenido real; se conserva el original y la versión web va sin metadatos.
- Pagos solo se marcan como pagados tras verificarlos con el proveedor.
- Enlaces de seguimiento secretos (solo se guarda su hash). La ubicación del reparto se borra al terminar.
- Sin cookies de analítica ni publicidad.
