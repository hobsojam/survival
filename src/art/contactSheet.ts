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
    const image = context.createImageData(...def.size);
    image.data.set(rasterizeFrame(def, frame));
    context.putImageData(image, 0, 0);
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    figure.append(canvas, caption);
    samples.append(figure);
  }
  article.append(samples);
  sheet.append(article);
}
