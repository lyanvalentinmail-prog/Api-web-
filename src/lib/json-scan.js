'use strict';

/**
 * Analizador de sintaxis JSON sin dependencias.
 *
 * Motivo: `JSON.parse` de V8 cambia el formato de sus mensajes entre versiones y
 * en algunos casos no indica la posición del fallo. Este escáner recorre el
 * texto una sola vez, sin construir valores, y devuelve siempre la posición
 * exacta del primer error de sintaxis (útil para señalar la línea y la columna
 * en el validador y en el formateador).
 *
 * No sustituye a JSON.parse: si no encuentra errores, el texto es JSON válido.
 */

const MAX_DEPTH = 100;

/** Etiquetas legibles y sugerencias para cada tipo de error. */
const REASONS = {
  UNEXPECTED_END: { label: 'Fin inesperado', hint: 'El documento termina antes de cerrar una llave, un corchete o unas comillas.' },
  UNEXPECTED_TOKEN: { label: 'Valor no válido', hint: 'Se esperaba un objeto, un array, un texto, un número, true, false o null.' },
  EXPECTED_KEY: { label: 'Nombre de propiedad inválido', hint: 'Dentro de un objeto las claves deben ir entre comillas dobles.' },
  EXPECTED_COLON: { label: 'Falta ":"', hint: 'Después del nombre de la propiedad debe venir ":" y su valor.' },
  EXPECTED_COMMA_OR_END: { label: 'Falta "," o "}"', hint: 'Entre dos propiedades hace falta una coma, y el objeto debe cerrarse con "}".' },
  EXPECTED_COMMA_OR_BRACKET: { label: 'Falta "," o "]"', hint: 'Entre dos elementos de un array hace falta una coma, y el array debe cerrarse con "]".' },
  UNTERMINATED_STRING: { label: 'Comillas sin cerrar', hint: 'Cada texto debe empezar y terminar con comillas dobles.' },
  UNESCAPED_CONTROL: { label: 'Salto de línea dentro de un texto', hint: 'Los saltos de línea y tabuladores deben escaparse como \\n o \\t.' },
  INVALID_ESCAPE: { label: 'Escape no válido', hint: 'Los escapes permitidos son \\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX.' },
  INVALID_UNICODE_ESCAPE: { label: 'Escape unicode no válido', hint: 'La forma correcta es \\uXXXX con cuatro dígitos hexadecimales.' },
  INVALID_NUMBER: { label: 'Número mal formado', hint: 'Los números no pueden empezar por 0, ni terminar en punto, ni quedar sin dígitos.' },
  TRAILING_COMMA: { label: 'Coma sobrante', hint: 'No puede haber una coma justo antes de cerrar un objeto o un array: JSON no admite comas finales.' },
  TRAILING_CONTENT: { label: 'Contenido adicional', hint: 'Sólo puede haber un valor JSON en el documento; sobra texto al final.' },
  TOO_DEEP: { label: 'Anidamiento excesivo', hint: `El documento supera la profundidad máxima admitida (${MAX_DEPTH} niveles).` },
  DUPLICATE_KEY: { label: 'Propiedad duplicada', hint: 'La misma clave aparece más de una vez en el objeto (JSON válido, pero suele ser un error).' },
};

/**
 * Recorre el texto y devuelve el primer error de sintaxis encontrado.
 * @param {string} text
 * @returns {null | {position: number, reason: string, label: string, hint: string, message: string, duplicateKeys: string[]}}
 */
