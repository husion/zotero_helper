const fs = require('fs');
const vm = require('vm');

function transformImports(code) {
  return code
    .replace(/^import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.+?)['"];?$/gm, (_match, names, specifier) => {
      return `const { ${names.trim()} } = __deps[${JSON.stringify(specifier)}];`;
    })
    .replace(/^import\s+['"](.+?)['"];?$/gm, (_match, specifier) => {
      return `if (__sideEffects[${JSON.stringify(specifier)}]) { __sideEffects[${JSON.stringify(specifier)}](); }`;
    })
    .replace(/^export\s+class\s+/gm, 'class ')
    .replace(/^export\s+function\s+/gm, 'function ')
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+let\s+/gm, 'let ')
    .replace(/^export\s+async\s+function\s+/gm, 'async function ');
}

function loadSourceModule(filePath, options = {}) {
  const {
    deps = {},
    sideEffects = {},
    context = {},
    exports: exportNames = []
  } = options;

  const originalCode = fs.readFileSync(filePath, 'utf8');
  const transformedCode = `${transformImports(originalCode)}\nmodule.exports = { ${exportNames.join(', ')} };\n`;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    __deps: deps,
    __sideEffects: sideEffects,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    ...context
  };

  vm.runInNewContext(transformedCode, sandbox, { filename: filePath });
  return sandbox.module.exports;
}

module.exports = { loadSourceModule };
