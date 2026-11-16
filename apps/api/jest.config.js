module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  testTimeout: 15000,
  testPathIgnorePatterns: ['/node_modules/'],
  watchPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@anagu/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@anagu/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^worker-timers$': '<rootDir>/src/__mocks__/worker-timers.js',
    '^worker-timers-broker$': '<rootDir>/src/__mocks__/worker-timers.js',
    '^broker-factory$': '<rootDir>/src/__mocks__/worker-timers.js'
  }
};
