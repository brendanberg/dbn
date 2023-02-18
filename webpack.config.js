const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: {
		main: './src/js/main.js'
	},
	devtool: 'inline-source-map',
	devServer: {
		static: './build'
	},
	output: {
		path: path.resolve(__dirname, 'build'),
		filename: 'js/[name].bundle.js',
		clean: true,
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{from: 'index.html', to: './', context: './src/'},
				{from: '*.css', to: 'css/', context: './src/css/'},
				{from: '**/*.(svg|gif|jpg|jpeg|png)', to: 'assets/', context: './src/assets/'},
				{from: 'src/examples', to: 'examples/'},
				{from: 'src/icons', to: 'icons/'},
			]
		})
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

