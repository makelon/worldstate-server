import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'

export default defineConfig(
	{
		ignores: ["out/**"],
	},
	eslint.configs.recommended,
	{
		name: 'style',
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		plugins: {
			'style': stylistic,
		},
		rules: {
			"curly": "error",
			"eqeqeq": "warn",
			"no-sequences": "error",
			"no-shadow": "error",
			"no-throw-literal": "error",
			"require-await": "error",
			"style/array-bracket-newline": "error",
			"style/brace-style": [
				"error",
				"stroustrup",
				{ "allowSingleLine": true },
			],
			"style/comma-dangle": ["error", "always-multiline"],
			"style/function-paren-newline": ["error", "multiline-arguments"],
			"style/generator-star-spacing": ["error", "after"],
			"style/indent": [
				"error",
				"tab",
				{ SwitchCase: 1 },
			],
			"style/linebreak-style": "error",
			"style/no-mixed-operators": [
				"error",
				{ groups: [["&&", "||"]] },
			],
			"style/no-multiple-empty-lines": [
				"error",
				{ max: 1 },
			],
			"style/nonblock-statement-body-position": "error",
			"style/object-curly-newline": "error",
			"style/semi": ["error", "never"],
		},
	},
	{
		files: ["spec/**/*.js"],
		name: ".spec",
		languageOptions: {
			globals: {
				...globals.jasmine,
			},
		},
	},
	{
		name: 'typescript',
		files: ["**/*.ts"],
		extends: tseslint.configs.recommended,
		rules: {
			"@typescript-eslint/explicit-module-boundary-types": [
				"error",
				{
					allowArgumentsExplicitlyTypedAsAny: true,
					allowedNames: ["entityRewards", "isActive"],
				},
			],
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-unused-vars": "off",
		},
	},
)
