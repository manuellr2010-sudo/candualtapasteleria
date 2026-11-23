/**
 * Preferencia de movimiento (solo navegador). Por defecto sigue al sistema operativo,
 * pero la persona puede activar o reducir las animaciones desde la propia web.
 */
export function motionReduced(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.motion === "reduced";
}

export function isLite(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.lite === "1";
}

export function setMotion(pref: "full" | "reduced") {
  try {
    localStorage.setItem("candu-motion", pref);
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
  document.documentElement.dataset.motion = pref;
  delete document.documentElement.dataset.motionAuto;
  window.dispatchEvent(new CustomEvent("candu-motion", { detail: pref }));
}
