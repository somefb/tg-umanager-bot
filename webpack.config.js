/* eslint-disable @typescript-eslint/no-var-requires */
const webpack = require("webpack");
const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

const isDevBuild = process.argv[process.argv.indexOf("--mode") + 1] !== "production";
const isDevEnv = process.argv[process.argv.indexOf("--env") + 1] === "dev";

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: {
    index: "./src/index.ts",
    "index.main": "./src/index.main.ts",
  },
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
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
  node: {
    __dirname: false,
  },
  optimization: {
    concatenateModules: false,
    minimizer: [
      new TerserPlugin({
        // default webpack plugin for js-optimization which should be configured: https://v4.webpack.js.org/configuration/optimization/#optimizationminimizer
        test: /\.m?js(\?.*)?$/i,
        // exclude: /\.m?js(\?.*)?$/i, // uncomment if we don't need uglifying (for debug purpose)
        extractComments: false, // disable extracting comments to a different file
        terserOptions: {
          toplevel: true, // https://github.com/terser/terser#minify-options
          output: {
            comments: false, // remove comments from files
          },
          keep_classnames: true,
          keep_fnames: true,
          compress: { pure_funcs: ["console.info"] }, // remove this functions when their return values are not used
        },
      }),
    ],
  },
  plugins: [
    new webpack.ProgressPlugin(), // it shows progress of building
    new CleanPlugin.CleanWebpackPlugin(), // it cleans output folder before extracting files
    new webpack.DefinePlugin({
      "global.isWebpackBuild": JSON.stringify(true),
      "global.DEV": JSON.stringify(isDevBuild || isDevEnv),
      "global.DEBUG": JSON.stringify(false),
      "global.VERBOSE": JSON.stringify(false),
    }),
    /** @type {import('copy-webpack-plugin')} */
    new CopyWebpackPlugin({
      patterns: [
        path.resolve(__dirname, "./src/googleDrive/googleToken.json"),
        path.resolve(__dirname, "./src/googleDrive/googleCache.json"),
        // path.resolve(__dirname, "./umanagerBot.dev.cfg"),
        // path.resolve(__dirname, "./umanagerBot.prod.cfg"),
      ],
    }),
  ],
};
