/* eslint-disable @typescript-eslint/no-var-requires */
const webpack = require("webpack");
const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: "./src/index.ts",
  target: "node",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js", ".json"],
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "build"),
  },
  node: {
    __dirname: false,
  },
  optimization: {
    concatenateModules: false,
  },
  plugins: [
    new webpack.ProgressPlugin(), // it shows progress of building
    new CleanPlugin.CleanWebpackPlugin(), // it cleans output folder before extracting files
    /** @type {import('copy-webpack-plugin')} */
    new CopyWebpackPlugin({
      patterns: [
        path.resolve(__dirname, "./src/googleDrive/googleToken.json"),
        path.resolve(__dirname, "./src/googleDrive/googleCache.json"),
        path.resolve(__dirname, "./umanagerBot.cfg"),
      ],
    }),
  ],
};
