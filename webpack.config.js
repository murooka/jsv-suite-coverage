const path    = require('path');

const rootDir = path.resolve(__dirname);

module.exports = {
  entry: path.join(rootDir, 'dist', 'main.js'),
  output: {
    path: path.join(rootDir, 'dist'),
    filename: 'bundle.js',
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
