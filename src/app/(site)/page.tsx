import { getSettings } from "@/lib/settings";
import { publicCatalog } from "@/lib/catalog";
import { Catalog } from "@/components/site/Catalog";
import { HeroEntremet } from "@/components/site/HeroEntremet";
import { HomeMotion } from "@/components/site/HomeMotion";
import { ObradorGallery } from "@/components/site/ObradorGallery";
import { IconArrow, IconWhatsapp } from "@/components/site/Icons";

/**
 * Portada: presentación breve de Candú y Juani (con la pieza 3D) y, enseguida, la tienda.
 * Solo usa datos publicados por Candú (web actual): Juani, más de 20 años de oficio,
 * formación con Paco Torreblanca en 2018, inspiración francesa y fruta de temporada.
 */
export default async function Home() {
  const [s, products] = await Promise.all([getSettings(), publicCatalog()]);
  const b = s.business;
  const gallery = s.gallery.filter((g) => g.visible);
  const portrait = gallery.find((g) => g.src.endsWith("candu-8.jpg")) ?? null;
  // Obrador: primero las fotos de los productos que Juani publica (los más recientes primero),
  // después las fotos fijas de la galería. Los borradores nunca aparecen.
  const productPlates = products
    .filter((p) => p.imageLarge)
    .map((p) => ({ src: p.imageLarge!, alt: p.imageAlt, caption: p.title, visible: true }));
  const plates = [...productPlates, ...gallery.filter((g) => g !== portrait)];

  return (
    <>
      <HomeMotion />

      {/* ── Presentación ── */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__sticky">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="eyebrow hero__place">Obrador · Las Cucharetas, Cortes de Baza (Granada)</p>
              <h1 id="hero-title" className="display hero__title">
                <span className="ln">
                  <span>Alta</span>
                </span>
                <span className="ln">
                  <span>pastelería</span>
                </span>
                <span className="ln">
                  <span>
                    <em>de temporada</em>
                  </span>
                </span>
              </h1>
              <p className="hero__lead">
                Candú es el obrador de {b.displayName} en Las Cucharetas: más de veinte años de oficio, inspiración en la pastelería francesa y fruta de
                temporada.
              </p>
              <div className="hero__ctas">
                <a href="#temporada" className="btn btn--lg" data-magnetic>
                  <span>Ver la tienda</span> <IconArrow />
                </a>
                <a href={`https://wa.me/${b.whatsapp}`} className="btn btn--ghost btn--lg" target="_blank" rel="noopener noreferrer" data-magnetic>
                  <IconWhatsapp /> <span>WhatsApp</span>
                </a>
              </div>
              <dl className="hero__facts">
                <div>
                  <dt>+20</dt>
                  <dd>años de oficio</dd>
                </div>
                <div>
                  <dt>2018</dt>
                  <dd>formación con Paco Torreblanca</dd>
                </div>
                <div>
                  <dt>Temporada</dt>
                  <dd>fruta e ingredientes naturales</dd>
                </div>
              </dl>
            </div>
            <div className="hero__visual">
              <HeroEntremet fallbackSrc="/obrador/candu-1.jpg" fallbackAlt="Postre con forma de cereza cortado por la mitad, de Candú" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Banda continua ── */}
      <div className="marquee" aria-hidden>
        <div className="marquee__track">
          {[0, 1].map((k) => (
            <span key={k}>
              Fruta de temporada <i>✦</i> Inspiración francesa <i>✦</i> Más de veinte años de oficio <i>✦</i> Formación con Paco Torreblanca <i>✦</i> Obrador en
              Las Cucharetas <i>✦</i>{" "}
            </span>
          ))}
        </div>
      </div>

      {/* ── Juani ── */}
      <section className="section story" id="juani" aria-labelledby="juani-title">
        <div className="wrap story__grid">
          {portrait && (
            <figure className="story__portrait" data-tilt>
              <img src={portrait.src} alt={portrait.alt} loading="lazy" decoding="async" />
            </figure>
          )}
          <div className="story__text" data-reveal>
            <span className="idx">{b.displayName}, pastelera</span>
            <h2 id="juani-title">{s.story.title}</h2>
            {s.story.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.story.quote && (
              <blockquote className="quote">
                <p>“{s.story.quote}”</p>
                <footer>— {s.story.quoteAuthor}</footer>
              </blockquote>
            )}
          </div>
        </div>
      </section>

      {/* ── Tienda ── */}
      <section className="section shop" id="temporada" aria-labelledby="temporada-title">
        <div className="wrap">
          <div className="section-head section-head--split" data-reveal>
            <div style={{ display: "grid", gap: 12 }}>
              <span className="idx">La tienda</span>
              <h2 id="temporada-title">Disponible esta temporada</h2>
            </div>
            <p>Candú no trabaja con un stock fijo: publica cada pieza cuando está lista y la retira cuando se agota. Elige, reserva tu fecha y recoge o recibe.</p>
          </div>
          <Catalog
            products={products}
            categories={s.catalog.categories}
            seasons={s.catalog.seasons}
            emptyTitle={s.catalog.emptyTitle}
            emptyText={s.catalog.emptyText}
            whatsapp={b.whatsapp}
            showcase={plates.slice(0, 3).map((g) => ({ src: g.src, alt: g.alt }))}
          />
        </div>
      </section>

      {/* ── Obrador ── */}
      {plates.length > 0 && (
        <section className="obrador" id="obrador" aria-labelledby="obrador-title">
          <div className="obrador__pin section">
            <div className="wrap">
              <div className="section-head section-head--split" data-reveal>
                <div style={{ display: "grid", gap: 12 }}>
                  <span className="idx">El obrador</span>
                  <h2 id="obrador-title">Capas, cortes y fruta</h2>
                </div>
                <p>Glaseados, mousses y bizcochos que se entienden al cortarlos. Fotografías reales de piezas de Candú: muestran su trabajo, no todas están a la venta ahora.</p>
              </div>
            </div>
            <ObradorGallery plates={plates.map((g) => ({ src: g.src, alt: g.alt, caption: g.caption }))} />
          </div>
        </section>
      )}

      {/* ── Cómo pedir ── */}
      <section className="section how" aria-labelledby="como-title">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <span className="idx">Cómo pedir</span>
            <h2 id="como-title">Tres pasos, sin prisas</h2>
          </div>
          <ol className="steps">
            {[
              { n: "01", t: "Elige", d: "Añade a la cesta lo que te apetezca de la temporada. Cada pieza indica su disponibilidad y su fecha límite." },
              { n: "02", t: "Reserva tu fecha", d: "Indica cuándo lo quieres y si lo recoges o te lo llevamos. Solo se ofrecen fechas y zonas que Candú tiene confirmadas." },
              { n: "03", t: "Sigue tu pedido", d: "Recibes un enlace privado con el estado: recibido, confirmado, en preparación, en reparto y entregado." },
            ].map((s2) => (
              <li className="step" key={s2.t} data-reveal>
                <span className="step__n">{s2.n}</span>
                <h3>{s2.t}</h3>
                <p>{s2.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Restaurantes ── */}
      {s.restaurants.enabled && (
        <section className="section restaurants" aria-labelledby="rest-title">
          <div className="wrap restaurants__inner" data-reveal>
            <div>
              <h2 id="rest-title">{s.restaurants.title}</h2>
              <p>{s.restaurants.text}</p>
            </div>
            <a href={`mailto:${b.email}?subject=${encodeURIComponent("Postres para restaurante")}`} className="btn btn--lg">
              <span>Escribir a Candú</span> <IconArrow />
            </a>
          </div>
        </section>
      )}
    </>
  );
}
