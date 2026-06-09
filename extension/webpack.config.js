/*** webpack.config.js ***/
const autoprefixer = require('autoprefixer')
const path = require('path');
module.exports = {
    entry: path.join(__dirname, "src/repl/index.tsx"),
    output: {
        filename: '[name].js',
        path: path.join(__dirname, 'out/repl/'),
        publicPath: './'
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        transpileOnly: true,
                        configFile: path.join(__dirname, "tsconfig.webpack.json")
                    }
                },
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [
                    require.resolve('style-loader'),
                    {
                        loader: require.resolve('css-loader'),
                        options: {
                            importLoaders: 1,
                        },
                    },
                    {
                        loader: require.resolve('postcss-loader'),
                        options: {
                            postcssOptions: {
                                plugins: [
                                    require('postcss-flexbugs-fixes'),
                                    require('postcss-inline-svg'),
                                    autoprefixer({
                                        overrideBrowserslist: [
                                            '>1%',
                                            'last 4 versions',
                                            'Firefox ESR',
                                            'not ie < 9',
                                        ],
                                        flexbox: 'no-2009',
                                    }),
                                ],
                            },
                        },
                    },
                ],
            }
        ]
    },
    mode: "production",
    resolve: {
        alias: {
            "@waves/waves-repl$": path.resolve(__dirname, "..", "..", "waves-repl", "src", "index.tsx")
        },
        extensions: [".js", ".jsx", ".ts", ".tsx"]
    }
};
