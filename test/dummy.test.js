var vows = require('vows');
var assert = require('assert');
vows.describe('awesome').addBatch({
  'lollercoaster' : function () {
    assert.ok(true);
  },
  'failure' : function () {
    assert.ok(false);
  },
}).export(module);