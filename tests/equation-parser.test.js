// equation-parser.test.js - Comprehensive test suite for Equation Parser

import assert from 'node:assert';
import { parseEquation, validateEquationSyntax } from '../js/builder/equation-parser.js';

console.log('Testing Equation Parser...');

// 1. Valid Linear Equations
{
  const res = parseEquation('2*x + 10', 'x');
  assert.strictEqual(res.success, true, 'Linear equation should parse');
  assert.strictEqual(res.evaluate(0), 10, 'f(0) should be 10');
  assert.strictEqual(res.evaluate(5), 20, 'f(5) should be 20');
}

// 2. Valid Polynomial & Power Equations
{
  const res = parseEquation('0.01*x^2 + 5', 'x');
  assert.strictEqual(res.success, true, 'Polynomial equation should parse');
  assert.strictEqual(res.evaluate(0), 5, 'f(0) should be 5');
  assert.strictEqual(res.evaluate(10), 6, 'f(10) should be 6');
}

// 3. Implicit Multiplication (e.g. 2x, 0.5(x-20)^2, 3pi)
{
  const res = parseEquation('2x + 5', 'x');
  assert.strictEqual(res.success, true, 'Implicit multiplication 2x should parse');
  assert.strictEqual(res.evaluate(4), 13, '2(4) + 5 should be 13');

  const res2 = parseEquation('3(x + 2)', 'x');
  assert.strictEqual(res2.success, true, 'Implicit multiplication 3(x+2) should parse');
  assert.strictEqual(res2.evaluate(3), 15, '3(3+2) should be 15');
}

// 4. Mathematical Functions (sin, cos, tan, sqrt, abs, exp, log)
{
  const resSin = parseEquation('sin(x)', 'x');
  assert.strictEqual(resSin.success, true);
  assert.strictEqual(Math.round(resSin.evaluate(0)), 0);
  assert.strictEqual(Math.round(resSin.evaluate(Math.PI / 2)), 1);

  const resSqrt = parseEquation('sqrt(x + 9)', 'x');
  assert.strictEqual(resSqrt.success, true);
  assert.strictEqual(resSqrt.evaluate(0), 3);
  assert.strictEqual(resSqrt.evaluate(16), 5);
}

// 5. Constants (pi, e)
{
  const resPi = parseEquation('x + pi', 'x');
  assert.strictEqual(resPi.success, true);
  assert.strictEqual(Math.round(resPi.evaluate(0) * 1000), 3142);
}

// 6. Variable Orientation (y = f(x) vs x = f(y))
{
  const resY = parseEquation('0.02*y^2 + 100', 'y');
  assert.strictEqual(resY.success, true, 'Equation with variable y should parse');
  assert.strictEqual(resY.evaluate(10), 102, 'f(10) should be 102');

  const mismatch = parseEquation('2*x + 1', 'y');
  assert.strictEqual(mismatch.success, false, 'Using variable x when expecting y should fail');
}

// 7. Stripping Prefixes (y = ... or x = ...)
{
  const resPrefix = parseEquation('y = 0.05*x^2 + 500', 'x');
  assert.strictEqual(resPrefix.success, true, 'y = prefix should be stripped gracefully');
  assert.strictEqual(resPrefix.evaluate(0), 500);
}

// 8. Invalid Syntax Rejection
{
  const empty = parseEquation('');
  assert.strictEqual(empty.success, false, 'Empty equation should fail');

  const unclosed = parseEquation('2*(x + 5');
  assert.strictEqual(unclosed.success, false, 'Unclosed parenthesis should fail');

  const doubleOp = parseEquation('2 * * x');
  assert.strictEqual(doubleOp.success, false, 'Double operator should fail');

  const trailingOp = parseEquation('2*x +');
  assert.strictEqual(trailingOp.success, false, 'Trailing operator should fail');
}

// 9. Malicious / Dangerous Input Rejection (Must NOT execute or allow arbitrary code)
{
  const malicious1 = parseEquation('alert(1)');
  assert.strictEqual(malicious1.success, false, 'alert(1) must be rejected');

  const malicious2 = parseEquation('window.location = "http://evil.com"');
  assert.strictEqual(malicious2.success, false, 'window access must be rejected');

  const malicious3 = parseEquation('process.exit(1)');
  assert.strictEqual(malicious3.success, false, 'process access must be rejected');

  const malicious4 = parseEquation('eval("2+2")');
  assert.strictEqual(malicious4.success, false, 'eval must be rejected');

  const malicious5 = parseEquation('<script>alert("xss")</script>');
  assert.strictEqual(malicious5.success, false, 'script tags must be rejected');
}

// 10. Unknown Functions & Variables
{
  const unknownFunc = parseEquation('foo(x)');
  assert.strictEqual(unknownFunc.success, false, 'Unknown function foo() must be rejected');

  const unknownVar = parseEquation('2*z + 1', 'x');
  assert.strictEqual(unknownVar.success, false, 'Unknown variable z must be rejected');
}

// 11. Division by Zero & Negative Sqrt (Safe numerical handling, no uncaught exceptions)
{
  const divZero = parseEquation('10 / x', 'x');
  assert.strictEqual(divZero.success, true);
  assert.strictEqual(Number.isNaN(divZero.evaluate(0)), true, 'Division by zero must return NaN safely');

  const negSqrt = parseEquation('sqrt(x)', 'x');
  assert.strictEqual(negSqrt.success, true);
  assert.strictEqual(Number.isNaN(negSqrt.evaluate(-4)), true, 'Negative sqrt must return NaN safely');
}

// 12. validateEquationSyntax helper
{
  const valid = validateEquationSyntax('3*x + 1');
  assert.strictEqual(valid.isValid, true);

  const invalid = validateEquationSyntax('3*x +');
  assert.strictEqual(invalid.isValid, false);
  assert.ok(invalid.error);
}

console.log('  PASS: Equation Parser tests');