function findJsonError(text) {
  let index = 0;
  const length = text.length;
  const duplicateKeys = [];

  const fail = (reason, detail) => ({
    position: index,
    reason,
    label: REASONS[reason].label,
    hint: REASONS[reason].hint,
    message: `${REASONS[reason].label}: ${detail}`,
  });

  const isDigit = (char) => char >= '0' && char <= '9';

  function skipWhitespace() {
    while (index < length) {
      const char = text[index];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') index += 1;
      else break;
    }
  }

  function parseString() {
    // Se asume que text[index] es la comilla de apertura.
    const start = index;
    index += 1;
    while (index < length) {
      const char = text[index];
      if (char === '"') {
        index += 1;
        return { ok: true, value: text.slice(start + 1, index - 1) };
      }
      if (char === '\\') {
        const escape = text[index + 1];
        if (escape === undefined) return { ok: false, error: fail('UNEXPECTED_END', 'el texto termina justo después de una barra invertida') };
        if ('"\\/bfnrt'.includes(escape)) {
          index += 2;
          continue;
        }
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index + 2, index + 6))) {
            index += 1;
            return { ok: false, error: fail('INVALID_UNICODE_ESCAPE', `"\\${text.slice(index, index + 5)}" no tiene 4 dígitos hexadecimales`) };
          }
          index += 6;
          continue;
        }
        index += 1;
        return { ok: false, error: fail('INVALID_ESCAPE', `"\\${escape}" no es una secuencia de escape válida`) };
      }
      if (char === '\n' || char === '\r') {
        return { ok: false, error: fail('UNESCAPED_CONTROL', 'hay un salto de línea dentro de un texto entre comillas') };
      }
      if (char.charCodeAt(0) < 0x20) {
        return { ok: false, error: fail('UNESCAPED_CONTROL', 'hay un carácter de control sin escapar dentro de un texto') };
      }
      index += 1;
    }
    return { ok: false, error: fail('UNTERMINATED_STRING', 'el texto entre comillas no se cierra') };
  }

  function parseNumber() {
    if (text[index] === '-') index += 1;
    if (text[index] === '0') {
      index += 1;
      if (isDigit(text[index])) return fail('INVALID_NUMBER', 'un número no puede empezar por 0');
    } else if (isDigit(text[index])) {
      while (isDigit(text[index])) index += 1;
    } else {
      return fail('INVALID_NUMBER', 'se esperaba un dígito');
    }
    if (text[index] === '.') {
      index += 1;
      if (!isDigit(text[index])) return fail('INVALID_NUMBER', 'falta al menos un dígito después del punto decimal');
      while (isDigit(text[index])) index += 1;
    }
    if (text[index] === 'e' || text[index] === 'E') {
      index += 1;
      if (text[index] === '+' || text[index] === '-') index += 1;
      if (!isDigit(text[index])) return fail('INVALID_NUMBER', 'el exponente no tiene dígitos');
      while (isDigit(text[index])) index += 1;
    }
    return null;
  }

  function parseValue(depth) {
    if (depth > MAX_DEPTH) return fail('TOO_DEEP', `se superaron los ${MAX_DEPTH} niveles de anidamiento`);
    skipWhitespace();
    const char = text[index];

    if (index >= length) return fail('UNEXPECTED_END', 'se esperaba un valor y el documento ya ha terminado');
    if (char === '{') return parseObject(depth);
    if (char === '[') return parseArray(depth);
    if (char === '"') {
      const result = parseString();
      return result.ok ? null : result.error;
    }
    if (char === '-' || isDigit(char)) return parseNumber();
    if (text.startsWith('true', index)) {
      index += 4;
      return null;
    }
    if (text.startsWith('false', index)) {
      index += 5;
      return null;
    }
    if (text.startsWith('null', index)) {
      index += 4;
      return null;
    }
    if (char === "'") return fail('UNEXPECTED_TOKEN', 'JSON no admite comillas simples: usa comillas dobles');
    return fail('UNEXPECTED_TOKEN', `se encontró "${char}" (¿una coma de más o una llave sin cerrar?)`);
  }

  function parseObject(depth) {
    index += 1; // {
    skipWhitespace();
    if (text[index] === '}') {
      index += 1;
      return null;
    }
    const seen = new Set();
    for (;;) {
      skipWhitespace();
      if (index >= length) return fail('UNEXPECTED_END', 'el objeto no se cierra con "}"');
      if (text[index] === "'") return fail('UNEXPECTED_TOKEN', 'JSON no admite comillas simples: usa comillas dobles');
      if (text[index] !== '"') return fail('EXPECTED_KEY', 'las claves deben ir entre comillas dobles');
      const key = parseString();
      if (!key.ok) return key.error;
      if (seen.has(key.value)) duplicateKeys.push(key.value);
      seen.add(key.value);

      skipWhitespace();
      if (text[index] !== ':') return fail('EXPECTED_COLON', `después de la clave "${key.value}" falta ":"`);
      index += 1;

      const valueError = parseValue(depth + 1);
      if (valueError) return valueError;

      skipWhitespace();
      if (text[index] === ',') {
        index += 1;
        skipWhitespace();
        if (text[index] === '}') return fail('TRAILING_COMMA', 'hay una coma antes de cerrar el objeto');
        continue;
      }
      if (text[index] === '}') {
        index += 1;
        return null;
      }
      if (index >= length) return fail('UNEXPECTED_END', 'el objeto no se cierra con "}"');
      return fail('EXPECTED_COMMA_OR_END', `se encontró "${text[index]}" donde se esperaba "," o "}"`);
    }
  }

  function parseArray(depth) {
    index += 1; // [
    skipWhitespace();
    if (text[index] === ']') {
      index += 1;
      return null;
    }
    for (;;) {
      const valueError = parseValue(depth + 1);
      if (valueError) return valueError;

      skipWhitespace();
      if (text[index] === ',') {
        index += 1;
        skipWhitespace();
        if (text[index] === ']') return fail('TRAILING_COMMA', 'hay una coma antes de cerrar el array');
        continue;
      }
      if (text[index] === ']') {
        index += 1;
        return null;
      }
      if (index >= length) return fail('UNEXPECTED_END', 'el array no se cierra con "]"');
      return fail('EXPECTED_COMMA_OR_BRACKET', `se encontró "${text[index]}" donde se esperaba "," o "]"`);
    }
  }

  const error = parseValue(0);
  if (error) return { ...error, duplicateKeys };
  skipWhitespace();
  if (index < length) {
    return { ...fail('TRAILING_CONTENT', `sobra texto a partir de "${text.slice(index, index + 20)}"`), duplicateKeys };
  }
  return duplicateKeys.length ? { position: null, reason: 'DUPLICATE_KEY', label: REASONS.DUPLICATE_KEY.label, hint: REASONS.DUPLICATE_KEY.hint, message: `Propiedades duplicadas: ${[...new Set(duplicateKeys)].join(', ')}`, duplicateKeys } : null;
}

/**
 * Completa un error de sintaxis con línea, columna y fragmento señalado.
 * @param {{position: number|null, reason: string, label: string, hint: string, message: string}} error
 * @param {string} text
 */
function locateError(error, text) {
  if (error.position === null || error.position === undefined) return { ...error, position: null, line: null, column: null, snippet: null };

  const before = text.slice(0, error.position);
  const lines = before.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;

  const rawLine = text.split('\n')[line - 1] ?? '';
  const maxWidth = 100;
  // Ventana de contexto alrededor del error para que el fragmento sea legible.
  const windowStart = Math.max(0, Math.min(column - 1 - 40, Math.max(0, rawLine.length - maxWidth)));
  const windowText = rawLine.slice(windowStart, windowStart + maxWidth);
  const caretColumn = Math.min(Math.max(0, column - 1 - windowStart), Math.max(0, windowText.length - 1));

  return {
    ...error,
    position: error.position,
    line,
    column,
    snippet: {
      line: windowText,
      pointer: `${' '.repeat(caretColumn)}^`,
      lineNumber: line,
      columnNumber: column,
    },
  };
}

module.exports = { findJsonError, locateError, MAX_DEPTH };
