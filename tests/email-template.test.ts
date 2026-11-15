import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADRIANA_SIGNATURE, BASE_TEMPLATE } from '../server/email/template-source';
import { defaultOutreach, renderSparkedEmail } from '../server/email/render';

describe('plantilla de correo de Adriana', () => {
  it('conserva el formato 3 y la firma aprobada', () => {
    expect(readFileSync('server/email/templates/plantilla-base-sparked.html', 'utf8').trim()).toBe(BASE_TEMPLATE);
    expect(readFileSync('server/email/templates/firma-adriana.html', 'utf8').trim()).toBe(ADRIANA_SIGNATURE);
    expect(BASE_TEMPLATE).toContain('{{SIGNATURE}}');
    expect(ADRIANA_SIGNATURE).toContain('Adriana V. Márquez');
  });

  it('el cotidiano es el correo que se envía: una columna, sin tarjeta ni paso siguiente', () => {
    const rendered = renderSparkedEmail({
      subject: 'Aarushi Salon: a note on the website',
      body: 'I am writing because I looked at Aarushi Salon.\n\nIf you want, I can send a short read.',
      firstName: 'Aarushi',
      lang: 'en',
      level: 'cotidiano',
    });
    expect(rendered.html).toContain("font-family:'Fira Sans',Arial,Helvetica,sans-serif");
    expect(rendered.html).toContain('max-width:640px');
    expect(rendered.html).toContain('color:#000000');
    expect(rendered.html).toContain('Hi Aarushi,');
    expect(rendered.html).toContain(ADRIANA_SIGNATURE);
    expect(rendered.html).not.toContain('#D9EBFA');
    expect(rendered.html).not.toContain('[Section heading');
    expect(rendered.html).not.toContain('<script');
    expect(rendered.html).not.toContain('<form');
    expect(rendered.text).toContain('Adriana V. Márquez');
    expect(rendered.text).toContain('https://sparkedreactions.com/');
    expect(rendered.html.match(/background-color:#F5EDE3/g)).toHaveLength(1);
  });

  it('la propuesta usa una sola tarjeta crema y un solo bloque de acción', () => {
    const rendered = renderSparkedEmail({
      subject: 'Proposal',
      body: 'The reason is the public site.',
      lang: 'en',
      level: 'propuesta',
      summary: 'One page read of the current site.',
      nextStep: { title: 'Next step', detail: 'Reply if you want the read.' },
    });
    expect(rendered.html).toContain('background-color:#F5EDE3');
    expect(rendered.html).toContain('background-color:#D9EBFA');
    expect(rendered.html).toContain('Next step');
  });

  it('Charlotte sale en inglés y el texto de salida no promete resultados', () => {
    const copy = defaultOutreach('Aarushi Salon', 'East Forest, Charlotte, NC');
    expect(copy.lang).toBe('en');
    expect(copy.body).not.toContain('—');
    expect(copy.body.toLowerCase()).not.toContain('roi');
    expect(copy.subject).toContain('Aarushi Salon');
  });
});
