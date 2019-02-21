const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: {
		main: './src/js/main.js'
	},
	devtool: 'inline-source-map',
	devServer: {
		contentBase: 'build/'
	},
	output: {
		path: path.resolve(__dirname, 'build'),
		filename: 'js/[name].bundle.js'
	},
	plugins: [
		new CleanWebpackPlugin(['build']),
		new CopyWebpackPlugin([
			{from: 'src/index.html', to: ''},
			{from: 'src/css', to: 'css', test: /\.css$/},
			{from: 'src/assets', to: 'assets', test: /\.(svg|gif|jpg|jpeg|png)$/}
		])
	],
	module: {
		rules: [
			{
				test: /\.pegjs$/,
				use: [{loader: 'pegjs-loader'}]
			}
		]
	}
};

