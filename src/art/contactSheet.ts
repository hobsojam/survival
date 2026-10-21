import { palette } from './palette';
import { sprites } from './sprites';
import { rasterizeFrame } from './textures';

const backgrounds = [
  ['Grass', palette.grass2],
  ['Camp earth', palette.earth2],
  ['Night', palette.night]
] as const;

const sheet = document.querySelector<HTMLElement>('#sheet');
if (!sheet) throw new Error('Missing contact sheet root.');

for (const [name, def] of Object.entries(sprites)) for (const frame of Object.keys(def.frames)) {
  const article = document.createElement('article');
  const title = document.createElement('h2');
  title.textContent = `${name} · ${frame}`;
  article.append(title);
  const size = document.createElement('small');
  size.textContent = `${def.size[0]} × ${def.size[1]} px · anchor ${def.anchor.join(', ')}`;
  article.append(size);
  const samples = document.createElement('div');
  samples.className = 'samples';
  for (const [label, color] of backgrounds) {
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.width = def.size[0];
    canvas.height = def.size[1];
    canvas.style.width = `${def.size[0] * 4}px`;
    canvas.style.height = `${def.size[1] * 4}px`;
    canvas.style.backgroundColor = color;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const ground = label === 'Camp earth' ? sprites.earth0 : sprites.grass0;
    const groundImage = context.createImageData(...ground.size);
    groundImage.data.set(rasterizeFrame(ground, 'still'));
    for (let y = 0; y < canvas.height; y += 16) for (let x = 0; x < canvas.width; x += 16) context.putImageData(groundImage, x, y);
    const layer = document.createElement('canvas');
    layer.width = def.size[0]; layer.height = def.size[1];
    const layerContext = layer.getContext('2d');
    if (!layerContext) throw new Error('Canvas 2D is unavailable.');
    const image = layerContext.createImageData(...def.size);
    image.data.set(rasterizeFrame(def, frame));
    layerContext.putImageData(image, 0, 0);
    context.drawImage(layer, 0, 0);
    if (label === 'Night') {
      // Show how opaque sprites read on grass under the game's full night tint.
      context.globalAlpha = 0.55;
      context.fillStyle = palette.night;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 1;
    }
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    figure.append(canvas, caption);
    samples.append(figure);
  }
  article.append(samples);
  sheet.append(article);
}
