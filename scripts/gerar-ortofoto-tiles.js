// Gera a pirâmide Deep Zoom (DZI) da ortofoto do Porto Itapoá a partir do
// JPEG bruto em assets/images/ORTOFOTO.jpg — usado pelo OpenSeadragon no
// lugar do Tour 360° pra essa obra (pedido explícito, 2026-08-25).
// `sharp` já embute o libvips compilado, sem precisar instalar nada além
// de `npm install sharp` (ver painel-mse-pasta-canonica na memória).
const path = require('path');
const sharp = require('sharp');

const ORIGEM = path.join(__dirname, '..', 'prototipo', 'assets', 'images', 'ORTOFOTO.jpg');
const DESTINO_ID = path.join(__dirname, '..', 'prototipo', 'assets', 'ortofoto-porto', 'ortofoto');

async function main() {
  const inicio = Date.now();
  console.log('Lendo', ORIGEM);
  await sharp(ORIGEM, { limitInputPixels: false })
    .tile({
      size: 256,
      overlap: 1,
      layout: 'dz',
      format: 'jpg',
      quality: 82,
    })
    .toFile(DESTINO_ID);
  console.log(`Pronto em ${((Date.now() - inicio) / 1000).toFixed(1)}s -> ${DESTINO_ID}.dzi`);
}

main().catch(err => { console.error(err); process.exit(1); });
