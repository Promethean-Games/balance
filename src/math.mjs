function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

export class Rational {
  constructor(numerator, denominator = 1n) {
    if (denominator === 0n) throw new RangeError('Division by zero');
    const sign = denominator < 0n ? -1n : 1n;
    const divisor = gcd(numerator, denominator);
    this.numerator = (numerator / divisor) * sign;
    this.denominator = (denominator / divisor) * sign;
  }

  add(other) {
    return new Rational(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  subtract(other) {
    return new Rational(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  multiply(other) {
    return new Rational(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  divide(other) {
    if (other.numerator === 0n) throw new RangeError('Division by zero');
    return new Rational(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  equals(other) {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  isPositive() {
    return this.numerator > 0n;
  }

  isNegative() {
    return this.numerator < 0n;
  }

  toString() {
    return this.denominator === 1n
      ? String(this.numerator)
      : `${this.numerator}/${this.denominator}`;
  }

  toDecimal(places = 3) {
    const scale = 10n ** BigInt(places);
    const rounded = (this.numerator * scale * 2n / this.denominator + 1n) / 2n;
    const sign = rounded < 0n ? '-' : '';
    const digits = String(rounded < 0n ? -rounded : rounded).padStart(places + 1, '0');
    const whole = digits.slice(0, -places);
    const fraction = digits.slice(-places).replace(/0+$/, '');
    return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
  }
}

export function parseRational(input) {
  let text = String(input).trim();
  let percentage = false;
  if (text.endsWith('%')) {
    percentage = true;
    text = text.slice(0, -1).trim();
  }

  const fraction = /^([+-]?\d+)\s*\/\s*(\d+)$/.exec(text);
  let value;
  if (fraction) {
    value = new Rational(BigInt(fraction[1]), BigInt(fraction[2]));
  } else {
    const decimal = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
    if (!decimal) throw new TypeError(`Invalid number: ${input}`);
    const places = decimal[3]?.length ?? 0;
    const denominator = 10n ** BigInt(places);
    const sign = decimal[1] === '-' ? -1n : 1n;
    const digits = BigInt(`${decimal[2]}${decimal[3] ?? ''}`);
    value = new Rational(sign * digits, denominator);
  }

  if (percentage) value = value.divide(new Rational(100n));
  return value;
}

function tokenKind(token) {
  if (typeof token === 'string') {
    if (/^[+-]?\d+(?:\.\d+)?%?$/.test(token) || /^[+-]?\d+\/\d+$/.test(token)) return 'number';
    if (token === '(' || token === ')') return 'paren';
    return 'operator';
  }
  if (token.kind === 'number' || token.type === 'number') return 'number';
  if (token.kind === 'paren' || token.type === 'paren') return 'paren';
  if (token.kind === 'operator' || token.type === 'operator') return 'operator';
  return null;
}

function tokenValue(token) {
  if (token === null || token === undefined) return undefined;
  return typeof token === 'string' ? token : token.value;
}

export function evaluateExpression(tokens, { implicitAddition = false } = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  let index = 0;
  let numberCount = 0;

  function expression() {
    let value = term();
    if (!value) return null;
    while (index < tokens.length && (
      ['+', '-'].includes(tokenValue(tokens[index]))
      || (implicitAddition && tokenKind(tokens[index]) === 'number')
    )) {
      const implicit = implicitAddition && tokenKind(tokens[index]) === 'number';
      const operator = implicit ? '+' : tokenValue(tokens[index++]);
      const right = term();
      if (!right) return null;
      value = operator === '+' ? value.add(right) : value.subtract(right);
      if (value.isNegative()) return null;
    }
    return value;
  }

  function term() {
    let value = factor();
    if (!value) return null;
    while (index < tokens.length && ['×', '*', '÷'].includes(tokenValue(tokens[index]))) {
      const operator = tokenValue(tokens[index++]);
      const right = factor();
      if (!right) return null;
      try {
        value = operator === '÷' ? value.divide(right) : value.multiply(right);
      } catch {
        return null;
      }
      if (value.isNegative()) return null;
    }
    return value;
  }

  function factor() {
    const token = tokens[index];
    if (!token) return null;
    const kind = tokenKind(token);
    const value = tokenValue(token);
    if (kind === 'number') {
      index += 1;
      numberCount += 1;
      try {
        const parsed = parseRational(value);
        return parsed.isNegative() ? null : parsed;
      } catch {
        return null;
      }
    }

    if (kind === 'paren' && value === '(') {
      index += 1;
      const inner = expression();
      if (!inner || tokenValue(tokens[index]) !== ')') return null;
      index += 1;
      return inner;
    }
    return null;
  }

  const result = expression();
  if (!result || index !== tokens.length || numberCount === 0) return null;
  return result;
}

export function expressionsAreEqual(left, right, options) {
  const leftValue = evaluateExpression(left, options);
  const rightValue = evaluateExpression(right, options);
  return Boolean(leftValue && rightValue && leftValue.isPositive() && leftValue.equals(rightValue));
}
