import {
  CancellationToken, DocumentFormattingEditProvider, DocumentSelector,
  ExtensionContext, FormattingOptions, Range,
  TextDocument, TextEdit, languages, Disposable
} from "vscode";
import { spawn } from "child_process";

import { getCompilerPath, findProblemsRaw } from "./compiler";
import { setStatusBar, outputChannel } from "./vscode";


function getFormatRange(document: TextDocument): Range {
  return new Range(
    0,
    0,
    document.lineCount,
    document.lineAt(document.lineCount - 1).text.length
  );
}

export class CrystalFormattingEditProvider implements DocumentFormattingEditProvider {
  async provideDocumentFormattingEdits(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken
  ): Promise<TextEdit[]> {
    if (document.fileName.endsWith(".ecr")) {
      outputChannel.appendLine(`[Format] Cannot format ECR files (yet)`)
      return;
    }

    const dispose = setStatusBar('formatting...');
    try {
      outputChannel.appendLine(`[Format] Formatting ${document.fileName}...`);
      const format = await spawnFormatTool(document);
      if (!format.length) return;

      outputChannel.appendLine('[Format] Success.')
      return [TextEdit.replace(getFormatRange(document), format)];
    } catch (err) {
      if (!err) return;

      outputChannel.appendLine(`[Format] Failed: ${err.trim()}`);
      return [];
    } finally {
      dispose();
    }
  }
}

export function registerFormatter(
  selector: DocumentSelector,
  context: ExtensionContext
): Disposable {
  let disposable: Disposable = languages.registerDocumentFormattingEditProvider(
    selector,
    new CrystalFormattingEditProvider()
  )

  context.subscriptions.push(disposable);

  return disposable;
}

async function spawnFormatTool(document: TextDocument): Promise<string> {
  const compiler = await getCompilerPath();

  return await new Promise((res, rej) => {
    const child = spawn(
      compiler,
      ['tool', 'format', '--no-color', '-'],
      { shell: process.platform == "win32" }
    );

    child.stdin.write(document.getText());
    child.stdin.end();

    const out: string[] = [];
    const err: string[] = [];

    child.stdout
      .setEncoding('utf-8')
      .on('data', d => out.push(d));

    child.stderr
      .setEncoding('utf-8')
      .on('data', d => err.push(d));

    child.on('close', () => {
      if (err.length > 0) {
        const err_resp = err.join('') + "\n" + out.join('')
        findProblemsRaw(err_resp, document.uri)
        rej(err_resp);
      } else {
        const out_resp = out.join('')
        findProblemsRaw(out_resp, document.uri)
        res(out_resp);
      }
    })
  });
}
