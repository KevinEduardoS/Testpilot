import type { ExampleId, RepairTestResponse } from '@testpilot/shared';
import { demoTest, findDemoExample } from './demo-generator.js';
import { HttpError } from './errors.js';
import type { TestRepairer } from './test-repairer.js';

// Modo sin IA: diagnósticos predefinidos para los dos ejemplos de demo que fallan a propósito.
// Reproducen lo que la IA concluye con la evidencia real de la ejecución.

const DEMO_REPAIR_WARNING = 'Modo demo: este diagnóstico es predefinido; no lo generó la IA.';

const FIXED_CATALOG_SCRIPT = `import { test, expect } from '@playwright/test';

test('el catálogo muestra el título Products', async ({ page }) => {
  await test.step('Iniciar sesión con el usuario de demostración', async () => {
    await page.goto('https://www.saucedemo.com');
    await page.getByPlaceholder('Username').fill('standard_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/inventory\\.html/);
  });

  await test.step('Verificar el título del catálogo', async () => {
    await expect(page.locator('[data-test="title"]')).toHaveText('Products');
  });
});
`;

const DEMO_REPAIRS: Partial<Record<ExampleId, () => RepairTestResponse>> = {
  'catalog-title': () => {
    const original = demoTest('catalog-title');
    return {
      status: 'fixed',
      diagnosis: {
        category: 'selector',
        summary:
          'El paso falló buscando un heading «Products», pero el snapshot de la página muestra «Products» como texto, no como encabezado. El inicio de sesión funcionó, así que no es un fallo de la aplicación: se localiza el título por su atributo data-test y se sigue verificando el mismo texto.',
      },
      test: {
        ...original,
        script: FIXED_CATALOG_SCRIPT,
        assumptions: [
          'Se usan las credenciales de demostración que publica el propio sitio (standard_user / secret_sauce).',
          'El título del catálogo no es un encabezado accesible; se localiza por data-test="title".',
        ],
        warnings: [DEMO_REPAIR_WARNING],
      },
    };
  },
  'sort-by-price': () => ({
    status: 'bug_report',
    diagnosis: {
      category: 'app_bug',
      summary:
        'La prueba eligió «Price (low to high)», pero el snapshot muestra el selector de nuevo en «Name (A to Z)» y el primer producto sigue costando $29.99. Los selectores y las esperas son correctos: la aplicación ignora la ordenación con problem_user. Se reporta el bug y la prueba se mantiene sin cambios.',
    },
    report: {
      title: 'La ordenación por precio no tiene efecto con problem_user',
      severity: 'medium',
      stepsToReproduce: [
        'Abrir https://www.saucedemo.com',
        'Iniciar sesión con problem_user / secret_sauce',
        'En el catálogo, elegir «Price (low to high)» en el selector de orden',
      ],
      expected:
        'Los productos se ordenan de menor a mayor precio y el primero es Sauce Labs Onesie ($7.99).',
      actual:
        'El orden no cambia: el primer producto sigue siendo Sauce Labs Backpack ($29.99) y el selector vuelve a «Name (A to Z)».',
    },
  }),
};

export const createDemoRepairer = (): TestRepairer => async (request) => {
  const example = findDemoExample(request.script);
  const repair = example === undefined ? undefined : DEMO_REPAIRS[example];

  if (repair === undefined) {
    throw new HttpError(
      503,
      'demo_mode',
      'TestPilot está en modo demo, sin IA: solo se pueden reparar los ejemplos «Título del catálogo» y «Ordenar por precio».',
    );
  }
  return repair();
};
