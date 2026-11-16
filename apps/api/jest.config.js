module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  testTimeout: 15000,
  moduleNameMapper: {
    '^@anagu/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@anagu/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1'
  }
};
