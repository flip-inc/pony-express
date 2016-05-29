'use strict';

class CleanExitError extends Error {
  constructor(message) {
    super(message);
    this.message = message || '';
    this.name = 'CleanExitError';
  }
}

module.exports = {
  CleanExitError: CleanExitError
};