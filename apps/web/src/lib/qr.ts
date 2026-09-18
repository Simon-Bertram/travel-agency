import { renderSVG } from "uqr";

export function totpQrSvg(totpURI: string) {
  return renderSVG(totpURI, { pixelSize: 6 });
}
