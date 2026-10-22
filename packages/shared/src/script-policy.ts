import ts from 'typescript';
import { MAX_SCRIPT_LENGTH } from './index.js';

// Política de seguridad para scripts Playwright generados por IA. Se analiza el AST en lugar
// de buscar texto para que no se pueda evadir con espacios, comentarios o concatenaciones.

const ALLOWED_MODULE = '@playwright/test';
const ALLOWED_IMPORTS = new Set(['test', 'expect']);

// Acceso al runtime de Node, ejecución dinámica de código, reflexión (que permitiría leer
// propiedades prohibidas sin nombrarlas), red fuera del navegador y esperas fijas.
const FORBIDDEN_IDENTIFIERS = new Set([
  'eval',
  'Function',
  'require',
  'process',
  'globalThis',
  'global',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'Buffer',
  'Reflect',
  'Proxy',
  'Object',
  'WebAssembly',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'request',
  'playwright',
  'setTimeout',
  'setInterval',
]);

// Escapes del sandbox por la cadena de prototipos, ejecución de JS arbitrario en la página,
// escritura en disco, peticiones HTTP fuera del navegador y esperas fijas.
const FORBIDDEN_PROPERTIES = new Set([
  'constructor',
  'prototype',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  'evaluate',
  'evaluateHandle',
  '$eval',
  '$$eval',
  'addInitScript',
  'exposeFunction',
  'exposeBinding',
  'route',
  'routeFromHAR',
  'request',
  'setInputFiles',
  'screenshot',
  'pdf',
  'saveAs',
  'storageState',
  'tracing',
  'waitForTimeout',
]);

export type ScriptPolicyResult = { ok: true } | { ok: false; violations: string[] };

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

const isCallTo = (node: ts.CallExpression, object: string, property?: string): boolean => {
  const callee = node.expression;
  if (property === undefined) {
    return ts.isIdentifier(callee) && callee.text === object;
  }
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === object &&
    callee.name.text === property
  );
};

export const checkScriptPolicy = (script: string): ScriptPolicyResult => {
  if (script.length > MAX_SCRIPT_LENGTH) {
    return {
      ok: false,
      violations: [`el script supera ${MAX_SCRIPT_LENGTH} caracteres`],
    };
  }

  const { diagnostics = [] } = ts.transpileModule(script, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  if (diagnostics.length > 0) {
    const messages = diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    );
    return { ok: false, violations: messages.map((message) => `error de sintaxis: ${message}`) };
  }

  const sourceFile = ts.createSourceFile('generated.spec.ts', script, ts.ScriptTarget.ES2022, true);
  const violations = new Set<string>();
  let importsTest = false;
  let hasTest = false;
  let hasStep = false;
  let hasExpect = false;

  const report = (node: ts.Node, message: string) => {
    violations.add(`línea ${lineOf(sourceFile, node)}: ${message}`);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const moduleName = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
      const bindings = node.importClause?.namedBindings;
      const hasOnlyAllowedBindings =
        moduleName === ALLOWED_MODULE &&
        node.importClause?.name === undefined &&
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.every(
          (element) => element.propertyName === undefined && ALLOWED_IMPORTS.has(element.name.text),
        );

      if (hasOnlyAllowedBindings) {
        importsTest ||= bindings.elements.some((element) => element.name.text === 'test');
      } else {
        report(node, `solo se permite "import { test, expect } from '${ALLOWED_MODULE}'"`);
      }
      return;
    }

    if (ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node)) {
      report(node, 'declaraciones de módulo no permitidas');
    } else if (ts.isMetaProperty(node)) {
      report(node, `"${node.getText(sourceFile)}" no está permitido`);
    } else if (ts.isWithStatement(node)) {
      report(node, '"with" no está permitido');
    } else if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
      report(node, `"${node.text}" no está permitido`);
    } else if (ts.isPrivateIdentifier(node) || ts.isComputedPropertyName(node)) {
      report(node, 'nombres de propiedad calculados o privados no permitidos');
    } else if (ts.isPropertyAccessExpression(node) && FORBIDDEN_PROPERTIES.has(node.name.text)) {
      report(node, `".${node.name.text}" no está permitido`);
    } else if (ts.isBindingElement(node)) {
      // const { evaluate } = page o const { constructor: C } = page
      const key = node.propertyName ?? node.name;
      if (ts.isIdentifier(key) && FORBIDDEN_PROPERTIES.has(key.text)) {
        report(node, `"${key.text}" no está permitido`);
      } else if (node.propertyName !== undefined && !ts.isIdentifier(node.propertyName)) {
        report(node, 'la desestructuración con claves calculadas no está permitida');
      }
    } else if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      if (ts.isStringLiteralLike(argument) && FORBIDDEN_PROPERTIES.has(argument.text)) {
        report(node, `"[${argument.getText(sourceFile)}]" no está permitido`);
      } else if (!ts.isNumericLiteral(argument) && !ts.isStringLiteralLike(argument)) {
        report(node, 'el acceso dinámico a propiedades no está permitido');
      }
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        report(node, 'import() dinámico no permitido');
      }
      hasTest ||= isCallTo(node, 'test');
      hasStep ||= isCallTo(node, 'test', 'step');
      hasExpect ||= isCallTo(node, 'expect');
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!importsTest) {
    violations.add(`falta "import { test, expect } from '${ALLOWED_MODULE}'"`);
  }
  if (!hasTest) {
    violations.add('falta un bloque test()');
  }
  if (!hasStep) {
    violations.add('falta al menos un test.step()');
  }
  if (!hasExpect) {
    violations.add('falta al menos una aserción expect()');
  }

  return violations.size === 0 ? { ok: true } : { ok: false, violations: [...violations] };
};
