const path = require('path');
const rootNodeModules = path.join(__dirname, 'node_modules');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: path.join(__dirname, 'apps/api'),
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': path.join(__dirname, 'apps/api/node_modules/ts-jest'),
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  modulePaths: [rootNodeModules, path.join(__dirname, 'apps/api/node_modules')],
  moduleDirectories: ['node_modules', rootNodeModules],
  collectCoverageFrom: ['<rootDir>/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/coverage',
  testEnvironment: 'node',
};
