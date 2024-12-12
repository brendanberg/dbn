const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: {
		main: './client/js/main.js'
	},
	devtool: 'inline-source-map',
	devServer: {
		static: './build',
		headers: {
			'Content-Security-Policy': "default-src * http://localhost:8080; style-src * https://fonts.googleapis.com 'unsafe-inline'; script-src * 'unsafe-inline'; connect-src * https://dbn.berg.industries ws://localhost:8080; object-src *;",
			'Referrer-Policy': 'no-referrer',	
		}
	},
	output: {
		path: path.resolve(__dirname, 'build'),
		filename: 'js/[name].bundle.js',
		clean: true,
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{from: 'index.html', to: './', context: './client/'},
				{from: '*.css', to: 'css/', context: './client/css/'},
				{from: '**/*.(svg|gif|jpg|jpeg|png)', to: 'assets/', context: './client/assets/'},
				{from: 'client/examples', to: 'examples/'},
				{from: 'client/icons', to: 'icons/'},
			]
		})
	],
	module: {
		rules: [
			{
				test: /\.pegjs$/,
				use: 'pegjs-loader',
			}
		]
	}
};

