const path    = require('path');

const rootDir = path.resolve(__dirname);

module.exports = {
  entry: path.join(rootDir, 'src', 'index.ts'),
  output: {
    path: path.join(rootDir, 'dist'),
    filename: 'index.js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  target: 'node',
  plugins: [],
};
