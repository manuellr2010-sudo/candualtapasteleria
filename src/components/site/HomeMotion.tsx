"use client";

import { useEffect } from "react";
import { isLite, motionReduced } from "@/lib/motion";

/**
 * Transiciones cinematográficas de la portada (GSAP + ScrollTrigger).
 * No se cargan con "reducir movimiento" ni en modo ligero: el contenido ya es visible sin ellas.
 */
export function HomeMotion() {
  useEffect(() => {
    if (motionReduced() || isLite()) return;
    // Apariciones al entrar en pantalla: IntersectionObserver + CSS (no dependen de requestAnimationFrame).
    document.documentElement.classList.add("reveal-ready");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { rootMargin: "0px 0px -10% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    let ctx: { revert: () => void } | null = null;
    let mm: { revert: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        if (document.querySelector(".hero__copy")) {
          gsap.to(".hero__copy", {
            yPercent: -10,
            opacity: 0.35,
            ease: "none",
            scrollTrigger: { trigger: ".hero", start: "bottom bottom", end: "bottom top", scrub: true },
          });
        }

        const words = gsap.utils.toArray<HTMLElement>(".statement .w");
        if (words.length) {
          gsap.fromTo(
            words,
            { opacity: 0.16 },
            { opacity: 1, ease: "none", stagger: 0.05, scrollTrigger: { trigger: ".statement", start: "top 75%", end: "bottom 55%", scrub: true } },
          );
        }

        const portrait = document.querySelector(".story__portrait");
        if (portrait) {
          gsap.fromTo(
            portrait,
            { clipPath: "inset(18% 12% 18% 12% round 999px 999px 18px 18px)" },
            { clipPath: "inset(0% 0% 0% 0% round 999px 999px 18px 18px)", ease: "power2.out", scrollTrigger: { trigger: portrait, start: "top 85%", end: "top 30%", scrub: true } },
          );
          gsap.fromTo(".story__portrait img", { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: portrait, start: "top bottom", end: "bottom top", scrub: true } });
        }
      });

      mm = gsap.matchMedia();
      (mm as unknown as { add: (q: string, fn: () => void) => void }).add("(min-width: 900px)", () => {
        const track = document.querySelector<HTMLElement>(".obrador__track");
        const pin = document.querySelector<HTMLElement>(".obrador__pin");
        if (!track || !pin) return;
        track.dataset.pinned = "1";
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
        });
        track.querySelectorAll<HTMLElement>(".plate__img img").forEach((img) => {
          gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: "none", scrollTrigger: { trigger: img, containerAnimation: tween, start: "left right", end: "right left", scrub: true } });
        });
        return () => {
          delete track.dataset.pinned;
        };
      });
      ScrollTrigger.refresh();
    })();

    return () => {
      io.disconnect();
      cancelled = true;
      mm?.revert();
      ctx?.revert();
    };
  }, []);
  return null;
}
