const webpack = require('webpack');

module.exports = {
  node: {
    child_process: 'empty'
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
};
