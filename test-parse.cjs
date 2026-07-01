const fs = require('fs');
const ts = require('typescript');
const sourceFile = ts.createSourceFile(
  'Dashboard.tsx',
  fs.readFileSync('src/pages/Dashboard.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function visit(node) {
  if (node.kind === ts.SyntaxKind.JsxElement) {
    if (node.openingElement.tagName.getText() !== node.closingElement.tagName.getText()) {
      console.log('Mismatch:', node.openingElement.tagName.getText(), node.closingElement.tagName.getText());
    }
  }
  ts.forEachChild(node, visit);
}

const parseDiagnostics = sourceFile.parseDiagnostics;
if (parseDiagnostics.length > 0) {
  parseDiagnostics.forEach(diagnostic => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      console.log(`Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(`Error: ${message}`);
    }
  });
} else {
  console.log("No syntax errors found by TS parser!");
}
