import Link from "next/link";
import type { BusinessSettings } from "@/lib/settings";
import { telLink } from "@/lib/format";
import { LiteToggle, MotionToggle } from "./SiteChrome";

export function Footer({ b }: { b: BusinessSettings }) {
  return (
    <footer className="site-footer on-dark" id="contacto">
      <div className="wrap">
        <p className="display footer__big">
          Hablemos<em>.</em>
        </p>
        <div className="footer__grid">
          <div>
            <h3>Pedidos y dudas</h3>
            <ul>
              <li>
                <a href={`https://wa.me/${b.whatsapp}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp · {b.phone}
                </a>
              </li>
              <li>
                <a href={telLink(b.phone)}>Llamar · {b.phone}</a>
              </li>
              <li>
                <a href={`mailto:${b.email}`}>{b.email}</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Obrador</h3>
            <ul>
              <li>{b.address}</li>
              {b.postalCode && <li>CP {b.postalCode}</li>}
              {b.hours ? <li>{b.hours}</li> : <li className="muted" style={{ color: "rgba(244,237,226,.6)" }}>Horario: consúltalo por WhatsApp</li>}
            </ul>
          </div>
          <div>
            <h3>Síguenos</h3>
            <ul>
              {b.instagram && (
                <li>
                  <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noopener noreferrer">
                    Instagram · @{b.instagram}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3>Información</h3>
            <ul>
              <li>
                <Link href="/condiciones">Condiciones de compra</Link>
              </li>
              <li>
                <Link href="/privacidad">Privacidad</Link>
              </li>
              <li>
                <Link href="/cookies">Cookies</Link>
              </li>
              <li>
                <Link href="/aviso-legal">Aviso legal</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} {b.name}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px" }}>
            <MotionToggle />
            <LiteToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
