// equation-parser.js - Safe, robust mathematical expression parser and AST evaluator

const ALLOWED_CONSTANTS = Object.freeze({
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E
});

const ALLOWED_FUNCTIONS = Object.freeze({
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: (x) => {
    if (x < 0) return NaN;
    return Math.sqrt(x);
  },
  abs: Math.abs,
  log: (x) => {
    if (x <= 0) return NaN;
    return Math.log(x);
  },
  ln: (x) => {
    if (x <= 0) return NaN;
    return Math.log(x);
  },
  exp: Math.exp
});

const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  IDENTIFIER: 'IDENTIFIER',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  MUL: 'MUL',
  DIV: 'DIV',
  POW: 'POW',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF'
};

/**
 * Tokenize input equation string into structured tokens
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < n && /[0-9]/.test(input[i + 1]))) {
      let numStr = '';
      while (i < n && (/[0-9]/.test(input[i]) || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      const val = parseFloat(numStr);
      if (Number.isNaN(val)) {
        throw new Error(`Invalid number literal: '${numStr}'`);
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: val });
      continue;
    }

    // Identifier (variable, function, constant)
    if (/[a-zA-Z_]/.test(ch)) {
      let idStr = '';
      while (i < n && /[a-zA-Z0-9_]/.test(input[i])) {
        idStr += input[i];
        i++;
      }
      tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: idStr });
      continue;
    }

    // Operators and delimiters
    switch (ch) {
      case '+': tokens.push({ type: TOKEN_TYPES.PLUS }); i++; break;
      case '-': tokens.push({ type: TOKEN_TYPES.MINUS }); i++; break;
      case '*': tokens.push({ type: TOKEN_TYPES.MUL }); i++; break;
      case '/': tokens.push({ type: TOKEN_TYPES.DIV }); i++; break;
      case '^': tokens.push({ type: TOKEN_TYPES.POW }); i++; break;
      case '(': tokens.push({ type: TOKEN_TYPES.LPAREN }); i++; break;
      case ')': tokens.push({ type: TOKEN_TYPES.RPAREN }); i++; break;
      default:
        throw new Error(`Unexpected character in equation: '${ch}'`);
    }
  }

  // Insert implicit multiplications: e.g. 2x -> 2*x, 3(x) -> 3*(x), (x)(x) -> (x)*(x), x(x) -> x*(x) if not func
  const processed = [];
  for (let j = 0; j < tokens.length; j++) {
    const curr = tokens[j];
    processed.push(curr);

    if (j + 1 < tokens.length) {
      const next = tokens[j + 1];

      const isCurrTerm = curr.type === TOKEN_TYPES.NUMBER ||
                         curr.type === TOKEN_TYPES.RPAREN ||
                         curr.type === TOKEN_TYPES.IDENTIFIER;

      const isNextTerm = next.type === TOKEN_TYPES.NUMBER ||
                         next.type === TOKEN_TYPES.LPAREN ||
                         next.type === TOKEN_TYPES.IDENTIFIER;

      // Special case: function calls like sin(x) should NOT have * inserted between 'sin' and '('
      const isFunctionCall = curr.type === TOKEN_TYPES.IDENTIFIER &&
                             ALLOWED_FUNCTIONS[curr.value.toLowerCase()] &&
                             next.type === TOKEN_TYPES.LPAREN;

      if (isCurrTerm && isNextTerm && !isFunctionCall) {
        processed.push({ type: TOKEN_TYPES.MUL, implicit: true });
      }
    }
  }

  processed.push({ type: TOKEN_TYPES.EOF });
  return processed;
}

/**
 * Recursive Descent Parser building an AST
 */
