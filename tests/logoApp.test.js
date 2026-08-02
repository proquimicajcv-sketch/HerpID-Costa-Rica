import test from 'node:test';
import assert from 'node:assert/strict';
import { determinarDestinoLogo } from '../src/utils/logoApp.js';

test('los administradores guardan el logo como global', () => {
  assert.equal(determinarDestinoLogo({ esAdmin: true, hayLogoGlobal: false }), 'global');
});

test('los usuarios regulares guardan el logo como personal', () => {
  assert.equal(determinarDestinoLogo({ esAdmin: false, hayLogoGlobal: false }), 'personal');
});
