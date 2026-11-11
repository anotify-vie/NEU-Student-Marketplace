// Unit checks for the round-half-up selected price (no browser needed): node frontend/scripts/verify-pricing.mjs
import assert from 'node:assert/strict';
import {selectedPrice} from '../js/pricing.js';

// Common examples from docs/api-contract.md
assert.equal(selectedPrice(100000,3,1),33333);
assert.equal(selectedPrice(100000,3,2),66667);
assert.equal(selectedPrice(100000,3,3),100000);
assert.equal(selectedPrice(45000,1,1),45000);
// Exactly half a VND rounds up (1 VND over 2 units -> 0.5 -> 1)
assert.equal(selectedPrice(1,2,1),1);
assert.equal(selectedPrice(3,2,1),2);
assert.equal(selectedPrice(5,10,1),1);
// Selecting every unit returns the exact total, even for huge values
for (const [price,quantity] of [[0,7],[999,7],[Number.MAX_SAFE_INTEGER,3],[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]]) assert.equal(selectedPrice(price,quantity,quantity),price);
// Large values must match exact BigInt arithmetic, not floating point
const price = 9007199254740991, quantity = 7;
for (let selected = 1; selected <= quantity; selected++) {
  const expected = (2n * BigInt(price) * BigInt(selected) + BigInt(quantity)) / (2n * BigInt(quantity));
  assert.equal(BigInt(selectedPrice(price,quantity,selected)),expected);
}
assert.equal(selectedPrice(9007199254740991,2,1),4503599627370496);
console.log('PASS selected-price rounding: examples, half-VND, full quantity and large values');
