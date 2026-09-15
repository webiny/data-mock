/**
 * Extracts the last complete JSON value from a command's stdout.
 *
 * v5's `webiny output` runs pulumi with `stdio: "inherit"`, so its JSON shares the stream with
 * other CLI chatter and a plain `JSON.parse(stdout)` cannot find it. Taking the LAST value rather
 * than the first matters because banners and warnings can themselves contain braces.
 *
 * A literal `null` is a real answer from both majors — it is what they print for a stack that does
 * not exist — so it is matched too, and `undefined` is reserved for "nothing parseable was found".
 * The caller must treat `null` as unknown, never as not-deployed.
 */
export function parseJsonOutput(output: string): unknown {
  let found: unknown;
  let foundAny = false;

  for (let index = 0; index < output.length; index++) {
    const char = output[index];

    if (char === "{" || char === "[") {
      const end = findBalancedEnd(output, index);
      if (end === -1) {
        continue;
      }

      try {
        found = JSON.parse(output.slice(index, end + 1));
        foundAny = true;
        // Resume after this value rather than inside it: a nested object is part of its parent,
        // not a separate answer.
        index = end;
      } catch {
        // Not JSON after all — keep scanning from the next character.
      }
      continue;
    }

    if (char === "n" && output.startsWith("null", index) && isStandalone(output, index, 4)) {
      found = null;
      foundAny = true;
      index += 3;
    }
  }

  return foundAny ? found : undefined;
}

/** Index of the closing bracket that balances the one at `start`, or -1 if it never closes. */
function findBalancedEnd(output: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < output.length; index++) {
    const char = output[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth++;
      continue;
    }

    if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

/** Guards against matching the "null" inside a word such as "nullable" or a quoted string. */
function isStandalone(output: string, start: number, length: number): boolean {
  const before = start === 0 ? "" : output[start - 1];
  const after = output[start + length] ?? "";
  const isWordChar = (value: string): boolean => /[A-Za-z0-9_"']/.test(value);

  return !isWordChar(before ?? "") && !isWordChar(after);
}