class Parser {
  constructor(tokens, variableName = 'x') {
    this.tokens = tokens;
    this.pos = 0;
    this.variableName = variableName.toLowerCase();
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(expectedType = null) {
    const token = this.tokens[this.pos];
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but found ${token.type} (${token.value || ''})`);
    }
    this.pos++;
    return token;
  }

  parse() {
    if (this.peek().type === TOKEN_TYPES.EOF) {
      throw new Error('Equation cannot be empty');
    }
    const ast = this.parseExpression();
    if (this.peek().type !== TOKEN_TYPES.EOF) {
      throw new Error(`Unexpected token at end of expression: '${this.peek().value || this.peek().type}'`);
    }
    return ast;
  }

  parseExpression() {
    return this.parseAddition();
  }

  parseAddition() {
    let node = this.parseMultiplication();

    while (this.peek().type === TOKEN_TYPES.PLUS || this.peek().type === TOKEN_TYPES.MINUS) {
      const opToken = this.consume();
      const right = this.parseMultiplication();
      node = {
        type: opToken.type === TOKEN_TYPES.PLUS ? 'ADD' : 'SUB',
        left: node,
        right
      };
    }
    return node;
  }

  parseMultiplication() {
    let node = this.parsePower();

    while (this.peek().type === TOKEN_TYPES.MUL || this.peek().type === TOKEN_TYPES.DIV) {
      const opToken = this.consume();
      const right = this.parsePower();
      node = {
        type: opToken.type === TOKEN_TYPES.MUL ? 'MUL' : 'DIV',
        left: node,
        right
      };
    }
    return node;
  }

  parsePower() {
    let node = this.parseUnary();

    if (this.peek().type === TOKEN_TYPES.POW) {
      this.consume();
      const right = this.parsePower(); // Right-associative: a^b^c = a^(b^c)
      node = {
        type: 'POW',
        left: node,
        right
      };
    }
    return node;
  }

  parseUnary() {
    if (this.peek().type === TOKEN_TYPES.PLUS) {
      this.consume();
      return this.parseUnary();
    }
    if (this.peek().type === TOKEN_TYPES.MINUS) {
      this.consume();
      const right = this.parseUnary();
      return {
        type: 'NEG',
        argument: right
      };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();

    if (token.type === TOKEN_TYPES.NUMBER) {
      this.consume();
      return { type: 'NUMBER', value: token.value };
    }

    if (token.type === TOKEN_TYPES.IDENTIFIER) {
      this.consume();
      const id = token.value.toLowerCase();

      // Check if it's the valid variable
      if (id === this.variableName) {
        return { type: 'VARIABLE', name: this.variableName };
      }

      // Check if constant
      if (ALLOWED_CONSTANTS[id] !== undefined) {
        return { type: 'CONSTANT', name: id, value: ALLOWED_CONSTANTS[id] };
      }

      // Check if function call
      if (ALLOWED_FUNCTIONS[id] !== undefined) {
        if (this.peek().type !== TOKEN_TYPES.LPAREN) {
          throw new Error(`Function '${id}' must be followed by parentheses, e.g. ${id}(x)`);
        }
        this.consume(TOKEN_TYPES.LPAREN);
        const arg = this.parseExpression();
        this.consume(TOKEN_TYPES.RPAREN);
        return {
          type: 'FUNCTION',
          name: id,
          fn: ALLOWED_FUNCTIONS[id],
          argument: arg
        };
      }

      throw new Error(`Unknown identifier '${token.value}'. Allowed variable for this orientation is '${this.variableName}'`);
    }

    if (token.type === TOKEN_TYPES.LPAREN) {
      this.consume(TOKEN_TYPES.LPAREN);
      const expr = this.parseExpression();
      if (this.peek().type !== TOKEN_TYPES.RPAREN) {
        throw new Error("Missing closing parenthesis ')'");
      }
      this.consume(TOKEN_TYPES.RPAREN);
      return expr;
    }

    throw new Error(`Unexpected token: '${token.value || token.type}'`);
  }
}

/**
 * Evaluate an AST node at input variable value
 */
function evaluateAST(node, varValue) {
  switch (node.type) {
    case 'NUMBER':
    case 'CONSTANT':
      return node.value;

    case 'VARIABLE':
      return varValue;

    case 'NEG': {
      const arg = evaluateAST(node.argument, varValue);
      return -arg;
    }

    case 'ADD': {
      const l = evaluateAST(node.left, varValue);
      const r = evaluateAST(node.right, varValue);
      return l + r;
    }

    case 'SUB': {
      const l = evaluateAST(node.left, varValue);
      const r = evaluateAST(node.right, varValue);
      return l - r;
    }

    case 'MUL': {
      const l = evaluateAST(node.left, varValue);
      const r = evaluateAST(node.right, varValue);
      return l * r;
    }

    case 'DIV': {
      const l = evaluateAST(node.left, varValue);
      const r = evaluateAST(node.right, varValue);
      if (Math.abs(r) < 1e-15) {
        return NaN; // Safe handling of division by zero
      }
      return l / r;
    }

    case 'POW': {
      const base = evaluateAST(node.left, varValue);
      const exp = evaluateAST(node.right, varValue);
      if (base < 0 && !Number.isInteger(exp)) {
        return NaN; // Fractional power of negative number
      }
      return Math.pow(base, exp);
    }

    case 'FUNCTION': {
      const argVal = evaluateAST(node.argument, varValue);
      if (Number.isNaN(argVal)) return NaN;
      return node.fn(argVal);
    }

    default:
      return NaN;
  }
}

/**
 * Public Parser Interface
 * @param {string} equationStr - Raw equation string entered by user
 * @param {string} variableName - 'x' or 'y' based on orientation
 * @returns {{ success: boolean, evaluate?: (val: number) => number, ast?: object, error?: string }}
 */
export function parseEquation(equationStr, variableName = 'x') {
  if (!equationStr || typeof equationStr !== 'string') {
    return { success: false, error: 'Equation cannot be empty' };
  }

  // Strip leading 'y =' or 'x =' if student typed equation with prefix
  let sanitized = equationStr.trim();
  const prefixRegex = new RegExp(`^${variableName}\\s*=\\s*`, 'i');
  sanitized = sanitized.replace(prefixRegex, '');
  const altVar = variableName.toLowerCase() === 'x' ? 'y' : 'x';
  const altPrefixRegex = new RegExp(`^${altVar}\\s*=\\s*`, 'i');
  sanitized = sanitized.replace(altPrefixRegex, '');

  if (!sanitized) {
    return { success: false, error: 'Equation cannot be empty' };
  }

  try {
    const tokens = tokenize(sanitized);
    const parser = new Parser(tokens, variableName);
    const ast = parser.parse();

    const evaluate = (v) => {
      if (typeof v !== 'number' || Number.isNaN(v)) return NaN;
      const res = evaluateAST(ast, v);
      return Number.isFinite(res) ? res : NaN;
    };

    return {
      success: true,
      ast,
      evaluate
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Invalid equation syntax'
    };
  }
}

export function validateEquationSyntax(equationStr, variableName = 'x') {
  const result = parseEquation(equationStr, variableName);
  return {
    isValid: result.success,
    error: result.error
  };
}
