import { EXAMPLES, type ExampleId, type GeneratedTest } from '@testpilot/shared';
import { HttpError } from './errors.js';
import type { TestGenerator } from './test-generator.js';

// Modo sin IA: respuestas predefinidas para los ejemplos de la web. Los scripts se ejecutan
// de verdad en el runner, así que deben seguir pasando contra saucedemo.com.

const DEMO_WARNING = 'Modo demo: este script es predefinido; no lo generó la IA.';

const DEMO_TESTS: Record<ExampleId, Omit<GeneratedTest, 'warnings'>> = {
  'invalid-login': {
    title: 'Login con usuario inválido muestra un error',
    steps: [
      'Abrir la página de login',
      'Enviar credenciales inválidas',
      'Verificar el mensaje de error',
    ],
    assumptions: ['El sitio es la demo pública de Sauce Labs.'],
    script: `import { test, expect } from '@playwright/test';

test('login con usuario inválido muestra un error', async ({ page }) => {
  await test.step('Abrir la página de login', async () => {
    await page.goto('https://www.saucedemo.com');
  });

  await test.step('Enviar credenciales inválidas', async () => {
    await page.getByPlaceholder('Username').fill('usuario_invalido');
    await page.getByPlaceholder('Password').fill('clave_invalida');
    await page.getByRole('button', { name: 'Login' }).click();
  });

  await test.step('Verificar el mensaje de error', async () => {
    await expect(page.locator('[data-test="error"]')).toContainText(
      'Username and password do not match',
    );
  });
});
`,
  },
  'add-to-cart': {
    title: 'Añadir la mochila al carrito actualiza el contador',
    steps: [
      'Iniciar sesión con el usuario de demostración',
      'Añadir la mochila al carrito',
      'Verificar el contador del carrito',
    ],
    assumptions: [
      'Se usan las credenciales de demostración que el propio sitio publica (standard_user / secret_sauce).',
    ],
    script: `import { test, expect } from '@playwright/test';

test('añadir la mochila al carrito actualiza el contador', async ({ page }) => {
  await test.step('Iniciar sesión con el usuario de demostración', async () => {
    await page.goto('https://www.saucedemo.com');
    await page.getByPlaceholder('Username').fill('standard_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/inventory\\.html/);
  });

  await test.step('Añadir la mochila al carrito', async () => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  });

  await test.step('Verificar el contador del carrito', async () => {
    await expect(page.locator('[data-test="shopping-cart-badge"]')).toHaveText('1');
  });
});
`,
  },
  'empty-form': {
    title: 'Enviar el login vacío exige el usuario',
    steps: [
      'Abrir la página de login',
      'Enviar el formulario vacío',
      'Verificar el error de usuario requerido',
    ],
    assumptions: ['El sitio es la demo pública de Sauce Labs.'],
    script: `import { test, expect } from '@playwright/test';

test('enviar el login vacío exige el usuario', async ({ page }) => {
  await test.step('Abrir la página de login', async () => {
    await page.goto('https://www.saucedemo.com');
  });

  await test.step('Enviar el formulario vacío', async () => {
    await page.getByRole('button', { name: 'Login' }).click();
  });

  await test.step('Verificar el error de usuario requerido', async () => {
    await expect(page.locator('[data-test="error"]')).toContainText('Username is required');
  });
});
`,
  },
  // Falla: el título no es un heading en el árbol de accesibilidad. Lo corrige la reparación.
  'catalog-title': {
    title: 'El catálogo muestra el título Products',
    steps: ['Iniciar sesión con el usuario de demostración', 'Verificar el título del catálogo'],
    assumptions: [
      'Se usan las credenciales de demostración que publica el propio sitio (standard_user / secret_sauce).',
      'El título del catálogo es un encabezado de la página.',
    ],
    script: `import { test, expect } from '@playwright/test';

test('el catálogo muestra el título Products', async ({ page }) => {
  await test.step('Iniciar sesión con el usuario de demostración', async () => {
    await page.goto('https://www.saucedemo.com');
    await page.getByPlaceholder('Username').fill('standard_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/inventory\\.html/);
  });

  await test.step('Verificar el título del catálogo', async () => {
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  });
});
`,
  },
  // Falla por un bug real del sitio: con problem_user la ordenación no tiene efecto.
  'sort-by-price': {
    title: 'Ordenar por precio ascendente muestra primero el producto más barato',
    steps: [
      'Iniciar sesión con problem_user',
      'Ordenar por precio de menor a mayor',
      'Verificar el precio del primer producto',
    ],
    assumptions: ['problem_user usa la contraseña de demostración que publica el sitio.'],
    script: `import { test, expect } from '@playwright/test';

test('ordenar por precio ascendente muestra primero el producto más barato', async ({ page }) => {
  await test.step('Iniciar sesión con problem_user', async () => {
    await page.goto('https://www.saucedemo.com');
    await page.getByPlaceholder('Username').fill('problem_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/inventory\\.html/);
  });

  await test.step('Ordenar por precio de menor a mayor', async () => {
    await page.getByRole('combobox', { name: 'Sort products' }).selectOption('Price (low to high)');
  });

  await test.step('Verificar el precio del primer producto', async () => {
    await expect(page.locator('[data-test="inventory-item-price"]').first()).toHaveText('$7.99');
  });
});
`,
  },
};

// El ejemplo al que pertenece un script de demo, si lo es.
export const findDemoExample = (script: string): ExampleId | undefined =>
  EXAMPLES.find((example) => DEMO_TESTS[example.id].script === script)?.id;

export const demoTest = (id: ExampleId): GeneratedTest => ({
  ...DEMO_TESTS[id],
  warnings: [DEMO_WARNING],
});

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

export const createDemoGenerator = (): TestGenerator => async (request) => {
  const example = EXAMPLES.find(
    (candidate) => normalize(candidate.instruction) === normalize(request.instruction),
  );

  if (example === undefined) {
    throw new HttpError(
      503,
      'demo_mode',
      'TestPilot está en modo demo, sin IA: solo se pueden generar los ejemplos.',
    );
  }

  return { status: 'ok', test: demoTest(example.id) };
};
